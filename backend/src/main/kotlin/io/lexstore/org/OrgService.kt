package io.lexstore.org

import io.lexstore.ai.TranslationRequestRepository
import io.lexstore.common.CurrentUser
import io.lexstore.common.RelativeTime
import io.lexstore.project.ProjectRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

class CredentialNotFoundException(id: UUID) : RuntimeException("No stored key with id $id.")

private const val MAX_ACTIVITY_ROWS = 200
private val DAY: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy").withZone(ZoneOffset.UTC)

@Service
@Transactional(readOnly = true)
class OrgService(
    private val organisations: OrganisationRepository,
    private val members: OrgMemberRepository,
    private val credentials: AiCredentialRepository,
    private val projects: ProjectRepository,
    private val requests: TranslationRequestRepository,
    private val cipher: SecretCipher,
    private val access: OrgAccess,
    private val currentUser: CurrentUser,
) {
    fun current(): OrganisationView {
        val orgId = access.currentOrgId()
        access.assertMember(orgId)
        val org = organisations.findById(orgId).orElseThrow { OrgAccessDeniedException("Unknown organisation.") }
        return OrganisationView(
            id = org.id,
            name = org.name,
            slug = org.slug,
            projects = projects.countByOrgId(org.id),
            members = members.findByOrgIdOrderByName(org.id).size.toLong(),
            agent = agentView(org),
        )
    }

    fun members(): List<OrgMemberView> {
        val orgId = access.currentOrgId()
        access.assertMember(orgId)
        return members.findByOrgIdOrderByName(orgId)
            .map { OrgMemberView(it.id, it.name, it.email, it.role) }
    }

    /** Stored keys, organisation-wide and per project, never the secrets. */
    fun credentials(): List<CredentialView> {
        val orgId = access.currentOrgId()
        access.assertAdmin(orgId)
        val projectNames = projects.findAll().filter { it.orgId == orgId }.associate { it.id to it.name }
        val orgLevel = credentials.findByOrgId(orgId)
        val projectLevel = projectNames.keys.flatMap { credentials.findByProjectId(it) }
        return (orgLevel + projectLevel).map { c ->
            CredentialView(
                id = c.id,
                provider = c.provider,
                label = c.label,
                tail = c.tail,
                scope = if (c.projectId != null) "project" else "organisation",
                projectName = c.projectId?.let { projectNames[it] },
                createdAt = RelativeTime.format(c.createdAt),
                createdBy = c.createdBy,
            )
        }
    }

    @Transactional
    fun saveCredential(req: SaveCredentialRequest): CredentialView {
        val orgId = access.currentOrgId()
        access.assertAdmin(orgId)
        require(cipher.configured) {
            "No encryption key is configured, so provider keys cannot be stored. Set LEXSTORE_SECRET_KEY."
        }
        val provider = req.provider.trim().lowercase()
        require(provider in setOf("claude", "openai", "gemini")) {
            "Unknown provider '$provider'. Use claude, openai, or gemini."
        }
        val secret = req.apiKey.trim()
        require(secret.length >= 8) { "That does not look like an API key." }

        req.projectId?.let { pid ->
            val project = projects.findById(pid).orElseThrow { CredentialNotFoundException(pid) }
            require(project.orgId == orgId) { "That project belongs to another organisation." }
        }

        // One key per provider and scope: saving again replaces the old one.
        // Scope-specific: a project override must not resolve to, and then
        // overwrite, the organisation's key when the project has none yet.
        val existing = if (req.projectId != null) {
            credentials.findByProjectIdAndProvider(req.projectId, provider)
        } else {
            credentials.findByOrgIdAndProvider(orgId, provider)
        }

        val saved = (existing ?: AiCredential(
            orgId = if (req.projectId == null) orgId else null,
            projectId = req.projectId,
            provider = provider,
            secretCipher = "",
        )).apply {
            secretCipher = cipher.encrypt(secret)
            tail = secret.takeLast(4)
            label = req.label?.trim().orEmpty()
            createdBy = currentUser.identity().name
        }
        credentials.save(saved)

        val projectName = req.projectId?.let { projects.findById(it).orElse(null)?.name }
        return CredentialView(
            saved.id, provider, saved.label, saved.tail,
            if (req.projectId != null) "project" else "organisation",
            projectName, RelativeTime.format(saved.createdAt), saved.createdBy,
        )
    }

    @Transactional
    fun deleteCredential(id: UUID) {
        val orgId = access.currentOrgId()
        access.assertAdmin(orgId)
        val cred = credentials.findById(id).orElseThrow { CredentialNotFoundException(id) }
        val belongs = cred.orgId == orgId ||
            cred.projectId?.let { projects.findById(it).orElse(null)?.orgId } == orgId
        require(belongs) { "That key belongs to another organisation." }
        credentials.delete(cred)
    }

    @Transactional
    fun updateAgentPlan(req: UpdateAgentPlanRequest): OrganisationView {
        val orgId = access.currentOrgId()
        access.assertAdmin(orgId)
        val org = organisations.findById(orgId).orElseThrow { OrgAccessDeniedException("Unknown organisation.") }
        org.agentPlan = req.plan?.trim()?.takeIf { it.isNotBlank() }
        req.monthlyQuota?.let { org.agentMonthlyQuota = it.coerceAtLeast(0) }
        if (org.agentPlan == null) {
            org.agentUsedThisPeriod = 0
        }
        return current()
    }

    /** What the organisation's AI spend was used for, newest first. */
    fun activity(limit: Int = 50): List<AgentActivityRow> {
        val orgId = access.currentOrgId()
        access.assertMember(orgId)
        val projectNames = projects.findAll().associate { it.id to it.name }
        return requests
            .findByOrgIdOrderByCreatedAtDesc(orgId, PageRequest.of(0, limit.coerceIn(1, MAX_ACTIVITY_ROWS)))
            .map { r ->
                AgentActivityRow(
                    at = RelativeTime.format(r.createdAt),
                    projectName = r.projectId?.let { projectNames[it] },
                    languageCode = r.targetLang,
                    sourceText = r.sourceText.take(120),
                    provider = r.provider,
                    model = r.model,
                    cacheHit = r.cacheHit,
                    inputTokens = r.inputTokens,
                    outputTokens = r.outputTokens,
                    status = r.status,
                )
            }
    }

    fun usage(days: Int = 30): UsageSummary {
        val orgId = access.currentOrgId()
        access.assertMember(orgId)
        val since = Instant.now().minus(Duration.ofDays(days.coerceIn(1, 365).toLong()))
        val totals = requests.totalsSince(orgId, since)
        val hitRate = if (totals.requests == 0L) 0 else ((totals.hits * 100.0) / totals.requests).toInt()
        return UsageSummary(
            totalRequests = totals.requests,
            cacheHits = totals.hits,
            cacheHitRate = hitRate,
            inputTokens = totals.inputTokens,
            outputTokens = totals.outputTokens,
            failures = totals.failures,
            byProvider = requests.usageByProvider(orgId, since)
                .map { ProviderUsage(it.provider, it.requests, it.inputTokens, it.outputTokens) },
            byDay = requests.usageByDay(orgId, since)
                .map { DailyUsage(it.day.toString(), it.requests, it.tokens) },
        )
    }

    private fun agentView(org: Organisation): AgentPlanView? {
        val plan = org.agentPlan ?: return null
        val end = org.agentPeriodStart.plus(Duration.ofDays(30))
        val remaining = (org.agentMonthlyQuota - org.agentUsedThisPeriod).coerceAtLeast(0)
        val pct = if (org.agentMonthlyQuota == 0L) 0
        else ((org.agentUsedThisPeriod * 100.0) / org.agentMonthlyQuota).toInt()
        return AgentPlanView(
            plan = plan,
            monthlyQuota = org.agentMonthlyQuota,
            used = org.agentUsedThisPeriod,
            remaining = remaining,
            percentUsed = pct,
            periodStart = DAY.format(org.agentPeriodStart),
            periodEnd = DAY.format(end),
        )
    }
}
