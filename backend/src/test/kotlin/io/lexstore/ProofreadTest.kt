package io.lexstore

import io.lexstore.ai.PlaceholderCheck
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.core.ParameterizedTypeReference

private const val MOSAIC_WEB = "35f54c71-131a-cc6e-aad2-f22b0eca789f"

class PlaceholderCheckTest {

    @Test
    fun `a missing placeholder is a major issue`() {
        val issues = PlaceholderCheck.issues("You have {count} messages", "Du hast Nachrichten")
        assertThat(issues).hasSize(1)
        assertThat(issues.first().severity).isEqualTo("major")
        assertThat(issues.first().message).contains("{count}")
    }

    @Test
    fun `a mistyped placeholder is reported as both missing and added`() {
        val issues = PlaceholderCheck.issues("You have {count} messages", "Du hast {cout} Nachrichten")
        assertThat(issues).hasSize(2)
        assertThat(issues.map { it.message }.joinToString()).contains("{count}").contains("{cout}")
    }

    @Test
    fun `a faithful translation has no placeholder issues`() {
        assertThat(PlaceholderCheck.issues("Hi {name}, you have %d new", "Hallo {name}, du hast %d neue"))
            .isEmpty()
    }

    @Test
    fun `printf and tag placeholders are recognised too`() {
        assertThat(PlaceholderCheck.issues("Open <b>%s</b>", "Öffne %s")).isNotEmpty()
        assertThat(PlaceholderCheck.issues("Open <b>%s</b>", "Öffne <b>%s</b>")).isEmpty()
    }
}

class GlossaryAndProofreadApiTest : IntegrationTestBase() {

    private val listType = object : ParameterizedTypeReference<List<Map<String, Any?>>>() {}
    private val mapType = object : ParameterizedTypeReference<Map<String, Any?>>() {}

    @Test
    fun `a glossary term that the translation ignores is reported`() {
        client.post().uri("/api/projects/$MOSAIC_WEB/glossary")
            .body(mapOf("term" to "Dashboard", "languageCode" to "de", "translation" to "Übersicht"))
            .retrieve().toBodilessEntity()

        @Suppress("UNCHECKED_CAST")
        val rows = client.get().uri("/api/projects/$MOSAIC_WEB/languages/de/translations?q=nav.dashboard")
            .retrieve().body(mapType)!!["rows"] as List<Map<String, Any?>>
        val termId = rows.first()["id"] as String

        client.put().uri("/api/projects/$MOSAIC_WEB/languages/de/translations/$termId")
            .body(mapOf("value" to "Armaturenbrett", "status" to "translated"))
            .retrieve().toBodilessEntity()

        val result = client.get().uri("/api/projects/$MOSAIC_WEB/languages/de/translations/$termId/proofread")
            .retrieve().body(mapType)!!

        @Suppress("UNCHECKED_CAST")
        val issues = result["issues"] as List<Map<String, Any?>>
        assertThat(result["verdict"]).isEqualTo("needs_work")
        assertThat(issues.map { it["message"] as String })
            .anyMatch { it.contains("Übersicht") }
    }

    @Test
    fun `a do-not-translate term must survive into the translation`() {
        client.post().uri("/api/projects/$MOSAIC_WEB/glossary")
            .body(mapOf("term" to "Lexstore", "doNotTranslate" to true))
            .retrieve().toBodilessEntity()

        assertThat(client.get().uri("/api/projects/$MOSAIC_WEB/glossary").retrieve().body(listType))
            .anyMatch { it["term"] == "Lexstore" && it["doNotTranslate"] == true }
    }

    @Test
    fun `an entry without a translation or a do-not-translate flag is rejected`() {
        val ex = org.junit.jupiter.api.assertThrows<org.springframework.web.client.HttpClientErrorException.BadRequest> {
            client.post().uri("/api/projects/$MOSAIC_WEB/glossary")
                .body(mapOf("term" to "Incomplete"))
                .retrieve().toBodilessEntity()
        }
        assertThat(ex.responseBodyAsString).contains("do-not-translate")
    }
}
