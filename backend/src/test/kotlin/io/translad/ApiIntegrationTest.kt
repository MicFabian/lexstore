package io.translad

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.core.ParameterizedTypeReference
import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpClientErrorException

class ApiIntegrationTest : IntegrationTestBase() {

    private val listType = object : ParameterizedTypeReference<List<Map<String, Any?>>>() {}
    private val mapType = object : ParameterizedTypeReference<Map<String, Any?>>() {}

    private fun getList(path: String): List<Map<String, Any?>> =
        client.get().uri(path).retrieve().body(listType)!!

    private fun getMap(path: String): Map<String, Any?> =
        client.get().uri(path).retrieve().body(mapType)!!

    private fun mosaicId(): String =
        getList("/api/projects").first { it["code"] == "mosaic-web" }["id"] as String

    @Test
    fun `seed data is migrated and projects are listed`() {
        val projects = getList("/api/projects")
        assertThat(projects).hasSize(5)
        val mosaic = projects.first { it["code"] == "mosaic-web" }
        assertThat(mosaic["name"]).isEqualTo("Mosaic Web App")
        assertThat((mosaic["terms"] as Number).toInt()).isEqualTo(14)
        assertThat((mosaic["langs"] as Number).toInt()).isEqualTo(6)
    }

    @Test
    fun `translations collection returns one row per term`() {
        val res = getMap("/api/projects/${mosaicId()}/languages/fr/translations")
        assertThat(res["languageCode"]).isEqualTo("fr")
        @Suppress("UNCHECKED_CAST")
        val rows = res["rows"] as List<Map<String, Any?>>
        assertThat(rows).hasSize(14)
        val proofread = rows.first { it["key"] == "nav.dashboard" }
        assertThat(proofread["status"]).isEqualTo("proofread")
        assertThat(proofread["target"]).isEqualTo("Tableau de bord")
    }

    private fun terms(id: String): List<Map<String, Any?>> {
        @Suppress("UNCHECKED_CAST")
        return getMap("/api/projects/$id/terms")["content"] as List<Map<String, Any?>>
    }

    @Test
    fun `terms list is paginated`() {
        val id = mosaicId()
        val res = getMap("/api/projects/$id/terms?page=0&size=5")
        @Suppress("UNCHECKED_CAST")
        val content = res["content"] as List<Map<String, Any?>>
        assertThat(content).hasSize(5)
        assertThat((res["total"] as Number).toInt()).isEqualTo(14)
        assertThat((res["page"] as Number).toInt()).isEqualTo(0)
    }

    @Test
    fun `upserting a translation updates status and clears new flag`() {
        val id = mosaicId()
        // Prefer a still-new term, fall back to any term so the test is order-independent.
        val all = terms(id)
        val term = all.firstOrNull { it["isNew"] == true } ?: all.first()
        val termId = term["id"] as String

        val saved = client.put()
            .uri("/api/projects/$id/languages/fr/translations/$termId")
            .body(mapOf("value" to "Forfait Pro", "status" to "translated"))
            .retrieve()
            .body(mapType)!!
        assertThat(saved["target"]).isEqualTo("Forfait Pro")
        assertThat(saved["status"]).isEqualTo("translated")
        assertThat(saved["isNew"]).isEqualTo(false)
    }

    @Test
    fun `creating a duplicate term key returns 409`() {
        val id = mosaicId()
        val ex = org.junit.jupiter.api.assertThrows<HttpClientErrorException> {
            client.post()
                .uri("/api/projects/$id/terms")
                .body(mapOf("key" to "nav.dashboard", "source" to "Dashboard"))
                .retrieve()
                .toBodilessEntity()
        }
        assertThat(ex.statusCode).isEqualTo(HttpStatus.CONFLICT)
    }

    @Test
    fun `languages report progress and contributor counts`() {
        val langs = getList("/api/projects/${mosaicId()}/languages")
        assertThat(langs).hasSize(6)
        val fr = langs.first { it["code"] == "fr" }
        assertThat((fr["translated"] as Number).toInt()).isGreaterThan(0)
        assertThat((fr["contributors"] as Number).toInt()).isGreaterThanOrEqualTo(1)
    }

    @Test
    fun `generating an api key returns the secret once`() {
        val created = client.post()
            .uri("/api/projects/${mosaicId()}/api-keys")
            .body(mapOf("label" to "CI test key", "scope" to "Read only"))
            .retrieve()
            .body(mapType)!!
        val secret = created["secret"] as String
        assertThat(secret).startsWith("tl_live_")
        assertThat(secret.length).isGreaterThan(20)
    }

    @Test
    fun `contributors are listed with roles`() {
        val people = getList("/api/projects/${mosaicId()}/contributors")
        assertThat(people).hasSize(5)
        assertThat(people.map { it["role"] }).contains("Admin", "Translator", "Proofreader")
    }
}
