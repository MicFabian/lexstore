package io.lexstore.org

import io.lexstore.project.ProjectRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

class AgentUnavailableException(message: String) : RuntimeException(message)

class AgentQuotaExceededException(used: Long, quota: Long) :
    RuntimeException("This organisation has used $used of $quota agent translations this month.")

/** Where a key came from, so the UI can say whose budget a translation spends. */
enum class CredentialSource { PROJECT, ORGANISATION, PLATFORM_AGENT, ENVIRONMENT }

data class ResolvedCredential(
    val provider: String,
    val apiKey: String,
    val source: CredentialSource,
    val orgId: UUID?,
)

@Service
class CredentialResolver(
    private val credentials: AiCredentialRepository,
    private val organisations: OrganisationRepository,
    private val projects: ProjectRepository,
    private val cipher: SecretCipher,
    @Value("\${anthropic.api-key:}") private val envAnthropic: String,
    @Value("\${gemini.api-key:}") private val envGemini: String,
    @Value("\${openai.api-key:}") private val envOpenai: String,
    @Value("\${lexstore.agent.anthropic-key:}") private val agentKey: String,
) {
    /**
     * Resolution order: the project's own key, then its organisation's, then
     * the platform agent if the organisation subscribes, then the environment.
     * A project key overrides the organisation for that project only.
     */
    @Transactional(readOnly = true)
    fun resolve(projectId: UUID?, provider: String): ResolvedCredential? {
        val orgId = projectId?.let { projects.findById(it).orElse(null)?.orgId }

        projectId?.let { pid ->
            credentials.findByProjectIdAndProvider(pid, provider)?.let {
                return ResolvedCredential(provider, cipher.decrypt(it.secretCipher), CredentialSource.PROJECT, orgId)
            }
        }
        orgId?.let { oid ->
            credentials.findByOrgIdAndProvider(oid, provider)?.let {
                return ResolvedCredential(provider, cipher.decrypt(it.secretCipher), CredentialSource.ORGANISATION, oid)
            }
        }
        val org = orgId?.let { organisations.findById(it).orElse(null) }
        if (org?.agentPlan != null) {
            if (agentKey.isBlank()) {
                throw AgentUnavailableException(
                    "This organisation is on the platform agent, but the platform has no " +
                        "provider key configured. Set LEXSTORE_AGENT_KEY, or store the " +
                        "organisation's own key.",
                )
            }
            return ResolvedCredential("claude", agentKey, CredentialSource.PLATFORM_AGENT, org.id)
        }
        val fromEnv = when (provider) {
            "claude" -> envAnthropic
            "gemini" -> envGemini
            "openai" -> envOpenai
            else -> ""
        }
        return fromEnv.takeIf { it.isNotBlank() }
            ?.let { ResolvedCredential(provider, it, CredentialSource.ENVIRONMENT, orgId) }
    }

    /** The organisation a project belongs to, for attributing work to it. */
    @Transactional(readOnly = true)
    fun orgOf(projectId: UUID?): UUID? =
        projectId?.let { projects.findById(it).orElse(null)?.orgId }

    /**
     * Charge one translation against the organisation's monthly allowance.
     * Only platform-agent traffic is metered — a key the customer supplied is
     * billed by the provider directly, and counting it here would be theatre.
     */
    @Transactional
    fun chargeAgentUse(orgId: UUID, units: Long = 1) {
        val org = organisations.findById(orgId).orElse(null) ?: return
        if (org.agentPlan == null) return

        val periodEnd = org.agentPeriodStart.plus(30, ChronoUnit.DAYS)
        if (Instant.now().isAfter(periodEnd)) {
            org.agentPeriodStart = Instant.now()
            org.agentUsedThisPeriod = 0
        }
        if (org.agentUsedThisPeriod + units > org.agentMonthlyQuota) {
            throw AgentQuotaExceededException(org.agentUsedThisPeriod, org.agentMonthlyQuota)
        }
        org.agentUsedThisPeriod += units
    }
}
