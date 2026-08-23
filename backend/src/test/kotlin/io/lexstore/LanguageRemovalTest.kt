package io.lexstore

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.core.ParameterizedTypeReference

private const val MOSAIC_WEB = "35f54c71-131a-cc6e-aad2-f22b0eca789f"

/**
 * Translations referenced a language by code rather than by row, so deleting a
 * language left them behind and adding the same code back resurrected them.
 */
class LanguageRemovalTest : IntegrationTestBase() {

    private val mapType = object : ParameterizedTypeReference<Map<String, Any?>>() {}

    private fun translatedCount(lang: String): Int {
        @Suppress("UNCHECKED_CAST")
        val rows = client.get().uri("/api/projects/$MOSAIC_WEB/languages/$lang/translations?size=200")
            .retrieve().body(mapType)!!["rows"] as List<Map<String, Any?>>
        return rows.count { !(it["target"] as? String).isNullOrBlank() }
    }

    @Test
    fun `re-adding a removed language starts it empty`() {
        assertThat(translatedCount("de")).isGreaterThan(0)

        client.delete().uri("/api/projects/$MOSAIC_WEB/languages/de").retrieve().toBodilessEntity()
        client.post().uri("/api/projects/$MOSAIC_WEB/languages")
            .body(mapOf("code" to "de", "name" to "German"))
            .retrieve().toBodilessEntity()

        assertThat(translatedCount("de")).isZero()
    }

    @Test
    fun `removing one language leaves the others alone`() {
        val frenchBefore = translatedCount("fr")
        client.delete().uri("/api/projects/$MOSAIC_WEB/languages/de").retrieve().toBodilessEntity()
        assertThat(translatedCount("fr")).isEqualTo(frenchBefore)
    }
}

/** Codes reach URLs and translation providers, so they are checked at the edge. */
class LanguageValidationTest : IntegrationTestBase() {

    @Test
    fun `a language code that is not a language tag is refused`() {
        org.junit.jupiter.api.assertThrows<org.springframework.web.client.HttpClientErrorException.BadRequest> {
            client.post().uri("/api/projects/$MOSAIC_WEB/languages")
                .body(mapOf("code" to "not a code!!", "name" to "Nonsense"))
                .retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `a real tag is still accepted`() {
        client.post().uri("/api/projects/$MOSAIC_WEB/languages")
            .body(mapOf("code" to "zh-Hans", "name" to "Chinese (Simplified)"))
            .retrieve().toBodilessEntity()
    }

    @Test
    fun `a contributor cannot be scoped to a language the project lacks`() {
        val ex = org.junit.jupiter.api.assertThrows<org.springframework.web.client.HttpClientErrorException.BadRequest> {
            client.post().uri("/api/projects/$MOSAIC_WEB/contributors")
                .body(
                    mapOf(
                        "name" to "Probe",
                        "email" to "probe@lexstore.io",
                        "role" to "Translator",
                        "langs" to listOf("zz-NOPE"),
                    ),
                )
                .retrieve().toBodilessEntity()
        }
        assertThat(ex.responseBodyAsString).contains("zz-NOPE")
    }
}
