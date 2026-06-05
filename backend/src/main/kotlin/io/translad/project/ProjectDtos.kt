package io.translad.project

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
    val terms: Long,
    val langs: Int,
    val progress: Int,
    val untranslated: Long,
    val newTerms: Long,
    val updated: String?,
)

data class ProjectDetail(
    val id: UUID,
    val name: String,
    val code: String,
    val sourceLang: String,
    val mark: String,
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
    val name: String?,
    val mark: String?,
    val sourceLang: String?,
)
