package io.lexstore

import io.lexstore.ai.AiSettingsRepository
import io.lexstore.ai.AiTranslationService
import io.lexstore.org.Organisation
import io.lexstore.org.OrganisationRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

/**
 * AI settings were one row for the whole instance. With organisations that let
 * one of them change the provider, model and cache policy for every other.
 */
class AiSettingsScopeTest : IntegrationTestBase() {

    @Autowired private lateinit var ai: AiTranslationService
    @Autowired private lateinit var settings: AiSettingsRepository
    @Autowired private lateinit var organisations: OrganisationRepository

    @Test
    fun `each organisation configures its own provider`() {
        val first = organisations.findAll().first()
        val second = organisations.save(Organisation(name = "Second", slug = "second-${System.nanoTime()}"))

        val a = ai.settingsFor(first.id)
        val b = ai.settingsFor(second.id)
        assertThat(a.id).isNotEqualTo(b.id)

        a.provider = "claude"
        settings.save(a)

        // Changing one leaves the other on its own value.
        assertThat(ai.settingsFor(second.id).provider).isEqualTo("mock")
    }

    @Test
    fun `an organisation without settings gets defaults rather than nothing`() {
        val fresh = organisations.save(Organisation(name = "Fresh", slug = "fresh-${System.nanoTime()}"))
        val s = ai.settingsFor(fresh.id)
        assertThat(s.provider).isEqualTo("mock")
        assertThat(s.cacheTtlHours).isGreaterThan(0)
    }
}
