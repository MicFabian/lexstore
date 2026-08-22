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
    @Bean
    fun testFilterChain(http: HttpSecurity): SecurityFilterChain {
        http.csrf { it.disable() }
            .authorizeHttpRequests { it.anyRequest().permitAll() }
        return http.build()
    }
}
