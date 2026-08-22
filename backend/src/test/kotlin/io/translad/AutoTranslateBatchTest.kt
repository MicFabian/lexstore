package io.translad

import io.translad.ai.AiTranslationService
import io.translad.ai.TranslateRequest
import io.translad.ai.TranslateResponse
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.springframework.core.ParameterizedTypeReference
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean

private const val MOSAIC_WEB = "35f54c71-131a-cc6e-aad2-f22b0eca789f"

class AutoTranslateBatchTest : IntegrationTestBase() {

    @MockitoSpyBean
    private lateinit var ai: AiTranslationService

    private val mapType = object : ParameterizedTypeReference<Map<String, Any?>>() {}

    private fun getMap(path: String): Map<String, Any?> =
        client.get().uri(path).retrieve().body(mapType)!!

    private fun translatedCount(): Int {
        @Suppress("UNCHECKED_CAST")
        val rows = getMap("/api/projects/$MOSAIC_WEB/languages/nl/translations")["rows"]
            as List<Map<String, Any?>>
        return rows.count { !(it["target"] as? String).isNullOrBlank() }
    }

    @Test
    fun `a provider failure part way through keeps the translations already paid for`() {
        var calls = 0
        org.mockito.Mockito.doAnswer { invocation ->
            calls++
            if (calls == 3) throw RuntimeException("provider exploded")
            invocation.callRealMethod() as TranslateResponse
        }.`when`(ai).translate(any<TranslateRequest>())

        val before = translatedCount()
        val result = client.post()
            .uri("/api/projects/$MOSAIC_WEB/languages/nl/translations/auto")
            .retrieve().body(mapType)!!

        assertThat(result["failed"]).isEqualTo(1)
        val translated = result["translated"] as Int
        assertThat(translated).isGreaterThan(0)
        assertThat(translatedCount()).isEqualTo(before + translated)
    }

    @Test
    fun `a clean batch commits every translation it made`() {
        val before = translatedCount()
        val result = client.post()
            .uri("/api/projects/$MOSAIC_WEB/languages/nl/translations/auto")
            .retrieve().body(mapType)!!
        val translated = result["translated"] as Int
        assertThat(translated).isGreaterThan(0)
        assertThat(result["remaining"] as Int).isGreaterThanOrEqualTo(0)
        assertThat(translatedCount()).isEqualTo(before + translated)
    }
}
