package io.lexstore

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.core.ParameterizedTypeReference

private const val MOSAIC_WEB = "35f54c71-131a-cc6e-aad2-f22b0eca789f"

/**
 * An import changes translations, so it must appear in the history like any
 * other change. Before this it did not, and a value could differ from what
 * anyone remembered with nothing to show for it.
 */
class ImportAuditTest : IntegrationTestBase() {

    private val mapType = object : ParameterizedTypeReference<Map<String, Any?>>() {}
    private val listType = object : ParameterizedTypeReference<List<Map<String, Any?>>>() {}

    @Test
    fun `an import shows up in the term's history, with who did it`() {
        @Suppress("UNCHECKED_CAST")
        val rows = client.get().uri("/api/projects/$MOSAIC_WEB/languages/de/translations?q=nav.dashboard")
            .retrieve().body(mapType)!!["rows"] as List<Map<String, Any?>>
        val termId = rows.first()["id"] as String

        client.post().uri("/api/projects/$MOSAIC_WEB/import?lang=de")
            .body(mapOf("nav.dashboard" to "Übersicht aus einem Import"))
            .retrieve().toBodilessEntity()

        val history = client.get().uri("/api/projects/$MOSAIC_WEB/terms/$termId/history")
            .retrieve().body(listType)!!

        val imported = history.filter { it["action"] == "imported" }
        assertThat(imported).isNotEmpty()
        assertThat(imported.first()["newValue"]).isEqualTo("Übersicht aus einem Import")
        assertThat(imported.first()["authorName"] as String).isNotBlank()
    }

    @Test
    fun `an import that changes nothing does not invent history`() {
        client.post().uri("/api/projects/$MOSAIC_WEB/import?lang=de")
            .body(mapOf("nav.dashboard" to "Gleicher Wert"))
            .retrieve().toBodilessEntity()

        @Suppress("UNCHECKED_CAST")
        val rows = client.get().uri("/api/projects/$MOSAIC_WEB/languages/de/translations?q=nav.dashboard")
            .retrieve().body(mapType)!!["rows"] as List<Map<String, Any?>>
        val termId = rows.first()["id"] as String

        val before = client.get().uri("/api/projects/$MOSAIC_WEB/terms/$termId/history")
            .retrieve().body(listType)!!.size

        // Importing the same value again is a no-op, and says nothing.
        client.post().uri("/api/projects/$MOSAIC_WEB/import?lang=de")
            .body(mapOf("nav.dashboard" to "Gleicher Wert"))
            .retrieve().toBodilessEntity()

        assertThat(
            client.get().uri("/api/projects/$MOSAIC_WEB/terms/$termId/history")
                .retrieve().body(listType)!!.size,
        ).isEqualTo(before)
    }
}
