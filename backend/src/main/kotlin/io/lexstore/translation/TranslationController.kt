package io.lexstore.translation

import io.lexstore.term.EditorResponse
import io.lexstore.term.EditorRow
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

/** Full translation audit history for a single term, across all languages. */
@RestController
@RequestMapping("/api/projects/{projectId}/terms/{termId}/history")
class TermHistoryController(private val service: EditorService) {
    @GetMapping
    fun history(
        @PathVariable projectId: UUID,
        @PathVariable termId: UUID,
    ): List<TranslationHistoryEntry> = service.history(projectId, termId)
}

/**
 * Translations as a sub-resource of a language. The collection
 * `…/languages/{code}/translations` is the editor view (one entry per term);
 * an individual translation is addressed by its term under that language.
 */
@RestController
@RequestMapping("/api/projects/{projectId}/languages/{code}/translations")
class TranslationController(private val service: EditorService) {

    /** GET one page of the editor for a language, filtered server-side. */
    @GetMapping
    fun list(
        @PathVariable projectId: UUID,
        @PathVariable code: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "100") size: Int,
        @RequestParam(required = false) status: String?,
        @RequestParam(required = false) q: String?,
        @RequestParam(required = false) featureId: UUID?,
    ): EditorResponse = service.editor(projectId, code, page, size, status, q, featureId)

    /** PUT is an idempotent upsert of the translation for (term, language). */
    @PutMapping("/{termId}")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','TRANSLATOR','PROOFREADER')")
    @io.lexstore.common.RequiresProjectRole(io.lexstore.common.ContributorRole.OWNER, io.lexstore.common.ContributorRole.ADMIN, io.lexstore.common.ContributorRole.TRANSLATOR, io.lexstore.common.ContributorRole.PROOFREADER)
    fun upsert(
        @PathVariable projectId: UUID,
        @PathVariable code: String,
        @PathVariable termId: UUID,
        @Valid @RequestBody req: SaveTranslationRequest,
    ): EditorRow = service.save(projectId, termId, code, req)

    /** Review the stored translation of one term. Nothing is changed. */
    @GetMapping("/{termId}/proofread")
    fun proofread(
        @PathVariable projectId: UUID,
        @PathVariable code: String,
        @PathVariable termId: UUID,
    ): io.lexstore.ai.ProofreadResult = service.proofread(projectId, termId, code)

    /** AI machine-translation suggestion for one term (cached, not saved). */
    @org.springframework.web.bind.annotation.GetMapping("/{termId}/suggestion")
    fun suggestion(
        @PathVariable projectId: UUID,
        @PathVariable code: String,
        @PathVariable termId: UUID,
    ): SuggestionResponse = service.suggest(projectId, termId, code)

    /** Auto-translate every untranslated term in this language. */
    @org.springframework.web.bind.annotation.PostMapping("/auto")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','TRANSLATOR')")
    @io.lexstore.common.RequiresProjectRole(io.lexstore.common.ContributorRole.OWNER, io.lexstore.common.ContributorRole.ADMIN, io.lexstore.common.ContributorRole.TRANSLATOR)
    fun auto(
        @PathVariable projectId: UUID,
        @PathVariable code: String,
    ): AutoTranslateResult = service.autoTranslate(projectId, code)
}
