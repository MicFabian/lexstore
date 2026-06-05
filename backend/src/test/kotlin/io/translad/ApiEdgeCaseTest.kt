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

    // ---------------- Comments ----------------

    @Test
    fun `adding a comment then listing returns it`() {
        val id = mosaicId()
        val termId = (getMap("/api/projects/$id/terms?size=50")["content"] as List<*>)
            .map { it as Map<*, *> }.first { it["key"] == "settings.profile" }["id"] as String
        val before = getList("/api/projects/$id/terms/$termId/comments").size

        val added = client.post().uri("/api/projects/$id/terms/$termId/comments")
            .body(mapOf("text" to "QA test comment", "authorName" to "QA Bot"))
            .retrieve().body(mapType)!!
        assertThat(added["text"]).isEqualTo("QA test comment")

        val after = getList("/api/projects/$id/terms/$termId/comments")
        assertThat(after).hasSize(before + 1)
        assertThat(after.last()["authorName"]).isEqualTo("QA Bot")
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
        assertThat(modifiedBy["name"]).isEqualTo("Lukas Brandt")
    }

    @Test
    fun `term history returns events across languages newest first`() {
        val id = mosaicId()
        val termId = (getMap("/api/projects/$id/terms?size=50")["content"] as List<*>)
            .map { it as Map<*, *> }.first { it["key"] == "nav.dashboard" }["id"] as String

        // Seeded history already exists; add one more and confirm it lands on top.
        client.put().uri("/api/projects/$id/languages/fr/translations/$termId")
            .body(mapOf("value" to "Tableau de bord (révisé)", "status" to "proofread", "authorName" to "QA Bot"))
            .retrieve().toBodilessEntity()

        val history = getList("/api/projects/$id/terms/$termId/history")
        assertThat(history).isNotEmpty()
        assertThat(history.first()["authorName"]).isEqualTo("QA Bot")
        assertThat(history.first()["newValue"]).isEqualTo("Tableau de bord (révisé)")
        assertThat(history.first()["action"]).isEqualTo("proofread")
        // Events span more than one language (seeded de/ja/es etc).
        assertThat(history.map { it["languageCode"] }.toSet().size).isGreaterThan(1)
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
}
