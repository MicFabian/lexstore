package io.translad.io

import tools.jackson.databind.JsonNode
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatusCode
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestClient
import java.util.concurrent.locks.ReentrantLock

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
    /** POEditor allows a limited number of calls per period; keep well under it. */
    @Value("\${poeditor.min-interval-ms:1200}") private val minIntervalMs: Long,
    @Value("\${poeditor.max-retries:3}") private val maxRetries: Int,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val client = io.translad.common.OutboundHttp.client(baseUrl)

    /** Serializes calls across all imports so one account never bursts. */
    private val throttle = ReentrantLock()
    private var lastCallAt = 0L

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

        var attempt = 0
        while (true) {
            attempt++
            val res = exchange(path, form)
            if (res.rateLimited) {
                if (attempt > maxRetries) {
                    throw PoeditorRateLimitException(
                        "POEditor rate limit reached. Wait a minute and import fewer languages at a time.",
                    )
                }
                val backoff = res.retryAfterMs ?: backoffFor(attempt)
                log.info("POEditor rate limited on {}; retrying in {}ms (attempt {})", path, backoff, attempt)
                Thread.sleep(backoff)
                continue
            }

            val body = res.body ?: throw PoeditorException("POEditor returned an empty response.")
            val status = body.path("response").path("status").asText()
            if (status != "success") {
                val message = body.path("response").path("message").asText("POEditor request failed")
                if (message.contains("limit", ignoreCase = true) && attempt <= maxRetries) {
                    Thread.sleep(backoffFor(attempt))
                    continue
                }
                throw PoeditorException(message)
            }
            return body.path("result")
        }
    }

    private data class Response(
        val body: JsonNode?,
        val rateLimited: Boolean,
        val retryAfterMs: Long? = null,
    )

    /** One throttled call: never faster than [minIntervalMs] since the previous one. */
    private fun backoffFor(attempt: Int): Long {
        val base = minIntervalMs * (1L shl (attempt - 1))
        return base + java.util.concurrent.ThreadLocalRandom.current().nextLong(0, minIntervalMs)
    }

    private fun exchange(path: String, form: LinkedMultiValueMap<String, String>): Response {
        throttle.lock()
        try {
            val since = System.currentTimeMillis() - lastCallAt
            if (since < minIntervalMs) Thread.sleep(minIntervalMs - since)

            var limited = false
            var retryAfterMs: Long? = null
            val body = client.post()
                .uri(path)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .exchange { _, response ->
                    val code: HttpStatusCode = response.statusCode
                    limited = code.value() == 429
                    if (limited) retryAfterMs = retryAfterOf(response.headers.getFirst("Retry-After"))
                    if (limited || code.isError) null else response.bodyTo(JsonNode::class.java)
                }
            lastCallAt = System.currentTimeMillis()
            return Response(body, limited, retryAfterMs)
        } finally {
            throttle.unlock()
        }
    }
}

/**
 * The provider's own delay wins when it states one; otherwise back off
 * exponentially with jitter, so several imports that were rate limited at the
 * same moment do not retry in lockstep.
 */
private fun retryAfterOf(header: String?): Long? {
    val seconds = header?.trim()?.toLongOrNull() ?: return null
    return (seconds * 1000).coerceIn(0, 60_000)
}

class PoeditorRateLimitException(message: String) : RuntimeException(message)

class PoeditorException(message: String) : RuntimeException(message)
