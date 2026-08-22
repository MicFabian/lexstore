package io.lexstore.ai

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
    /** Domain and glossary of the project this string belongs to. */
    val projectContext: String? = null,
)

/** The system prompt every real translator sends, so they stay comparable. */
object TranslationPrompt {
    fun system(input: TranslateInput): String = buildString {
        append("You are a professional software localizer. Translate the user's UI string ")
        append("from ${input.sourceLang} into ${input.targetLang}. ")
        append("Preserve placeholders (e.g. {count}, #, %s), punctuation, and capitalization style. ")
        input.projectContext?.takeIf { it.isNotBlank() }?.let {
            append("Project context and glossary — follow it over your own preference: $it. ")
        }
        input.formality?.let { append("Use a $it register. ") }
        input.tone?.let { append("Style guidance: $it. ") }
        append("Reply with ONLY the translation, no quotes, no explanation.")
    }
}

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
