package io.lexstore

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.web.client.HttpClientErrorException

private const val MOSAIC_WEB = "35f54c71-131a-cc6e-aad2-f22b0eca789f"

/**
 * Oversized input is the caller's mistake, so it must read as one. Before this,
 * the value reached the column and the constraint surfaced as a 500.
 */
class InputLimitsTest : IntegrationTestBase() {

    private val tooLong = "x".repeat(5000)

    @Test
    fun `a term key longer than its column is refused as a bad request`() {
        val ex = assertThrows<HttpClientErrorException.BadRequest> {
            client.post().uri("/api/projects/$MOSAIC_WEB/terms")
                .body(mapOf("key" to tooLong, "source" to "x"))
                .retrieve().toBodilessEntity()
        }
        assertThat(ex.responseBodyAsString).doesNotContain("varchar")
    }

    @Test
    fun `an oversized project name is refused as a bad request`() {
        assertThrows<HttpClientErrorException.BadRequest> {
            client.patch().uri("/api/projects/$MOSAIC_WEB")
                .body(mapOf("name" to tooLong))
                .retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `an oversized source string is refused as a bad request`() {
        assertThrows<HttpClientErrorException.BadRequest> {
            client.post().uri("/api/projects/$MOSAIC_WEB/terms")
                .body(mapOf("key" to "limits.probe", "source" to tooLong))
                .retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `deleting something that does not exist is a not-found, not a server error`() {
        val missing = "00000000-0000-0000-0000-000000000099"
        assertThrows<HttpClientErrorException.NotFound> {
            client.delete().uri("/api/projects/$MOSAIC_WEB/glossary/$missing")
                .retrieve().toBodilessEntity()
        }
        assertThrows<HttpClientErrorException.NotFound> {
            client.delete().uri("/api/org/credentials/$missing")
                .retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `a misspelled status is refused rather than silently downgraded`() {
        @Suppress("UNCHECKED_CAST")
        val rows = client.get().uri("/api/projects/$MOSAIC_WEB/languages/de/translations?size=1")
            .retrieve()
            .body(object : org.springframework.core.ParameterizedTypeReference<Map<String, Any?>>() {})!!["rows"]
            as List<Map<String, Any?>>
        val termId = rows.first()["id"] as String

        val ex = assertThrows<HttpClientErrorException.BadRequest> {
            client.put().uri("/api/projects/$MOSAIC_WEB/languages/de/translations/$termId")
                .body(mapOf("value" to "Wert", "status" to "proofred"))
                .retrieve().toBodilessEntity()
        }
        assertThat(ex.responseBodyAsString).contains("proofread")
    }

    @Test
    fun `an unknown editor filter is refused rather than matching nothing`() {
        val ex = assertThrows<HttpClientErrorException.BadRequest> {
            client.get().uri("/api/projects/$MOSAIC_WEB/languages/de/translations?status=banana")
                .retrieve()
                .body(object : org.springframework.core.ParameterizedTypeReference<Map<String, Any?>>() {})
        }
        assertThat(ex.responseBodyAsString).contains("untranslated")
    }

    @Test
    fun `the real filters still work`() {
        for (filter in listOf("all", "untranslated", "new", "fuzzy", "proofread")) {
            client.get().uri("/api/projects/$MOSAIC_WEB/languages/de/translations?status=$filter")
                .retrieve()
                .body(object : org.springframework.core.ParameterizedTypeReference<Map<String, Any?>>() {})
        }
    }

    @Test
    fun `a value within the limit is still accepted`() {
        client.post().uri("/api/projects/$MOSAIC_WEB/terms")
            .body(mapOf("key" to "limits.ok", "source" to "A normal source string"))
            .retrieve().toBodilessEntity()
    }
}
