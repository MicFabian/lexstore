package io.translad.common

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.context.annotation.Configuration
import org.springframework.stereotype.Component
import org.springframework.web.method.HandlerMethod
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
        val required = requiredRoles(handler)
        if (required.isEmpty()) access.assertMember(projectId) else access.assertRole(projectId, *required)
        return true
    }

    private fun requiredRoles(handler: Any): Array<out ContributorRole> {
        val method = handler as? HandlerMethod ?: return emptyArray()
        val onMethod = method.getMethodAnnotation(RequiresProjectRole::class.java)
        val onClass = method.beanType.getAnnotation(RequiresProjectRole::class.java)
        return (onMethod ?: onClass)?.value ?: emptyArray()
    }
}

@Configuration
class ProjectAccessConfig(private val interceptor: ProjectAccessInterceptor) : WebMvcConfigurer {
    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(interceptor).addPathPatterns("/api/**")
    }
}
