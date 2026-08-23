package io.lexstore.apikey

import io.lexstore.common.ApiKeyScope
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.security.MessageDigest
import java.util.UUID

/**
 * Authentication carried by an API key rather than a person's token.
 *
 * A key is scoped either to one project or to an organisation; the principal
 * carries whichever it is, and nothing outside that scope can be reached.
 */
class ApiKeyAuthentication(
    val projectId: UUID?,
    val orgId: UUID?,
    val keyId: UUID,
    val label: String,
    val scope: ApiKeyScope,
) : AbstractAuthenticationToken(
    buildList {
        add(SimpleGrantedAuthority("ROLE_API_KEY"))
        // A read-only key gets no writing role, so @PreAuthorize refuses it the
        // same way it refuses a person without the role.
        if (scope == ApiKeyScope.READ_WRITE) add(SimpleGrantedAuthority("ROLE_TRANSLATOR"))
    },
) {
    init {
        isAuthenticated = true
    }

    override fun getCredentials(): Any = ""
    override fun getPrincipal(): Any = this
    override fun getName(): String = label
}

@Component
class ApiKeyAuthFilter(
    private val keys: ApiKeyRepository,
    private val usage: ApiKeyUsageRecorder,
) : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        chain: FilterChain,
    ) {
        val presented = request.getHeader("X-API-Key")?.trim()
        if (!presented.isNullOrBlank() && SecurityContextHolder.getContext().authentication == null) {
            keys.findBySecretHash(sha256(presented))?.let { key ->
                SecurityContextHolder.getContext().authentication =
                    ApiKeyAuthentication(key.projectId, key.orgId, key.id, key.label, key.scope)
                usage.record(key.id, key.lastUsedAt)
            }
        }
        chain.doFilter(request, response)
    }

    private fun sha256(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray())
            .joinToString("") { "%02x".format(it) }
}
