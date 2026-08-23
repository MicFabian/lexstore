package io.lexstore

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.core.ParameterizedTypeReference

private const val MOSAIC_WEB = "35f54c71-131a-cc6e-aad2-f22b0eca789f"

/**
 * A project image is a data URI of up to 512 KB shown as a 28-pixel icon.
 * Inlining it in listings made every dashboard load carry it again.
 */
class ProjectImageTest : IntegrationTestBase() {

    private val listType = object : ParameterizedTypeReference<List<Map<String, Any?>>>() {}

    private val image = "data:image/png;base64," + "A".repeat(40_000)

    @Test
    fun `a listing carries the image URL, not the image`() {
        client.patch().uri("/api/projects/$MOSAIC_WEB")
            .body(mapOf("image" to image))
            .retrieve().toBodilessEntity()

        val listing = client.get().uri("/api/projects").retrieve().body(listType)!!
        val mosaic = listing.first { it["id"] == MOSAIC_WEB }

        assertThat(mosaic["imageUrl"] as String).endsWith("/image")
        assertThat(listing.toString()).doesNotContain("AAAAAAAAAA")
    }

    @Test
    fun `the image endpoint returns the bytes, cacheable`() {
        client.patch().uri("/api/projects/$MOSAIC_WEB")
            .body(mapOf("image" to image))
            .retrieve().toBodilessEntity()

        val res = client.get().uri("/api/projects/$MOSAIC_WEB/image")
            .retrieve().toEntity(ByteArray::class.java)

        assertThat(res.statusCode.value()).isEqualTo(200)
        assertThat(res.headers.getFirst("Content-Type")).contains("image/png")
        assertThat(res.headers.getFirst("Cache-Control")).contains("max-age")
        assertThat(res.body).isNotEmpty()
    }

    @Test
    fun `a project without an image says so rather than serving nothing`() {
        client.patch().uri("/api/projects/$MOSAIC_WEB")
            .body(mapOf("image" to ""))
            .retrieve().toBodilessEntity()

        val listing = client.get().uri("/api/projects").retrieve().body(listType)!!
        assertThat(listing.first { it["id"] == MOSAIC_WEB }["imageUrl"]).isNull()
    }
}
