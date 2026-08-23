package io.lexstore.ai

import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

/**
 * AI translation surface: translate, request log, cache, settings.
 *
 * The cache and the request log span every project, which is deliberate — a
 * shared cache is what makes a repeated string free the second time. They
 * therefore carry source and translated text from all projects, so reading or
 * changing them is restricted to owners and admins, who already see every
 * project. Translating stays open to any member, since that is the work.
 *
 * This holds because Lexstore is one organisation with many projects. Serving
 * separate tenants would require partitioning both tables, and the cost of a
 * partitioned cache is that the same string is paid for once per tenant.
 */
@RestController
@RequestMapping("/api/ai")
class AiController(
    private val service: AiTranslationService,
    private val access: io.lexstore.common.ProjectAccess,
) {

    /**
     * The playground. An API key must name the project it is spending against,
     * so the call is attributed and charged like any other; a person may leave
     * it out and translate against the environment's configuration.
     */
    @PostMapping("/translate")
    fun translate(@Valid @RequestBody req: TranslateRequest): TranslateResponse {
        req.projectId?.let { access.assertMember(it) } ?: access.rejectApiKey(
            "An API key must include projectId when translating, so the cost is attributed.",
        )
        return service.translate(req)
    }

    /**
     * The log and the cache span every project, so an API key — which stands for
     * one project — must not read them. People see them under the roles they
     * already hold.
     */
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @GetMapping("/requests")
    fun requests(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int,
    ): List<RequestLogView> {
        access.rejectApiKey("The request log spans every project; read it as a person.")
        return service.requests(page, size.coerceIn(1, 200))
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @GetMapping("/cache")
    fun cache(
        @RequestParam(required = false) q: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int,
    ): List<CacheEntryView> {
        access.rejectApiKey("The cache spans every project; read it as a person.")
        return service.cacheEntries(q, page, size.coerceIn(1, 200))
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @GetMapping("/cache/stats")
    fun stats(): CacheStats = service.stats()

    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @DeleteMapping("/cache/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteEntry(@PathVariable id: UUID) = service.deleteCacheEntry(id)

    /** Invalidate every cached translation for a given source content. */
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @DeleteMapping("/cache")
    fun invalidate(
        @RequestParam(required = false) sourceText: String?,
        @RequestParam(defaultValue = "false") all: Boolean,
    ): Map<String, Any> {
        if (all) {
            service.clearCache()
            return mapOf("cleared" to "all")
        }
        require(!sourceText.isNullOrBlank()) { "Provide sourceText to invalidate, or all=true." }
        return mapOf("invalidated" to service.invalidateContent(sourceText))
    }

    @GetMapping("/settings")
    fun settings(): AiSettingsView {
        access.rejectApiKey("AI settings belong to the workspace, not to a key.")
        return service.settingsView()
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @PutMapping("/settings")
    fun updateSettings(@RequestBody req: UpdateAiSettings): AiSettingsView = service.updateSettings(req)
}
