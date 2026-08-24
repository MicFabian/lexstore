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
     * The caller's organisation.
     *
     * Membership decides it, ordered so the answer is the same on every request
     * — picking whichever row came back first made an endpoint's answer depend
     * on nothing the caller could see. Someone in several is asked to name one,
     * rather than being given one at random.
     */
    fun currentOrgId(): UUID {
        val email = currentUser.identity().email
        val mine = email?.let { members.findByEmailIgnoreCase(it) }
            .orEmpty()
            .sortedBy { it.orgId.toString() }
        mine.firstOrNull()?.let { return it.orgId }

        // A platform admin, or a context with security disabled, has no
        // membership; the oldest organisation is a stable answer rather than
        // whichever row the database returned first.
        if (isPlatformAdmin()) {
            return organisations.findAll().minByOrNull { it.createdAt }?.id
                ?: throw OrgAccessDeniedException("No organisation exists yet.")
        }
        throw OrgAccessDeniedException("You do not belong to an organisation yet.")
    }

    fun assertAdmin(orgId: UUID) {
        rejectApiKey()
        if (isPlatformAdmin()) return
        val email = currentUser.identity().email
            ?: throw OrgAccessDeniedException("Sign in to manage an organisation.")
        val member = members.findByOrgIdAndEmailIgnoreCase(orgId, email)
        if (member?.role != "ADMIN") {
            throw OrgAccessDeniedException("Only an organisation admin can change this.")
        }
    }

    fun assertMember(orgId: UUID) {
        rejectApiKey()
        if (isPlatformAdmin()) return
        val email = currentUser.identity().email
            ?: throw OrgAccessDeniedException("Sign in to view this organisation.")
        members.findByOrgIdAndEmailIgnoreCase(orgId, email)
            ?: throw OrgAccessDeniedException("You do not belong to this organisation.")
    }

    /**
     * An API key belongs to one project and stands for no person. It must not
     * reach organisation settings, which hold every stored provider key.
     */
    private fun rejectApiKey() {
        val auth = org.springframework.security.core.context.SecurityContextHolder
            .getContext().authentication
        if (auth is io.lexstore.apikey.ApiKeyAuthentication) {
            throw OrgAccessDeniedException("An API key cannot manage an organisation.")
        }
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
