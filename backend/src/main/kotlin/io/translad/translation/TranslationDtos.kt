package io.translad.translation

import jakarta.validation.constraints.NotBlank

data class SaveTranslationRequest(
    val value: String?,
    val pluralOne: String? = null,
    /** untranslated | translated | fuzzy | proofread */
    @field:NotBlank val status: String,
)
