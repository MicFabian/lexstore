package io.lexstore

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.core.ParameterizedTypeReference
import org.springframework.web.client.HttpClientErrorException

private const val MOSAIC_WEB = "35f54c71-131a-cc6e-aad2-f22b0eca789f"

class ConcurrentEditTest : IntegrationTestBase() {

    private val mapType = object : ParameterizedTypeReference<Map<String, Any?>>() {}

    private fun firstRow(): Map<String, Any?> {
        @Suppress("UNCHECKED_CAST")
        val rows = client.get().uri("/api/projects/$MOSAIC_WEB/languages/de/translations")
            .retrieve().body(mapType)!!["rows"] as List<Map<String, Any?>>
        return rows.first()
    }

    @Test
    fun `a save carrying a stale version is refused instead of overwriting`() {
        val row = firstRow()
        val termId = row["id"] as String
        val staleVersion = row["version"] as? Int ?: 0

        client.put().uri("/api/projects/$MOSAIC_WEB/languages/de/translations/$termId")
            .body(mapOf("value" to "Erste Fassung", "status" to "translated", "version" to staleVersion))
            .retrieve().toBodilessEntity()

        val ex = assertThrows<HttpClientErrorException.Conflict> {
            client.put().uri("/api/projects/$MOSAIC_WEB/languages/de/translations/$termId")
                .body(mapOf("value" to "Zweite Fassung", "status" to "translated", "version" to staleVersion))
                .retrieve().toBodilessEntity()
        }
        assertThat(ex.responseBodyAsString).contains("Someone else saved")

        val after = firstRow()
        assertThat(after["target"]).isEqualTo("Erste Fassung")
    }

    @Test
    fun `a save carrying the current version succeeds`() {
        val row = firstRow()
        val termId = row["id"] as String
        client.put().uri("/api/projects/$MOSAIC_WEB/languages/de/translations/$termId")
            .body(mapOf("value" to "Neu", "status" to "translated", "version" to (row["version"] as? Int ?: 0)))
            .retrieve().toBodilessEntity()

        val fresh = firstRow()
        assertThat(fresh["target"]).isEqualTo("Neu")
        client.put().uri("/api/projects/$MOSAIC_WEB/languages/de/translations/$termId")
            .body(mapOf("value" to "Noch neuer", "status" to "translated", "version" to fresh["version"]))
            .retrieve().toBodilessEntity()
        assertThat(firstRow()["target"]).isEqualTo("Noch neuer")
    }

    @Test
    fun `a save without a version still works for scripted callers`() {
        val termId = firstRow()["id"] as String
        client.put().uri("/api/projects/$MOSAIC_WEB/languages/de/translations/$termId")
            .body(mapOf("value" to "Ohne Version", "status" to "translated"))
            .retrieve().toBodilessEntity()
        assertThat(firstRow()["target"]).isEqualTo("Ohne Version")
    }
}
