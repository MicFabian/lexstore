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
        val saved = contributors.save(
            Contributor(
                projectId = projectId,
                name = req.name,
                email = req.email,
                role = ContributorRole.from(req.role ?: "Translator"),
                languages = req.langs?.joinToString(",") ?: "",
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
        req.langs?.let { c.languages = it.joinToString(",") }
        return toView(contributors.save(c))
    }

    @Transactional
    fun remove(projectId: UUID, id: UUID) {
        contributors.findById(id).ifPresent {
            if (it.projectId == projectId) contributors.delete(it)
        }
    }

    private fun toView(c: Contributor) = ContributorView(
        id = c.id,
        name = c.name,
        email = c.email,
        role = c.role.name.lowercase().replaceFirstChar { it.uppercase() },
        langs = c.languageList,
        avatar = c.avatarIndex,
        active = c.lastActive,
    )
}

class ContributorNotFoundException(id: String) : RuntimeException("Contributor '$id' is not in this project.")
