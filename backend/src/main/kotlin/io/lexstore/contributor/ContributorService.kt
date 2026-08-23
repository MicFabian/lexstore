package io.lexstore.contributor

import io.lexstore.common.ContributorRole
import io.lexstore.common.RelativeTime
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
@Transactional(readOnly = true)
class ContributorService(
    private val contributors: ContributorRepository,
    private val events: io.lexstore.translation.TranslationEventRepository,
    private val languages: io.lexstore.language.LanguageRepository,
) {

    /**
     * "Last active" is read from the audit trail rather than stored: a field
     * nothing updates goes stale the moment it is written, and the events
     * already record who changed what and when.
     */
    fun list(projectId: UUID): List<ContributorView> {
        val lastSeen = events.lastActivityByAuthor(projectId).associate { it.authorName to it.at }
        return contributors.findByProjectIdOrderByName(projectId).map { c ->
            toView(c).copy(
                active = lastSeen[c.name]?.let { RelativeTime.format(it) } ?: "No activity yet",
            )
        }
    }

    @Transactional
    fun invite(projectId: UUID, req: InviteContributorRequest): ContributorView {
        val nextAvatar = (contributors.countByProjectId(projectId) % 7).toInt()
        val langs = validatedLanguages(projectId, req.langs)
        val saved = contributors.save(
            Contributor(
                projectId = projectId,
                name = req.name,
                email = req.email,
                role = ContributorRole.from(req.role ?: "Translator"),
                languages = langs,
                avatarIndex = nextAvatar,
                lastActive = "Invited",
            ),
        )
        return toView(saved)
    }

    @Transactional
    fun update(projectId: UUID, id: UUID, req: UpdateContributorRequest): ContributorView {
        val c = contributors.findById(id)
            .filter { it.projectId == projectId }
            .orElseThrow { ContributorNotFoundException(id.toString()) }
        req.role?.let {
            c.role = ContributorRole.parse(it)
                ?: throw IllegalArgumentException("'$it' is not a contributor role.")
        }
        req.langs?.let { c.languages = validatedLanguages(projectId, it) }
        return toView(contributors.save(c))
    }

    @Transactional
    fun remove(projectId: UUID, id: UUID) {
        contributors.findById(id).ifPresent {
            if (it.projectId == projectId) contributors.delete(it)
        }
    }

    /**
     * Scoping someone to a language the project does not have assigns work that
     * cannot exist, and the screens would show it as a real assignment.
     */
    private fun validatedLanguages(projectId: UUID, langs: List<String>?): String {
        val requested = langs?.map { it.trim() }?.filter { it.isNotEmpty() } ?: return ""
        if (requested.isEmpty()) return ""
        val available = languages.findByProjectIdOrderByName(projectId).map { it.code }.toSet()
        val unknown = requested.filterNot { it in available }
        require(unknown.isEmpty()) {
            "This project has no language " + unknown.joinToString(", ") + "."
        }
        return requested.joinToString(",")
    }

    private fun toView(c: Contributor) = ContributorView(
        id = c.id,
        name = c.name,
        email = c.email,
        role = c.role.name.lowercase().replaceFirstChar { it.uppercase() },
        langs = c.languageList,
        avatar = c.avatarIndex,
        // list() replaces this with real activity; a freshly invited person has
        // none yet, which is what the stored value says.
        active = c.lastActive.ifBlank { "No activity yet" },
    )
}

class ContributorNotFoundException(id: String) : RuntimeException("Contributor '$id' is not in this project.")
