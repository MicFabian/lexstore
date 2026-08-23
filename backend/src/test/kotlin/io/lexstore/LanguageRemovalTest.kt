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
