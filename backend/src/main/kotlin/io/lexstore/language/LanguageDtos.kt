package io.lexstore.language

import jakarta.validation.constraints.NotBlank
import java.util.UUID

data class LanguageView(
    val id: UUID,
    val code: String,
    val name: String,
    /** Percent of terms translated/proofread in this language. */
    val translated: Int,
    val fuzzy: Int,
    val untranslated: Int,
    val contributors: Int,
)

data class AddLanguageRequest(
    @field:NotBlank val code: String,
    @field:NotBlank val name: String,
)
