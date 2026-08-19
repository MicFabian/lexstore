package io.translad.io

import tools.jackson.databind.JsonNode
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestClient

data class PoeditorProject(val id: Long, val name: String, val terms: Int?)

data class PoeditorLanguage(val code: String, val name: String, val translations: Int, val percentage: Int)

/** One source string with its translation in the requested language. */
data class PoeditorTerm(
    val term: String,
    val context: String?,
    val translation: String?,
    val fuzzy: Boolean,
    val tags: List<String>,
)

/**
 * Read-only client for the POEditor v2 API. The API token belongs to the user
 * running the import: it is passed per call and never stored.
 */
@Component
class PoeditorClient(
    @Value("\${poeditor.base-url:https://api.poeditor.com}") baseUrl: String,
) {
    private val client = RestClient.builder().baseUrl(baseUrl).build()

    fun projects(token: String): List<PoeditorProject> =
        post(token, "/v2/projects/list").path("projects").map {
            PoeditorProject(
                id = it.path("id").asLong(),
                name = it.path("name").asText(),
                terms = it.path("terms").takeIf { n -> !n.isMissingNode }?.asInt(),
            )
        }

    fun languages(token: String, projectId: Long): List<PoeditorLanguage> =
        post(token, "/v2/languages/list", "id" to projectId.toString()).path("languages").map {
            PoeditorLanguage(
                code = it.path("code").asText(),
                name = it.path("name").asText(),
                translations = it.path("translations").asInt(0),
                percentage = it.path("percentage").asInt(0),
            )
        }

    fun terms(token: String, projectId: Long, language: String): List<PoeditorTerm> =
        post(token, "/v2/terms/list", "id" to projectId.toString(), "language" to language)
            .path("terms").map {
                val translation = it.path("translation").path("content")
                PoeditorTerm(
                    term = it.path("term").asText(),
                    context = it.path("context").asText("").ifBlank { null },
                    // Plural translations arrive as an object; only singular content is imported.
                    translation = translation.takeIf { t -> t.isTextual }?.asText()?.ifBlank { null },
                    fuzzy = it.path("translation").path("fuzzy").asInt(0) == 1,
                    tags = it.path("tags").map { t -> t.asText() },
                )
            }

    private fun post(token: String, path: String, vararg params: Pair<String, String>): JsonNode {
        val form = LinkedMultiValueMap<String, String>()
        form.add("api_token", token)
        params.forEach { (k, v) -> form.add(k, v) }

        val res: JsonNode = client.post()
            .uri(path)
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve()
            .body(JsonNode::class.java) ?: throw PoeditorException("POEditor returned an empty response.")

        val status = res.path("response").path("status").asText()
        if (status != "success") {
            throw PoeditorException(res.path("response").path("message").asText("POEditor request failed"))
        }
        return res.path("result")
    }
}

class PoeditorException(message: String) : RuntimeException(message)
