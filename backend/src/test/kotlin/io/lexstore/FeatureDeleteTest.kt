package io.lexstore

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.core.ParameterizedTypeReference

private const val MOSAIC_WEB = "35f54c71-131a-cc6e-aad2-f22b0eca789f"

class FeatureDeleteTest : IntegrationTestBase() {

    private val listType = object : ParameterizedTypeReference<List<Map<String, Any?>>>() {}
    private val mapType = object : ParameterizedTypeReference<Map<String, Any?>>() {}

    @Test
    fun `deleting a feature unassigns its terms instead of removing them`() {
        val feature = client.post().uri("/api/projects/$MOSAIC_WEB/features")
            .body(mapOf("name" to "Checkout flow"))
            .retrieve().body(mapType)!!
        val featureId = feature["id"] as String

        val terms = client.get().uri("/api/projects/$MOSAIC_WEB/terms?size=5")
            .retrieve().body(mapType)!!["content"] as List<*>
        val termIds = terms.map { (it as Map<*, *>)["id"] as String }
        client.post().uri("/api/projects/$MOSAIC_WEB/features/$featureId/terms")
            .body(mapOf("termIds" to termIds))
            .retrieve().toBodilessEntity()

        val termCountBefore = (client.get().uri("/api/projects/$MOSAIC_WEB/terms?size=200")
            .retrieve().body(mapType)!!["content"] as List<*>).size

        client.delete().uri("/api/projects/$MOSAIC_WEB/features/$featureId")
            .retrieve().toBodilessEntity()

        assertThat(client.get().uri("/api/projects/$MOSAIC_WEB/features").retrieve().body(listType))
            .noneMatch { it["id"] == featureId }

        val after = client.get().uri("/api/projects/$MOSAIC_WEB/terms?size=200")
            .retrieve().body(mapType)!!["content"] as List<*>
        assertThat(after).hasSize(termCountBefore)
        assertThat(after.map { (it as Map<*, *>)["featureId"] }).allMatch { it == null || it != featureId }
    }
}
