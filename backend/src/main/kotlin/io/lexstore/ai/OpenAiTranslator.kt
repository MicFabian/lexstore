package io.lexstore.ai

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode

/**
 * Translator backed by the OpenAI Chat Completions API. The key can come from
 * the environment or, per request, from a project or organisation credential.
 */
@Component
class OpenAiTranslator(
    @Value("\${openai.api-key:}") private val apiKey: String,
    @Value("\${openai.base-url:https://api.openai.com}") baseUrl: String,
) : Translator {
    override val provider = "openai"

    val available: Boolean get() = apiKey.isNotBlank()

    private val client = io.lexstore.common.OutboundHttp.client(baseUrl)

    private fun keyFor(input: TranslateInput): String =
        input.apiKey?.takeIf { it.isNotBlank() } ?: apiKey

    override fun translate(input: TranslateInput): TranslateOutput {
        val key = keyFor(input)
        require(key.isNotBlank()) { "OpenAI API key is not configured." }

        val body = mapOf(
            "model" to input.model,
            "temperature" to input.temperature,
            "messages" to listOf(
                mapOf("role" to "system", "content" to TranslationPrompt.system(input)),
                mapOf("role" to "user", "content" to input.sourceText),
            ),
        )

        val res: JsonNode = client.post()
            .uri("/v1/chat/completions")
            .header("authorization", "Bearer $key")
            .header("content-type", "application/json")
            .body(body)
            .retrieve()
            .body(JsonNode::class.java)!!

        val choice = res.path("choices").firstOrNull()
        val text = choice?.path("message")?.path("content")?.asText()?.trim().orEmpty()
        require(text.isNotBlank()) { "OpenAI returned no translation." }

        val usage = res.path("usage")
        return TranslateOutput(
            text = text,
            model = res.path("model").asText(input.model),
            inputTokens = usage.path("prompt_tokens").asInt(0),
            outputTokens = usage.path("completion_tokens").asInt(0),
        )
    }
}
