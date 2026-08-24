package io.lexstore

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.core.ParameterizedTypeReference
import org.springframework.web.client.HttpClientErrorException

/**
 * A tool that creates projects has to be able to remove them. Deleting one must
 * take everything under it, and leave the other projects alone.
 */
class ProjectDeletionTest : IntegrationTestBase() {

    private val mapType = object : ParameterizedTypeReference<Map<String, Any?>>() {}
    private val listType = object : ParameterizedTypeReference<List<Map<String, Any?>>>() {}

    private fun projectCount() = client.get().uri("/api/projects").retrieve().body(listType)!!.size

    @Test
    fun `deleting a project removes it and everything under it`() {
        val created = client.post().uri("/api/projects")
            .body(mapOf("name" to "Doomed", "code" to "doomed-${System.nanoTime()}"))
            .retrieve().body(mapType)!!
        val id = created["id"] as String

        client.post().uri("/api/projects/$id/languages")
            .body(mapOf("code" to "de", "name" to "German")).retrieve().toBodilessEntity()
        client.post().uri("/api/projects/$id/terms")
            .body(mapOf("key" to "doomed.term", "source" to "Goes away")).retrieve().toBodilessEntity()

        val before = projectCount()
        client.delete().uri("/api/projects/$id").retrieve().toBodilessEntity()

        assertThat(projectCount()).isEqualTo(before - 1)
        assertThrows<HttpClientErrorException.NotFound> {
            client.get().uri("/api/projects/$id").retrieve().body(mapType)
        }
        // Its terms went with it rather than becoming unreachable rows.
        assertThrows<HttpClientErrorException> {
            client.get().uri("/api/projects/$id/terms").retrieve().body(mapType)
        }
    }

    @Test
    fun `deleting one project leaves the others`() {
        val keep = client.get().uri("/api/projects").retrieve().body(listType)!!
            .first()["id"] as String
        val created = client.post().uri("/api/projects")
            .body(mapOf("name" to "Spare", "code" to "spare-${System.nanoTime()}"))
            .retrieve().body(mapType)!!

        client.delete().uri("/api/projects/${created["id"]}").retrieve().toBodilessEntity()

        client.get().uri("/api/projects/$keep").retrieve().body(mapType)
    }

    @Test
    fun `every sub-resource of an unknown project is a not-found`() {
        val missing = "00000000-0000-0000-0000-0000000000ee"
        for (path in listOf("languages", "contributors", "features", "glossary", "api-keys", "terms")) {
            assertThrows<HttpClientErrorException.NotFound>("GET $path should be 404") {
                client.get().uri("/api/projects/$missing/$path").retrieve().body(listType)
            }
        }
    }

    @Test
    fun `deleting something that is not there is a not-found`() {
        assertThrows<HttpClientErrorException.NotFound> {
            client.delete().uri("/api/projects/00000000-0000-0000-0000-0000000000ff")
                .retrieve().toBodilessEntity()
        }
    }
}
