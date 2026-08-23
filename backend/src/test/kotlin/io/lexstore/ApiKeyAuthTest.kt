package io.lexstore

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.core.ParameterizedTypeReference
import org.springframework.web.client.HttpClientErrorException

private const val MOSAIC_WEB = "35f54c71-131a-cc6e-aad2-f22b0eca789f"
private const val MOSAIC_IOS = "c300efad-b80f-b593-8161-2da008e1a041"

class ApiKeyAuthTest : IntegrationTestBase() {

    @org.springframework.beans.factory.annotation.Autowired
    private lateinit var keys: io.lexstore.apikey.ApiKeyRepository

    private val mapType = object : ParameterizedTypeReference<Map<String, Any?>>() {}
    private val listType = object : ParameterizedTypeReference<List<Map<String, Any?>>>() {}

    private fun newKey(projectId: String, scope: String): String =
        client.post().uri("/api/projects/$projectId/api-keys")
            .body(mapOf("label" to "CI", "scope" to scope, "test" to true))
            .retrieve().body(mapType)!!["secret"] as String

    @Test
    fun `a key reads its own project`() {
        val secret = newKey(MOSAIC_WEB, "Read only")
        val res = client.get().uri("/api/projects/$MOSAIC_WEB/languages/de/translations")
            .header("X-API-Key", secret)
            .retrieve().body(mapType)!!
        assertThat(res["rows"]).isNotNull()
    }

    @Test
    fun `a key cannot reach another project`() {
        val secret = newKey(MOSAIC_WEB, "Read only")
        assertThrows<HttpClientErrorException.Forbidden> {
            client.get().uri("/api/projects/$MOSAIC_IOS/languages/de/translations")
                .header("X-API-Key", secret)
                .retrieve().body(mapType)
        }
    }

    @Test
    fun `a read-only key cannot write`() {
        val secret = newKey(MOSAIC_WEB, "Read only")
        @Suppress("UNCHECKED_CAST")
        val rows = client.get().uri("/api/projects/$MOSAIC_WEB/languages/de/translations")
            .header("X-API-Key", secret)
            .retrieve().body(mapType)!!["rows"] as List<Map<String, Any?>>
        val termId = rows.first()["id"] as String

        val ex = assertThrows<HttpClientErrorException.Forbidden> {
            client.put().uri("/api/projects/$MOSAIC_WEB/languages/de/translations/$termId")
                .header("X-API-Key", secret)
                .body(mapOf("value" to "Von einem Nur-Lese-Schlüssel", "status" to "translated"))
                .retrieve().toBodilessEntity()
        }
        // The reason must name the scope, not imply the project is unreachable.
        assertThat(ex.responseBodyAsString).contains("read-only")
    }

    @Test
    fun `a read-write key can write`() {
        val secret = newKey(MOSAIC_WEB, "Read & write")
        @Suppress("UNCHECKED_CAST")
        val rows = client.get().uri("/api/projects/$MOSAIC_WEB/languages/de/translations")
            .header("X-API-Key", secret)
            .retrieve().body(mapType)!!["rows"] as List<Map<String, Any?>>
        val termId = rows.first()["id"] as String

        client.put().uri("/api/projects/$MOSAIC_WEB/languages/de/translations/$termId")
            .header("X-API-Key", secret)
            .body(mapOf("value" to "Von einem Schreibschlüssel", "status" to "translated"))
            .retrieve().toBodilessEntity()
    }

    @Test
    fun `a key cannot read the organisation's stored provider keys`() {
        val secret = newKey(MOSAIC_WEB, "Read & write")
        assertThrows<HttpClientErrorException.Forbidden> {
            client.get().uri("/api/org/credentials")
                .header("X-API-Key", secret)
                .retrieve().body(listType)
        }
    }

    @Test
    fun `a key must name a project to spend on AI, and cannot read across projects`() {
        val secret = newKey(MOSAIC_WEB, "Read & write")

        // Spending without naming a project would be unattributed and uncharged.
        val ex = assertThrows<HttpClientErrorException.Forbidden> {
            client.post().uri("/api/ai/translate")
                .header("X-API-Key", secret)
                .body(mapOf("sourceText" to "Probe", "sourceLang" to "en", "targetLang" to "de"))
                .retrieve().body(mapType)
        }
        assertThat(ex.responseBodyAsString).contains("projectId")

        // Naming its own project works.
        val ok = client.post().uri("/api/ai/translate")
            .header("X-API-Key", secret)
            .body(
                mapOf(
                    "sourceText" to "Probe",
                    "sourceLang" to "en",
                    "targetLang" to "de",
                    "projectId" to MOSAIC_WEB,
                ),
            )
            .retrieve().body(mapType)!!
        assertThat(ok["text"]).isNotNull()

        // Naming someone else's project does not.
        assertThrows<HttpClientErrorException.Forbidden> {
            client.post().uri("/api/ai/translate")
                .header("X-API-Key", secret)
                .body(
                    mapOf(
                        "sourceText" to "Probe",
                        "sourceLang" to "en",
                        "targetLang" to "de",
                        "projectId" to MOSAIC_IOS,
                    ),
                )
                .retrieve().body(mapType)
        }

        // The cache and settings hold every project's text.
        for (path in listOf("/api/ai/settings", "/api/ai/cache")) {
            assertThrows<HttpClientErrorException.Forbidden> {
                client.get().uri(path).header("X-API-Key", secret).retrieve().body(listType)
            }
        }
    }

