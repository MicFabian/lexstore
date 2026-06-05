package io.translad.common

import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.CorsRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class WebConfig : WebMvcConfigurer {
    override fun addCorsMappings(registry: CorsRegistry) {
        // Allow any localhost port in development (Angular dev server may bind 4200, 4300, …).
        registry.addMapping("/api/**")
            .allowedOriginPatterns("http://localhost:[*]", "http://127.0.0.1:[*]")
            .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
    }
}
