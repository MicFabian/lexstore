package io.lexstore.ai

import tools.jackson.databind.JsonNode
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

/**
 * Real translator backed by the Anthropic Messages API. Active only when an API
 * key is configured (ANTHROPIC_API_KEY) and settings select provider="claude";
 * otherwise the service falls back to [MockTranslator].
 */
@Component
class ClaudeTranslator(
    @Value("\${anthropic.api-key:}") private val apiKey: String,
    @Value("\${anthropic.base-url:https://api.anthropic.com}") baseUrl: String,
) : Translator {
    override val provider = "claude"

    val available: Boolean get() = apiKey.isNotBlank()

    private fun keyFor(input: TranslateInput): String =
        input.apiKey?.takeIf { it.isNotBlank() } ?: apiKey

    private val client = io.lexstore.common.OutboundHttp.client(baseUrl)

    override fun translate(input: TranslateInput): TranslateOutput {
        val key = keyFor(input)
        require(key.isNotBlank()) { "Anthropic API key is not configured." }

        val system = TranslationPrompt.system(input)

        val body = mapOf(
            "model" to input.model,
            "max_tokens" to 512,
            "temperature" to input.temperature,
            "system" to system,
            "messages" to listOf(mapOf("role" to "user", "content" to input.sourceText)),
        )

        val res: JsonNode = client.post()
            .uri("/v1/messages")
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .body(body)
            .retrieve()
            .body(JsonNode::class.java)!!

        val text = res.path("content").firstOrNull()?.path("text")?.asText()?.trim().orEmpty()
        val usage = res.path("usage")
        // An empty answer is a failure, not a translation: saved as one it
        // would blank the string and count as done.
        require(text.isNotBlank()) { "Anthropic returned no translation." }

        return TranslateOutput(
            text = text,
            model = res.path("model").asText(input.model),
            inputTokens = usage.path("input_tokens").asInt(0),
            outputTokens = usage.path("output_tokens").asInt(0),
        )
    }
}
