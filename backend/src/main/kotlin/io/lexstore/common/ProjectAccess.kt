package io.lexstore.common

import io.lexstore.contributor.ContributorRepository
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Component
import java.util.UUID

class ProjectAccessDeniedException(projectId: UUID) :
    RuntimeException("You do not have access to project $projectId.")

class ReadOnlyKeyException :
    RuntimeException("This API key is read-only. Create a read & write key to change translations.")

@Component
class ProjectAccess(
    private val contributors: ContributorRepository,
    private val projects: io.lexstore.project.ProjectRepository,
    private val currentUser: CurrentUser,
) {
    fun assertMember(projectId: UUID) {
        apiKeyCovers(projectId)?.let { covered ->
            if (!covered) throw ProjectAccessDeniedException(projectId)
            return
        }
        if (isPlatformAdmin()) return
        val email = currentUser.identity().email
            ?: throw ProjectAccessDeniedException(projectId)
        val member = contributors.findByProjectId(projectId)
            .any { it.email.equals(email, ignoreCase = true) }
        if (!member) throw ProjectAccessDeniedException(projectId)
    }

    fun assertRole(projectId: UUID, vararg allowed: ContributorRole) {
        apiKeyCovers(projectId)?.let { covered ->
            // A key stands for a project or an organisation, not a person, so it
            // has no contributor role; its scope already decided what it may do.
            if (!covered) throw ProjectAccessDeniedException(projectId)
            return
        }
        if (isPlatformAdmin()) return
        val email = currentUser.identity().email
            ?: throw ProjectAccessDeniedException(projectId)
        val role = contributors.findByProjectId(projectId)
            .firstOrNull { it.email.equals(email, ignoreCase = true) }
            ?.role
            ?: throw ProjectAccessDeniedException(projectId)
        if (role !in allowed) throw ProjectAccessDeniedException(projectId)
    }

    fun visibleProjectIds(): Set<UUID>? {
        apiKey()?.let { key ->
            key.projectId?.let { return setOf(it) }
            val orgId = key.orgId ?: return emptySet()
            return projects.findByOrgId(orgId).map { it.id }.toSet()
        }
        if (isPlatformAdmin()) return null
        val email = currentUser.identity().email ?: return emptySet()
        return contributors.findByEmailIgnoreCase(email).map { it.projectId }.toSet()
    }

    /**
     * Membership is checked for real callers only. A request that carries no
     * JWT never reaches here in a deployment — the filter chain rejects it —
     * so an unauthenticated context means the security chain is disabled, as
     * it is for the unauthenticated integration tests.
     */
    private fun apiKey(): io.lexstore.apikey.ApiKeyAuthentication? =
        SecurityContextHolder.getContext().authentication as? io.lexstore.apikey.ApiKeyAuthentication

    /**
     * Whether the request's API key covers this project: a project key covers
     * only its own, an organisation key covers every project that organisation
     * owns. Null means the caller is a person, not a key.
     */
    private fun apiKeyCovers(projectId: UUID): Boolean? {
        val key = apiKey() ?: return null
        key.projectId?.let { return it == projectId }
        val orgId = key.orgId ?: return false
        return projects.findById(projectId).orElse(null)?.orgId == orgId
    }

    private fun isPlatformAdmin(): Boolean {
        val auth = SecurityContextHolder.getContext().authentication
        if (auth?.principal !is Jwt) return true
        return auth.authorities.any { it.authority == "ROLE_ADMIN" }
    }
}
