package io.lexstore.org

import jakarta.validation.constraints.NotBlank
import java.util.UUID

data class OrganisationView(
    val id: UUID,
    val name: String,
    val slug: String,
    val projects: Long,
    val members: Long,
    val agent: AgentPlanView?,
)

data class AgentPlanView(
    val plan: String,
    val monthlyQuota: Long,
    val used: Long,
    val remaining: Long,
    val percentUsed: Int,
    val periodStart: String,
    val periodEnd: String,
)

data class OrgMemberView(
    val id: UUID,
    val name: String,
    val email: String,
    val role: String,
)

/** A stored provider key, never including the secret itself. */
data class CredentialView(
    val id: UUID,
    val provider: String,
    val label: String,
    val tail: String,
    val scope: String,
    val projectName: String?,
    val createdAt: String,
    val createdBy: String?,
)

data class SaveCredentialRequest(
    @field:NotBlank val provider: String,
    @field:NotBlank val apiKey: String,
    val label: String? = null,
    /** Null stores it for the organisation; set to override for one project. */
    val projectId: UUID? = null,
)

data class UpdateAgentPlanRequest(
    /** Null cancels the plan and returns the organisation to its own keys. */
    val plan: String?,
    val monthlyQuota: Long?,
)

/** What the agent has been used for, so spend is inspectable rather than a number. */
data class AgentActivityRow(
    val at: String,
    val projectName: String?,
    val languageCode: String?,
    val sourceText: String,
    val provider: String,
    val model: String,
    val cacheHit: Boolean,
    val inputTokens: Int,
    val outputTokens: Int,
    val status: String,
)

data class UsageSummary(
    val totalRequests: Long,
    val cacheHits: Long,
    val cacheHitRate: Int,
    val inputTokens: Long,
    val outputTokens: Long,
    val failures: Long,
    val byProvider: List<ProviderUsage>,
    val byDay: List<DailyUsage>,
)

data class ProviderUsage(
    val provider: String,
    val requests: Long,
    val inputTokens: Long,
    val outputTokens: Long,
)

data class DailyUsage(val day: String, val requests: Long, val tokens: Long)
