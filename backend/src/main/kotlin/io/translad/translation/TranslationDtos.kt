package io.translad.translation

import jakarta.validation.constraints.NotBlank

data class SaveTranslationRequest(
    val value: String?,
    val pluralOne: String? = null,
    /** untranslated | translated | fuzzy | proofread */
    @field:NotBlank val status: String,
    /** Who is making the change (no auth yet — defaults to the signed-in placeholder). */
    val authorName: String? = null,
    val authorAvatar: Int? = null,
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
