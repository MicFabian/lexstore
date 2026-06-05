package io.translad.apikey

import jakarta.validation.constraints.NotBlank
import java.util.UUID

data class ApiKeyView(
    val id: UUID,
    val label: String,
    val prefix: String,
    val tail: String,
    val scope: String,
    val created: String,
    val used: String,
    val test: Boolean,
)

/** Returned only once, immediately after generation, with the full secret. */
data class ApiKeyCreated(
    val id: UUID,
    val label: String,
    val secret: String,
    val scope: String,
)

data class GenerateApiKeyRequest(
    @field:NotBlank val label: String,
    /** "Read only" | "Read & write" */
    val scope: String? = null,
    val test: Boolean = false,
)
