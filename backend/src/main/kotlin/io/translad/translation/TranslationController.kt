package io.translad.translation

import io.translad.term.EditorResponse
import io.translad.term.EditorRow
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
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

    /** GET the full editor view for one language: every term + its translation. */
    @GetMapping
    fun list(@PathVariable projectId: UUID, @PathVariable code: String): EditorResponse =
        service.editor(projectId, code)

    /** PUT is an idempotent upsert of the translation for (term, language). */
    @PutMapping("/{termId}")
    fun upsert(
        @PathVariable projectId: UUID,
        @PathVariable code: String,
        @PathVariable termId: UUID,
        @Valid @RequestBody req: SaveTranslationRequest,
    ): EditorRow = service.save(projectId, termId, code, req)
}
