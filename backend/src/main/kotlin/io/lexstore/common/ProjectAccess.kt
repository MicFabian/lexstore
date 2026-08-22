package io.lexstore.common

import io.lexstore.contributor.ContributorRepository
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Component
import java.util.UUID

class ProjectAccessDeniedException(projectId: UUID) :
    RuntimeException("You do not have access to project $projectId.")

@Component
class ProjectAccess(
    private val contributors: ContributorRepository,
    private val currentUser: CurrentUser,
) {
    fun assertMember(projectId: UUID) {
        if (isPlatformAdmin()) return
        val email = currentUser.identity().email
            ?: throw ProjectAccessDeniedException(projectId)
        val member = contributors.findByProjectId(projectId)
            .any { it.email.equals(email, ignoreCase = true) }
        if (!member) throw ProjectAccessDeniedException(projectId)
    }

    fun assertRole(projectId: UUID, vararg allowed: ContributorRole) {
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
    private fun isPlatformAdmin(): Boolean {
        val auth = SecurityContextHolder.getContext().authentication
        if (auth?.principal !is Jwt) return true
        return auth.authorities.any { it.authority == "ROLE_ADMIN" }
    }
}
