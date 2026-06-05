package io.translad.ai

/** Request to translate one source string into a target language. */
data class TranslateInput(
    val sourceText: String,
    val sourceLang: String,
    val targetLang: String,
    val model: String,
    val temperature: Double,
    /** Optional style/glossary guidance applied to the prompt. */
    val tone: String? = null,
    /** informal | formal | neutral */
    val formality: String? = null,
)

/** Result of a translation, plus the token accounting needed for the request log. */
data class TranslateOutput(
    val text: String,
    val model: String,
    val inputTokens: Int,
    val outputTokens: Int,
)

/** Pluggable machine-translation backend. */
interface Translator {
    /** Stable id stored on requests/cache (e.g. "mock", "claude"). */
    val provider: String

    fun translate(input: TranslateInput): TranslateOutput
}
