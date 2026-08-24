package io.lexstore

import io.lexstore.org.AgentQuotaExceededException
import io.lexstore.org.CredentialResolver
import io.lexstore.org.OrganisationRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import java.time.Duration
import java.time.Instant

/**
 * The quota is what an agent plan means. If it does not stop at the limit, the
 * plan is a label.
 */
class AgentQuotaTest : IntegrationTestBase() {

    @Autowired private lateinit var resolver: CredentialResolver
    @Autowired private lateinit var organisations: OrganisationRepository

    private fun org() = organisations.findAll().first()

    @Test
    fun `use is refused once the quota is spent`() {
        val o = org().apply {
            agentPlan = "team"
            agentMonthlyQuota = 2
            agentUsedThisPeriod = 0
            agentPeriodStart = Instant.now()
        }
        organisations.save(o)

        resolver.chargeAgentUse(o.id)
        resolver.chargeAgentUse(o.id)
        assertThrows<AgentQuotaExceededException> { resolver.chargeAgentUse(o.id) }

        assertThat(organisations.findById(o.id).get().agentUsedThisPeriod).isEqualTo(2)
    }

    @Test
    fun `a new period starts the allowance over`() {
        val o = org().apply {
            agentPlan = "team"
            agentMonthlyQuota = 1
            agentUsedThisPeriod = 1
            agentPeriodStart = Instant.now().minus(Duration.ofDays(31))
        }
        organisations.save(o)

        // The period has rolled over, so the first call of the new one succeeds.
        resolver.chargeAgentUse(o.id)
        val after = organisations.findById(o.id).get()
        assertThat(after.agentUsedThisPeriod).isEqualTo(1)
        assertThat(after.agentPeriodStart).isAfter(Instant.now().minus(Duration.ofMinutes(1)))
    }

    @Test
    fun `an exhausted quota stops the call rather than being noticed after it`() {
        val o = org().apply {
            agentPlan = "team"
            agentMonthlyQuota = 1
            agentUsedThisPeriod = 1
            agentPeriodStart = Instant.now()
        }
        organisations.save(o)

        val mapType = object : org.springframework.core.ParameterizedTypeReference<Map<String, Any?>>() {}
        val ex = assertThrows<org.springframework.web.client.RestClientResponseException> {
            client.post().uri("/api/ai/translate")
                .body(
                    mapOf(
                        "sourceText" to "Quota probe",
                        "sourceLang" to "en",
                        "targetLang" to "de",
                        "projectId" to "35f54c71-131a-cc6e-aad2-f22b0eca789f",
                    ),
                )
                .retrieve().body(mapType)
        }
        // Either the quota refused it or the platform has no key to spend —
        // both are refusals rather than a translation charged to nobody.
        assertThat(ex.statusCode.value()).isIn(402, 503)
        assertThat(organisations.findById(o.id).get().agentUsedThisPeriod).isEqualTo(1)
    }

    @Test
    fun `an organisation on its own key is not metered`() {
        val o = org().apply {
            agentPlan = null
            agentMonthlyQuota = 0
            agentUsedThisPeriod = 0
        }
        organisations.save(o)

        // Charging is a no-op: their provider bills them directly.
        resolver.chargeAgentUse(o.id)
        assertThat(organisations.findById(o.id).get().agentUsedThisPeriod).isEqualTo(0)
    }
}
