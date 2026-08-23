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
    fun `a value within the limit is still accepted`() {
        client.post().uri("/api/projects/$MOSAIC_WEB/terms")
            .body(mapOf("key" to "limits.ok", "source" to "A normal source string"))
            .retrieve().toBodilessEntity()
    }
}
