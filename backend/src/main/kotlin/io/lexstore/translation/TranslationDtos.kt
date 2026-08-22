package io.lexstore.translation

import jakarta.validation.constraints.NotBlank

data class SaveTranslationRequest(
    val value: String?,
    val pluralOne: String? = null,
    /** untranslated | translated | fuzzy | proofread */
    @field:NotBlank val status: String,
    /**
     * Version the client last saw. When it is older than the stored row the
     * save is refused, so a slower editor cannot silently overwrite a newer
     * translation. Omitted means "no opinion", which keeps single-editor and
     * scripted callers working.
     */
    val version: Long? = null,
)

data class SuggestionResponse(
    val text: String,
    val provider: String,
    val model: String,
    val cacheHit: Boolean,
)

data class AutoTranslateResult(
    val translated: Int,
    val status: String,
    val failed: Int = 0,
    val remaining: Int = 0,
)

/** One audit entry in a term's translation history, newest first. */
data class TranslationHistoryEntry(
    val languageCode: String,
    val action: String,
    val oldValue: String?,
    val newValue: String?,
    val oldStatus: String?,
    val newStatus: String,
    val authorName: String,
    val authorAvatar: Int,
    val at: String,
)
