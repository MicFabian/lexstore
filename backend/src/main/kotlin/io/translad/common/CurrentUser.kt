package io.translad.common

import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Component

/** Display identity of the authenticated user, for stamping audit events/comments. */
data class UserIdentity(val name: String, val email: String?, val avatar: Int)

@Component
class CurrentUser {

    /** Resolve the caller's display name (falls back to a placeholder when unauthenticated). */
    fun identity(): UserIdentity {
        val auth = SecurityContextHolder.getContext().authentication
        val principal = auth?.principal
        if (principal is Jwt) {
            val given = principal.getClaimAsString("given_name")
            val family = principal.getClaimAsString("family_name")
            val full = listOfNotNull(given, family).joinToString(" ").ifBlank {
                principal.getClaimAsString("name")
                    ?: principal.getClaimAsString("preferred_username")
                    ?: "Unknown"
            }
            val email = principal.getClaimAsString("email")
            return UserIdentity(full, email, avatarFor(full))
        }
        return UserIdentity("You There", null, 0)
    }

    fun name(): String = identity().name

    /** Deterministic avatar index 0..6 from the name, matching the frontend palette. */
    private fun avatarFor(name: String): Int {
        var h = 0
        for (c in name) h = (h * 31 + c.code) and 0x7fffffff
        return h % 7
    }
}
