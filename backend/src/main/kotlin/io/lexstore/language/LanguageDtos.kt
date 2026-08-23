package io.lexstore.language

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
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
    /**
     * A BCP-47 style tag. The code travels in URLs and goes to translation
     * providers as the target language, so free text would reach both.
     */
    @field:NotBlank
    @field:Size(max = 16)
    @field:Pattern(
        regexp = "[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*",
        message = "must be a language tag such as de, pt-BR or zh-Hans",
    )
    val code: String,
    @field:NotBlank @field:Size(max = 128) val name: String,
)
