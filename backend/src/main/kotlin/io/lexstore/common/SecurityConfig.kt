package io.lexstore.common

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.convert.converter.Converter
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter
import org.springframework.security.web.SecurityFilterChain
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
@EnableMethodSecurity
@org.springframework.context.annotation.Profile("!test")
class SecurityConfig(
    /** Comma-separated origin patterns; local dev by default. */
    @Value("\${lexstore.allowed-origins:http://localhost:[*],http://127.0.0.1:[*]}")
    private val allowedOrigins: String,
    /** The OIDC client this API accepts tokens for. */
    @Value("\${lexstore.client-id:lexstore-spa}")
    private val clientId: String,
    @Value("\${spring.security.oauth2.resourceserver.jwt.issuer-uri}")
    private val issuerUri: String,
    private val apiKeyAuthFilter: io.lexstore.apikey.ApiKeyAuthFilter,
) {

    /**
     * Keycloak issues these tokens without an `aud` claim, so the audience is
     * carried by `azp`: a token minted for a different client of the same
     * realm carries matching realm roles and would otherwise be accepted here.
     */
    @Bean
    fun jwtDecoder(): org.springframework.security.oauth2.jwt.JwtDecoder {
        val decoder = org.springframework.security.oauth2.jwt.JwtDecoders
            .fromIssuerLocation(issuerUri) as org.springframework.security.oauth2.jwt.NimbusJwtDecoder
        val withIssuer = org.springframework.security.oauth2.core.OAuth2TokenValidator<
            org.springframework.security.oauth2.jwt.Jwt,
            > { jwt ->
            val authorized = jwt.getClaimAsString("azp") ?: jwt.audience?.firstOrNull()
            if (authorized == clientId) {
                org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.success()
            } else {
                org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.failure(
                    org.springframework.security.oauth2.core.OAuth2Error(
                        "invalid_token",
                        "The token was not issued for this application.",
                        null,
                    ),
                )
            }
        }
        decoder.setJwtValidator(
            org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator(
                org.springframework.security.oauth2.jwt.JwtValidators.createDefaultWithIssuer(issuerUri),
                withIssuer,
            ),
        )
        return decoder
    }

    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .cors { it.configurationSource(corsConfigurationSource()) }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { auth ->
                auth
                    .requestMatchers("/actuator/**", "/api/dev/**").permitAll()
                    // Public reads keep the demo usable; writes require auth + roles (@PreAuthorize).
                    .anyRequest().authenticated()
            }
            .oauth2ResourceServer { rs ->
                rs.jwt { it.jwtAuthenticationConverter(jwtAuthConverter()) }
            }
            // Runs before the bearer-token filter so a request carrying only an
            // X-API-Key is authenticated rather than rejected.
            .addFilterBefore(
                apiKeyAuthFilter,
                org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter::class.java,
            )
        return http.build()
    }

    /** Map Keycloak `realm_access.roles` into Spring `ROLE_*` authorities. */
    private fun jwtAuthConverter(): Converter<Jwt, AbstractAuthenticationToken> {
        val scopes = JwtGrantedAuthoritiesConverter()
        val converter = JwtAuthenticationConverter()
        converter.setJwtGrantedAuthoritiesConverter { jwt ->
            val fromScopes: Collection<GrantedAuthority> = scopes.convert(jwt) ?: emptyList()
            @Suppress("UNCHECKED_CAST")
            val realm = jwt.getClaimAsMap("realm_access") as? Map<String, Any> ?: emptyMap()
            val roles = (realm["roles"] as? Collection<*>)?.filterIsInstance<String>().orEmpty()
            val roleAuthorities = roles.map { SimpleGrantedAuthority("ROLE_${it.uppercase()}") }
            (fromScopes + roleAuthorities)
        }
        return converter
    }

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        // Deployments name their own origins; the default covers local dev only.
        val patterns = allowedOrigins.split(",").map(String::trim).filter(String::isNotEmpty)
        val cfg = CorsConfiguration().apply {
            allowedOriginPatterns = patterns
            allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = true
        }
        return UrlBasedCorsConfigurationSource().apply { registerCorsConfiguration("/**", cfg) }
    }
}
