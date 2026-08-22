package io.lexstore.contributor

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import java.util.UUID

data class ContributorView(
    val id: UUID,
    val name: String,
    val email: String,
    val role: String,
    val langs: List<String>,
    val avatar: Int,
    val active: String,
)

data class UpdateContributorRequest(
    val role: String?,
    val langs: List<String>?,
)

data class InviteContributorRequest(
    @field:NotBlank val name: String,
    @field:Email @field:NotBlank val email: String,
    val role: String? = null,
    val langs: List<String>? = null,
)
