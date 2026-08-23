package io.lexstore.ai

import tools.jackson.databind.JsonNode
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

/**
 * Translator backed by the Google Gemini API. Active only when an API key is
 * configured (GEMINI_API_KEY) and settings select provider="gemini"; otherwise
 * the service falls back to [MockTranslator].
 */
@Component
class GeminiTranslator(
    @Value("\${gemini.api-key:}") private val apiKey: String,
    @Value("\${gemini.base-url:https://generativelanguage.googleapis.com}") baseUrl: String,
) : Translator {
    override val provider = "gemini"

    val available: Boolean get() = apiKey.isNotBlank()

    private fun keyFor(input: TranslateInput): String =
        input.apiKey?.takeIf { it.isNotBlank() } ?: apiKey

    private val client = io.lexstore.common.OutboundHttp.client(baseUrl)

    override fun translate(input: TranslateInput): TranslateOutput {
        require(keyFor(input).isNotBlank()) { "Gemini API key is not configured." }

        val body = mapOf(
            "systemInstruction" to mapOf(
                "parts" to listOf(mapOf("text" to TranslationPrompt.system(input))),
            ),
            "contents" to listOf(
                mapOf("role" to "user", "parts" to listOf(mapOf("text" to input.sourceText))),
            ),
            "generationConfig" to mapOf("temperature" to input.temperature, "maxOutputTokens" to 512),
        )

        val res: JsonNode = client.post()
            .uri("/v1beta/models/{model}:generateContent", input.model)
            .header("x-goog-api-key", keyFor(input))
            .header("content-type", "application/json")
            .body(body)
            .retrieve()
            .body(JsonNode::class.java)!!

        val text = res.path("candidates").firstOrNull()
            ?.path("content")?.path("parts")?.firstOrNull()
            ?.path("text")?.asText()?.trim().orEmpty()
        val usage = res.path("usageMetadata")
        // An empty answer is a failure, not a translation: saved as one it
        // would blank the string and count as done.
        require(text.isNotBlank()) { "Gemini returned no translation." }

        return TranslateOutput(
            text = text,
            model = res.path("modelVersion").asText(input.model),
            inputTokens = usage.path("promptTokenCount").asInt(0),
            outputTokens = usage.path("candidatesTokenCount").asInt(0),
        )
    }
}
