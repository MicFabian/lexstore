package io.lexstore.project

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import java.util.UUID

/** Dashboard card / summary view with computed progress + counts. */
data class ProjectSummary(
    val id: UUID,
    val name: String,
    val code: String,
    val sourceLang: String,
    val mark: String,
    /**
     * Where the project's image can be fetched, not the image itself: it is a
     * data URI of up to 512 KB and the dashboard shows it at 28 pixels, so
     * inlining it made every listing carry megabytes it draws as an icon.
     */
    val imageUrl: String?,
    val terms: Long,
    val langs: Int,
    val progress: Int,
    val untranslated: Long,
    val newTerms: Long,
    val needsReview: Long,
    val updated: String?,
)

data class ProjectDetail(
    val id: UUID,
    val name: String,
    val code: String,
    val sourceLang: String,
    val mark: String,
    val image: String?,
    val translationContext: String?,
    val terms: Long,
)

data class CreateProjectRequest(
    @field:NotBlank val name: String,
    @field:NotBlank
    @field:Pattern(regexp = "[a-z0-9-]+", message = "Slug must be lowercase letters, numbers, or hyphens")
    val code: String,
    val sourceLang: String? = null,
    val mark: String? = null,
)

data class UpdateProjectRequest(
    @field:jakarta.validation.constraints.Size(max = 255) val name: String?,
    val mark: String?,
    val sourceLang: String?,
    /** Data URI of the uploaded image; blank clears it back to the color mark. */
    val image: String?,
    val translationContext: String?,
)
