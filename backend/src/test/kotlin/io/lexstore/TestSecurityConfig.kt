package io.lexstore

import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.SecurityFilterChain

/**
 * In tests, permit everything and skip method security so the existing
 * RestClient-based integration tests run unauthenticated. Activated by the
 * `test` profile (the production SecurityConfig is `@Profile("!test")`), and
 * RBAC itself is covered separately in {@link RbacTest} with mock JWTs.
 */
@TestConfiguration
class TestSecurityConfig {
    /**
     * The API-key filter runs here too. Without it a request carrying a key
     * would arrive unauthenticated, which the access checks treat as a platform
     * admin — and every API-key restriction would pass its test while being
     * inert in production.
     */
    @Bean
    fun testFilterChain(
        http: HttpSecurity,
        apiKeyAuthFilter: io.lexstore.apikey.ApiKeyAuthFilter,
    ): SecurityFilterChain {
        http.csrf { it.disable() }
            .authorizeHttpRequests { it.anyRequest().permitAll() }
            .addFilterBefore(
                apiKeyAuthFilter,
                org.springframework.security.web.authentication.AnonymousAuthenticationFilter::class.java,
            )
        return http.build()
    }
}
