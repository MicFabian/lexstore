package io.translad.contributor

import io.translad.common.ContributorRole
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
@Transactional(readOnly = true)
class ContributorService(private val contributors: ContributorRepository) {

    fun list(projectId: UUID): List<ContributorView> =
        contributors.findByProjectIdOrderByName(projectId).map(::toView)

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
