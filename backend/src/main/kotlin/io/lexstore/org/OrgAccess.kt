package io.lexstore.org

import io.lexstore.common.CurrentUser
import org.springframework.stereotype.Component
import java.util.UUID

class OrgAccessDeniedException(message: String) : RuntimeException(message)

/** The organisation a request belongs to, and what the caller may do in it. */
@Component
class OrgAccess(
    private val members: OrgMemberRepository,
    private val organisations: OrganisationRepository,
    private val currentUser: CurrentUser,
) {
    /**
     * The caller's organisation. A person belonging to several picks one by
     * being asked for a specific project; the bare case takes their first,
     * which is the only one that exists for now.
     */
    fun currentOrgId(): UUID {
        val email = currentUser.identity().email
        val mine = email?.let { members.findByEmailIgnoreCase(it) }.orEmpty()
        return mine.firstOrNull()?.orgId
            ?: organisations.findAll().firstOrNull()?.id
            ?: throw OrgAccessDeniedException("You do not belong to an organisation yet.")
    }

    fun assertAdmin(orgId: UUID) {
        if (isPlatformAdmin()) return
        val email = currentUser.identity().email
            ?: throw OrgAccessDeniedException("Sign in to manage an organisation.")
        val member = members.findByOrgIdAndEmailIgnoreCase(orgId, email)
        if (member?.role != "ADMIN") {
            throw OrgAccessDeniedException("Only an organisation admin can change this.")
        }
    }

    fun assertMember(orgId: UUID) {
        if (isPlatformAdmin()) return
        val email = currentUser.identity().email
            ?: throw OrgAccessDeniedException("Sign in to view this organisation.")
        members.findByOrgIdAndEmailIgnoreCase(orgId, email)
            ?: throw OrgAccessDeniedException("You do not belong to this organisation.")
    }

    /**
     * A realm admin administers the platform and therefore every organisation
     * on it — the same rule project access already applies.
     */
    private fun isPlatformAdmin(): Boolean {
        val auth = org.springframework.security.core.context.SecurityContextHolder
            .getContext().authentication
        if (auth?.principal !is org.springframework.security.oauth2.jwt.Jwt) return true
        return auth.authorities.any { it.authority == "ROLE_ADMIN" }
    }
}