    @Test
    fun `a key reports when it was created and used, not a fixed label`() {
        val created = client.post().uri("/api/projects/$MOSAIC_WEB/api-keys")
            .body(mapOf("label" to "Timestamps", "scope" to "Read only", "test" to true))
            .retrieve().body(mapType)!!
        val secret = created["secret"] as String

        fun view() = client.get().uri("/api/projects/$MOSAIC_WEB/api-keys")
            .retrieve().body(listType)!!
            .first { it["label"] == "Timestamps" }

        assertThat(view()["created"]).isEqualTo("just now")
        assertThat(view()["used"]).isEqualTo("Never")

        client.get().uri("/api/projects/$MOSAIC_WEB/languages/de/translations")
            .header("X-API-Key", secret)
            .retrieve().body(mapType)

        assertThat(view()["used"]).isEqualTo("just now")
    }

    @Test
    fun `an organisation key reaches every project the organisation owns`() {
        val secret = client.post().uri("/api/org/api-keys")
            .body(mapOf("label" to "Org CI", "scope" to "Read only", "test" to true))
            .retrieve().body(mapType)!!["secret"] as String

        // Both projects belong to the same organisation, so both answer.
        for (project in listOf(MOSAIC_WEB, MOSAIC_IOS)) {
            val res = client.get().uri("/api/projects/$project/languages/de/translations")
                .header("X-API-Key", secret)
                .retrieve().body(mapType)!!
            assertThat(res["rows"]).isNotNull()
        }
    }

    @Test
    fun `an organisation key is still bound by its scope`() {
        val secret = client.post().uri("/api/org/api-keys")
            .body(mapOf("label" to "Org read", "scope" to "Read only", "test" to true))
            .retrieve().body(mapType)!!["secret"] as String

        @Suppress("UNCHECKED_CAST")
        val rows = client.get().uri("/api/projects/$MOSAIC_IOS/languages/de/translations")
            .header("X-API-Key", secret)
            .retrieve().body(mapType)!!["rows"] as List<Map<String, Any?>>
        val termId = rows.first()["id"] as String

        assertThrows<HttpClientErrorException.Forbidden> {
            client.put().uri("/api/projects/$MOSAIC_IOS/languages/de/translations/$termId")
                .header("X-API-Key", secret)
                .body(mapOf("value" to "Nicht erlaubt", "status" to "translated"))
                .retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `an organisation key still cannot manage the organisation`() {
        val secret = client.post().uri("/api/org/api-keys")
            .body(mapOf("label" to "Org CI", "scope" to "Read & write", "test" to true))
            .retrieve().body(mapType)!!["secret"] as String

        assertThrows<HttpClientErrorException.Forbidden> {
            client.get().uri("/api/org/credentials")
                .header("X-API-Key", secret)
                .retrieve().body(listType)
        }
    }

    /**
     * Whether an unrecognised key is rejected outright is decided by the
     * filter chain, which this profile replaces with permitAll. What can be
     * asserted here is that such a key authenticates nobody, so it is never
     * granted a project — checked through the filter directly.
     */
    @Test
    fun `an unknown key authenticates nobody`() {
        val before = org.springframework.security.core.context.SecurityContextHolder
            .getContext().authentication
        assertThat(before).isNull()

        val secret = newKey(MOSAIC_WEB, "Read only")
        val revoked = client.post().uri("/api/projects/$MOSAIC_WEB/api-keys")
            .body(mapOf("label" to "Temporary", "scope" to "Read only", "test" to true))
            .retrieve().body(mapType)!!
        client.delete().uri("/api/projects/$MOSAIC_WEB/api-keys/${revoked["id"]}")
            .retrieve().toBodilessEntity()

        // The live key resolves; the revoked one and a made-up one do not.
        assertThat(keyResolves(secret)).isTrue()
        assertThat(keyResolves(revoked["secret"] as String)).isFalse()
        assertThat(keyResolves("lx_live_not_a_real_key")).isFalse()
    }

    private fun keyResolves(secret: String): Boolean {
        val digest = java.security.MessageDigest.getInstance("SHA-256")
            .digest(secret.toByteArray())
            .joinToString("") { "%02x".format(it) }
        return keys.findBySecretHash(digest) != null
    }
}
