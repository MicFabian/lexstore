package io.translad.ai

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

/** Project-independent AI translation surface: translate, request log, cache, settings. */
@RestController
@RequestMapping("/api/ai")
class AiController(private val service: AiTranslationService) {

    @PostMapping("/translate")
    fun translate(@Valid @RequestBody req: TranslateRequest): TranslateResponse = service.translate(req)

    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @GetMapping("/requests")
    fun requests(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int,
    ): List<RequestLogView> = service.requests(page, size.coerceIn(1, 200))

    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @GetMapping("/cache")
    fun cache(
        @RequestParam(required = false) q: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int,
    ): List<CacheEntryView> = service.cacheEntries(q, page, size.coerceIn(1, 200))

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
    fun settings(): AiSettingsView = service.settingsView()

    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @PutMapping("/settings")
    fun updateSettings(@RequestBody req: UpdateAiSettings): AiSettingsView = service.updateSettings(req)
}
