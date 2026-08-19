package io.translad.feature

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import java.util.UUID

/** Coverage of one feature in one language. */
data class FeatureLanguageCoverage(
    val code: String,
    val name: String,
    val translated: Int,
    val fuzzy: Int,
    val untranslated: Int,
    val percent: Int,
)

/** A feature with its overall coverage across every project language. */
data class FeatureView(
    val id: UUID,
    val name: String,
    val key: String,
    val description: String?,
    val terms: Long,
    /** Translation slots (terms x languages) that are done. */
    val translated: Int,
    val fuzzy: Int,
    val untranslated: Int,
    val percent: Int,
    val languages: List<FeatureLanguageCoverage>,
)

/** One open string of a feature: what is missing, and in which language. */
data class OpenTranslationView(
    val termId: UUID,
    val key: String,
    val sourceText: String,
    val languageCode: String,
    val languageName: String,
    val status: String,
    val value: String?,
)

data class CreateFeatureRequest(
    @field:NotBlank val name: String,
    @field:Pattern(regexp = "[a-z0-9-]*", message = "Key must be lowercase letters, numbers, or hyphens")
    val key: String?,
    val description: String?,
)

data class UpdateFeatureRequest(
    val name: String?,
    val description: String?,
)

/** Move terms into a feature, or out of it when featureId is null. */
data class AssignTermsRequest(
    val termIds: List<UUID>,
)
