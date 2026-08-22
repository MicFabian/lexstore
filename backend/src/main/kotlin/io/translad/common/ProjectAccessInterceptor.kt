package io.translad.common

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.context.annotation.Configuration
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor
import org.springframework.web.servlet.HandlerMapping
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import java.util.UUID

@Component
class ProjectAccessInterceptor(private val access: ProjectAccess) : HandlerInterceptor {

    override fun preHandle(
        request: HttpServletRequest,
        response: HttpServletResponse,
        handler: Any,
    ): Boolean {
        @Suppress("UNCHECKED_CAST")
        val vars = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE)
            as? Map<String, String> ?: return true
        val raw = vars["projectId"] ?: return true
        val projectId = runCatching { UUID.fromString(raw) }.getOrNull() ?: return true
        access.assertMember(projectId)
        return true
    }
}

@Configuration
class ProjectAccessConfig(private val interceptor: ProjectAccessInterceptor) : WebMvcConfigurer {
    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(interceptor).addPathPatterns("/api/**")
    }
}
