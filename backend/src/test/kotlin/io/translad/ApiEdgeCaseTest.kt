package io.translad

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.core.ParameterizedTypeReference
import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpClientErrorException
import java.util.UUID

class ApiEdgeCaseTest : IntegrationTestBase() {

    private val listType = object : ParameterizedTypeReference<List<Map<String, Any?>>>() {}
    private val mapType = object : ParameterizedTypeReference<Map<String, Any?>>() {}

    private fun getList(path: String): List<Map<String, Any?>> =
        client.get().uri(path).retrieve().body(listType)!!

    private fun getMap(path: String): Map<String, Any?> =
        client.get().uri(path).retrieve().body(mapType)!!

    private fun mosaicId(): String =
        getList("/api/projects").first { it["code"] == "mosaic-web" }["id"] as String

    private inline fun expectStatus(status: HttpStatus, block: () -> Unit) {
        val ex = assertThrows<HttpClientErrorException> { block() }
        assertThat(ex.statusCode).isEqualTo(status)
    }

    // ---------------- Validation ----------------

    @Test
    fun `creating a term without a key is rejected`() {
        val id = mosaicId()
        expectStatus(HttpStatus.BAD_REQUEST) {
            client.post().uri("/api/projects/$id/terms")
                .body(mapOf("source" to "Only source, no key"))
                .retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `creating a project with an invalid slug is rejected`() {
        expectStatus(HttpStatus.BAD_REQUEST) {
            client.post().uri("/api/projects")
                .body(mapOf("name" to "Bad Slug", "code" to "Not A Slug!"))
                .retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `inviting a contributor with an invalid email is rejected`() {
        val id = mosaicId()
        expectStatus(HttpStatus.BAD_REQUEST) {
            client.post().uri("/api/projects/$id/contributors")
                .body(mapOf("name" to "No Email", "email" to "not-an-email"))
                .retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `a blank comment is rejected`() {
        val id = mosaicId()
        val termId = (getMap("/api/projects/$id/terms")["content"] as List<*>)
            .first().let { (it as Map<*, *>)["id"] as String }
        expectStatus(HttpStatus.BAD_REQUEST) {
            client.post().uri("/api/projects/$id/terms/$termId/comments")
                .body(mapOf("text" to "   "))
                .retrieve().toBodilessEntity()
        }
    }

    // ---------------- Not found ----------------

    @Test
    fun `unknown project returns 404`() {
        expectStatus(HttpStatus.NOT_FOUND) {
            client.get().uri("/api/projects/${UUID.randomUUID()}").retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `unknown term returns 404`() {
        val id = mosaicId()
        expectStatus(HttpStatus.NOT_FOUND) {
            client.get().uri("/api/projects/$id/terms/${UUID.randomUUID()}")
                .retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `translating against a language not in the project is rejected`() {
        val id = mosaicId()
        val termId = (getMap("/api/projects/$id/terms")["content"] as List<*>)
            .first().let { (it as Map<*, *>)["id"] as String }
        expectStatus(HttpStatus.BAD_REQUEST) {
            client.put().uri("/api/projects/$id/languages/zz/translations/$termId")
                .body(mapOf("value" to "x", "status" to "translated"))
                .retrieve().toBodilessEntity()
        }
    }

    // ---------------- Lifecycle: terms ----------------

    @Test
    fun `term create then delete removes it from the list`() {
        val id = mosaicId()
        val created = client.post().uri("/api/projects/$id/terms")
            .body(mapOf("key" to "test.lifecycle.key", "source" to "Lifecycle", "ctx" to "Test", "tags" to listOf("qa")))
            .retrieve().body(mapType)!!
        val termId = created["id"] as String
        assertThat(created["isNew"]).isEqualTo(true)
        assertThat(created["tags"]).isEqualTo(listOf("qa"))

        client.delete().uri("/api/projects/$id/terms/$termId").retrieve().toBodilessEntity()

        expectStatus(HttpStatus.NOT_FOUND) {
            client.get().uri("/api/projects/$id/terms/$termId").retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `term can be created with optional fields omitted`() {
        val id = mosaicId()
        val created = client.post().uri("/api/projects/$id/terms")
            .body(mapOf("key" to "test.minimal.key", "source" to "Minimal"))
            .retrieve().body(mapType)!!
        assertThat(created["ctx"]).isEqualTo("")
        assertThat(created["tags"]).isEqualTo(emptyList<String>())
        client.delete().uri("/api/projects/$id/terms/${created["id"]}").retrieve().toBodilessEntity()
    }

    // ---------------- Status transitions ----------------

    @Test
    fun `a translation moves through the status lifecycle`() {
        val id = mosaicId()
        val termId = (getMap("/api/projects/$id/terms?size=50")["content"] as List<*>)
            .map { it as Map<*, *> }.first { it["key"] == "onboarding.step1" }["id"] as String
        val lang = "de"

        fun put(value: String?, status: String) = client.put()
            .uri("/api/projects/$id/languages/$lang/translations/$termId")
            .body(mapOf("value" to value, "status" to status))
            .retrieve().body(mapType)!!

        assertThat(put("Lade dein Team ein", "translated")["status"]).isEqualTo("translated")
        assertThat(put("Lade dein Team ein", "fuzzy")["status"]).isEqualTo("fuzzy")
        assertThat(put("Lade dein Team ein", "proofread")["status"]).isEqualTo("proofread")
        // Clearing the value back to untranslated.
        assertThat(put(null, "untranslated")["status"]).isEqualTo("untranslated")
    }

    @Test
    fun `an unknown status string defaults to untranslated`() {
        val id = mosaicId()
        val termId = (getMap("/api/projects/$id/terms?size=50")["content"] as List<*>)
            .map { it as Map<*, *> }.first { it["key"] == "auth.forgot" }["id"] as String
        val saved = client.put().uri("/api/projects/$id/languages/de/translations/$termId")
            .body(mapOf("value" to "x", "status" to "banana"))
            .retrieve().body(mapType)!!
        assertThat(saved["status"]).isEqualTo("untranslated")
    }

    // ---------------- Plurals ----------------

    @Test
    fun `plural terms expose both forms`() {
        val id = mosaicId()
        val plural = (getMap("/api/projects/$id/terms?size=50")["content"] as List<*>)
            .map { it as Map<*, *> }.first { it["key"] == "billing.seats" }
        @Suppress("UNCHECKED_CAST")
        val forms = plural["plural"] as Map<String, Any?>
        assertThat(forms["one"]).isEqualTo("# seat")
        assertThat(forms["other"]).isEqualTo("# seats")
    }

    // ---------------- Languages ----------------

    @Test
    fun `adding a duplicate language is rejected`() {
        val id = mosaicId()
        expectStatus(HttpStatus.CONFLICT) {
            client.post().uri("/api/projects/$id/languages")
                .body(mapOf("code" to "fr", "name" to "French"))
                .retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `add language then remove it`() {
        val id = mosaicId()
        val added = client.post().uri("/api/projects/$id/languages")
            .body(mapOf("code" to "sv", "name" to "Swedish"))
            .retrieve().body(mapType)!!
        assertThat(added["code"]).isEqualTo("sv")
        assertThat(getList("/api/projects/$id/languages").map { it["code"] }).contains("sv")

        client.delete().uri("/api/projects/$id/languages/sv").retrieve().toBodilessEntity()
        assertThat(getList("/api/projects/$id/languages").map { it["code"] }).doesNotContain("sv")
    }

    // ---------------- Contributors ----------------

    @Test
    fun `invite then remove a contributor`() {
        val id = mosaicId()
        val before = getList("/api/projects/$id/contributors").size
        val invited = client.post().uri("/api/projects/$id/contributors")
            .body(mapOf("name" to "Test Person", "email" to "test@translad.io", "role" to "Translator", "langs" to listOf("fr")))
            .retrieve().body(mapType)!!
        assertThat(getList("/api/projects/$id/contributors")).hasSize(before + 1)

        client.delete().uri("/api/projects/$id/contributors/${invited["id"]}").retrieve().toBodilessEntity()
        assertThat(getList("/api/projects/$id/contributors")).hasSize(before)
    }

    // ---------------- API keys ----------------

    @Test
    fun `generate a test key then revoke it`() {
        val id = mosaicId()
        val before = getList("/api/projects/$id/api-keys").size
        val created = client.post().uri("/api/projects/$id/api-keys")
            .body(mapOf("label" to "Throwaway", "scope" to "Read & write", "test" to true))
            .retrieve().body(mapType)!!
        assertThat(created["secret"] as String).startsWith("tl_test_")

        client.delete().uri("/api/projects/$id/api-keys/${created["id"]}").retrieve().toBodilessEntity()
        assertThat(getList("/api/projects/$id/api-keys")).hasSize(before)
    }

    @Test
    fun `an unknown api key scope is rejected instead of granting write access`() {
        val id = mosaicId()
        val ex = org.junit.jupiter.api.assertThrows<HttpClientErrorException.BadRequest> {
            client.post().uri("/api/projects/$id/api-keys")
                .body(mapOf("label" to "Typo", "scope" to "raed only", "test" to true))
                .retrieve().body(mapType)
        }
        assertThat(ex.responseBodyAsString).contains("Read only")
    }

    // ---------------- Comments ----------------

    @Test
    fun `adding a comment then listing returns it`() {
        val id = mosaicId()
        val termId = (getMap("/api/projects/$id/terms?size=50")["content"] as List<*>)
            .map { it as Map<*, *> }.first { it["key"] == "settings.profile" }["id"] as String
        val before = getList("/api/projects/$id/terms/$termId/comments").size

        val added = client.post().uri("/api/projects/$id/terms/$termId/comments")
            .body(mapOf("text" to "QA test comment"))
            .retrieve().body(mapType)!!
        assertThat(added["text"]).isEqualTo("QA test comment")
        // Unauthenticated test context stamps the placeholder author.
        assertThat(added["authorName"]).isEqualTo("You There")

        val after = getList("/api/projects/$id/terms/$termId/comments")
        assertThat(after).hasSize(before + 1)
    }

    // ---------------- Pagination edges ----------------

    @Test
    fun `pagination past the end yields an empty page with correct total`() {
        val id = mosaicId()
        val res = getMap("/api/projects/$id/terms?page=99&size=10")
        @Suppress("UNCHECKED_CAST")
        assertThat(res["content"] as List<Any?>).isEmpty()
        assertThat((res["total"] as Number).toInt()).isEqualTo(14)
    }

    @Test
    fun `an oversized page size is capped`() {
        val id = mosaicId()
        val res = getMap("/api/projects/$id/terms?page=0&size=9999")
        @Suppress("UNCHECKED_CAST")
        // size is coerced to <= 200; still returns all 14 terms.
        assertThat((res["content"] as List<Any?>).size).isEqualTo(14)
    }

    // ---------------- Project isolation ----------------

    @Test
    fun `a term from another project cannot be fetched through the wrong project`() {
        val projects = getList("/api/projects")
        val mosaic = projects.first { it["code"] == "mosaic-web" }["id"] as String
        val ios = projects.first { it["code"] == "mosaic-ios" }["id"] as String

        val iosTermId = (getMap("/api/projects/$ios/terms?size=5")["content"] as List<*>)
            .first().let { (it as Map<*, *>)["id"] as String }

        // Fetching an iOS term via the mosaic-web project must not succeed.
        expectStatus(HttpStatus.BAD_REQUEST) {
            client.get().uri("/api/projects/$mosaic/terms/$iosTermId").retrieve().toBodilessEntity()
        }
    }

    // ---------------- Translation audit ----------------

    @Test
    fun `saving a translation records who changed it`() {
        val id = mosaicId()
        val termId = (getMap("/api/projects/$id/terms?size=50")["content"] as List<*>)
            .map { it as Map<*, *> }.first { it["key"] == "auth.forgot" }["id"] as String

        client.put().uri("/api/projects/$id/languages/de/translations/$termId")
            .body(mapOf("value" to "Passwort vergessen?", "status" to "translated", "authorName" to "Lukas Brandt", "authorAvatar" to 3))
            .retrieve().toBodilessEntity()

        // The editor row now reports the last editor.
        @Suppress("UNCHECKED_CAST")
        val rows = getMap("/api/projects/$id/languages/de/translations")["rows"] as List<Map<String, Any?>>
        val row = rows.first { it["key"] == "auth.forgot" }
        @Suppress("UNCHECKED_CAST")
        val modifiedBy = row["modifiedBy"] as Map<String, Any?>
        // The audit identity comes from the authenticated caller, never the body:
        // a client-supplied author is ignored.
        assertThat(modifiedBy["name"]).isEqualTo("You There")
    }

    @Test
    fun `term history returns events across languages newest first`() {
        val id = mosaicId()
        val termId = (getMap("/api/projects/$id/terms?size=50")["content"] as List<*>)
            .map { it as Map<*, *> }.first { it["key"] == "nav.dashboard" }["id"] as String

        // Seeded history already exists; add one more and confirm it lands on top.
        client.put().uri("/api/projects/$id/languages/fr/translations/$termId")
            .body(mapOf("value" to "Tableau de bord (révisé)", "status" to "proofread"))
            .retrieve().toBodilessEntity()

        val history = getList("/api/projects/$id/terms/$termId/history")
        assertThat(history).isNotEmpty()
        assertThat(history.first()["authorName"]).isEqualTo("You There")
        assertThat(history.first()["newValue"]).isEqualTo("Tableau de bord (révisé)")
        assertThat(history.first()["action"]).isEqualTo("proofread")
        // Events span more than one language (seeded de/ja/es etc).
        assertThat(history.map { it["languageCode"] }.toSet().size).isGreaterThan(1)
    }

    // ---------------- AI translation + cache ----------------

    @Test
    fun `ai translate is a miss then a hit and the cache fills`() {
        val first = client.post().uri("/api/ai/translate")
            .body(mapOf("sourceText" to "Pay now", "sourceLang" to "en", "targetLang" to "de"))
            .retrieve().body(mapType)!!
        assertThat(first["cacheHit"]).isEqualTo(false)
        assertThat(first["text"]).isEqualTo("Jetzt bezahlen")

        val second = client.post().uri("/api/ai/translate")
            .body(mapOf("sourceText" to "Pay now", "sourceLang" to "en", "targetLang" to "de"))
            .retrieve().body(mapType)!!
        assertThat(second["cacheHit"]).isEqualTo(true)
        assertThat(second["text"]).isEqualTo("Jetzt bezahlen")

        val stats = getMap("/api/ai/cache/stats")
        assertThat((stats["requests"] as Number).toInt()).isGreaterThanOrEqualTo(2)
        assertThat((stats["cacheHits"] as Number).toInt()).isGreaterThanOrEqualTo(1)
    }

    @Test
    fun `noCache forces a fresh translation`() {
        client.post().uri("/api/ai/translate")
            .body(mapOf("sourceText" to "Projects", "sourceLang" to "en", "targetLang" to "fr"))
            .retrieve().toBodilessEntity()
        val forced = client.post().uri("/api/ai/translate")
            .body(mapOf("sourceText" to "Projects", "sourceLang" to "en", "targetLang" to "fr", "noCache" to true))
            .retrieve().body(mapType)!!
        assertThat(forced["cacheHit"]).isEqualTo(false)
    }

    @Test
    fun `cache can be invalidated per content`() {
        client.post().uri("/api/ai/translate")
            .body(mapOf("sourceText" to "Dashboard", "sourceLang" to "en", "targetLang" to "de"))
            .retrieve().toBodilessEntity()
        // Invalidate that content; a subsequent translate is a miss again.
        client.delete().uri("/api/ai/cache?sourceText=Dashboard").retrieve().toBodilessEntity()
        val after = client.post().uri("/api/ai/translate")
            .body(mapOf("sourceText" to "Dashboard", "sourceLang" to "en", "targetLang" to "de"))
            .retrieve().body(mapType)!!
        assertThat(after["cacheHit"]).isEqualTo(false)
    }

    @Test
    fun `auto-translate fills untranslated terms for a language`() {
        val id = mosaicId()
        val result = client.post().uri("/api/projects/$id/languages/nl/translations/auto")
            .retrieve().body(mapType)!!
        assertThat((result["translated"] as Number).toInt()).isEqualTo(14)
        // With auto-flag-fuzzy on (default), they land as fuzzy.
        assertThat(result["status"]).isEqualTo("fuzzy")
    }

    @Test
    fun `updating ai settings persists`() {
        val updated = client.put().uri("/api/ai/settings")
            .body(mapOf("formality" to "formal", "temperature" to 0.5, "tone" to "Keep it short."))
            .retrieve().body(mapType)!!
        assertThat(updated["formality"]).isEqualTo("formal")
        assertThat((updated["temperature"] as Number).toDouble()).isEqualTo(0.5)
        assertThat(updated["tone"]).isEqualTo("Keep it short.")
    }

    // ---------------- Import / Export ----------------

    @Test
    fun `import creates missing terms and fills translations`() {
        val id = mosaicId()
        val before = (getMap("/api/projects/$id/terms?size=1")["total"] as Number).toInt()
        val result = client.post().uri("/api/projects/$id/import?lang=nl")
            .body(mapOf("nav.dashboard" to "Dashboard NL", "fresh.imported.key" to "Vers geïmporteerd"))
            .retrieve().body(mapType)!!
        assertThat((result["created"] as Number).toInt()).isEqualTo(1)
        assertThat((result["total"] as Number).toInt()).isEqualTo(2)
        val after = (getMap("/api/projects/$id/terms?size=1")["total"] as Number).toInt()
        assertThat(after).isEqualTo(before + 1)
        // The new Dutch value is present in the editor view.
        @Suppress("UNCHECKED_CAST")
        val rows = getMap("/api/projects/$id/languages/nl/translations")["rows"] as List<Map<String, Any?>>
        assertThat(rows.first { it["key"] == "nav.dashboard" }["target"]).isEqualTo("Dashboard NL")
    }

    @Test
    fun `export returns a key-value map for a language`() {
        val id = mosaicId()
        val json = getMap("/api/projects/$id/export?lang=fr")
        assertThat(json["nav.dashboard"]).isEqualTo("Tableau de bord")
        assertThat(json).containsKey("billing.plan.pro") // untranslated → empty string
    }

    // ---------------- Term detail + comment delete ----------------

    @Test
    fun `updating a term changes context and tags`() {
        val id = mosaicId()
        val termId = (getMap("/api/projects/$id/terms?size=50")["content"] as List<*>)
            .map { it as Map<*, *> }.first { it["key"] == "auth.forgot" }["id"] as String
        val updated = client.patch().uri("/api/projects/$id/terms/$termId")
            .body(mapOf("ctx" to "Reset flow", "tags" to listOf("auth", "qa")))
            .retrieve().body(mapType)!!
        assertThat(updated["ctx"]).isEqualTo("Reset flow")
        assertThat(updated["tags"]).isEqualTo(listOf("auth", "qa"))
    }

    @Test
    fun `a comment can be added then deleted`() {
        val id = mosaicId()
        val termId = (getMap("/api/projects/$id/terms?size=50")["content"] as List<*>)
            .map { it as Map<*, *> }.first { it["key"] == "settings.profile" }["id"] as String
        val added = client.post().uri("/api/projects/$id/terms/$termId/comments")
            .body(mapOf("text" to "to be deleted"))
            .retrieve().body(mapType)!!
        val commentId = added["id"] as String
        client.delete().uri("/api/projects/$id/terms/$termId/comments/$commentId")
            .retrieve().toBodilessEntity()
        assertThat(getList("/api/projects/$id/terms/$termId/comments").map { it["id"] })
            .doesNotContain(commentId)
    }

    // ---------------- Editor view integrity ----------------

    @Test
    fun `editor rows expose one translation slot per term for the requested language`() {
        val id = mosaicId()
        val res = getMap("/api/projects/$id/languages/ja/translations")
        assertThat(res["languageCode"]).isEqualTo("ja")
        @Suppress("UNCHECKED_CAST")
        val rows = res["rows"] as List<Map<String, Any?>>
        assertThat(rows).hasSize(14)
        // Japanese has some translations and some gaps.
        assertThat(rows.any { it["target"] != null }).isTrue()
        assertThat(rows.any { it["target"] == null }).isTrue()
    }

    // ---------------- Upload limits ----------------

    @Test
    fun `an oversized project image is rejected by the server, not just the browser`() {
        val id = mosaicId()
        val huge = "data:image/png;base64," + "A".repeat(800_000)
        expectStatus(HttpStatus.BAD_REQUEST) {
            client.patch().uri("/api/projects/$id")
                .body(mapOf("image" to huge))
                .retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `a project image that is not an image data URI is rejected`() {
        val id = mosaicId()
        expectStatus(HttpStatus.BAD_REQUEST) {
            client.patch().uri("/api/projects/$id")
                .body(mapOf("image" to "https://example.com/logo.png"))
                .retrieve().toBodilessEntity()
        }
    }

    @Test
    fun `a valid image is stored and can be cleared`() {
        val id = mosaicId()
        val png = "data:image/png;base64,iVBORw0KGgo="
        val saved = client.patch().uri("/api/projects/$id")
            .body(mapOf("image" to png))
            .retrieve().body(mapType)!!
        assertThat(saved["image"]).isEqualTo(png)

        val cleared = client.patch().uri("/api/projects/$id")
            .body(mapOf("image" to ""))
            .retrieve().body(mapType)!!
        assertThat(cleared["image"]).isNull()
    }
}
