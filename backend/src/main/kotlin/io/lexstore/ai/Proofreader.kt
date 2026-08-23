package io.lexstore.ai

import tools.jackson.databind.JsonNode

/** One thing the proofreader believes is wrong with a translation. */
data class ProofreadIssue(
    /** placeholder | terminology | grammar | tone | length | meaning */
    val kind: String,
    /** minor | major */
    val severity: String,
    val message: String,
)

data class ProofreadResult(
    val verdict: String,
    val issues: List<ProofreadIssue>,
    val suggestion: String?,
    val provider: String,
    val model: String,
)

/**
 * Reviews an existing translation instead of producing one.
 *
 * The prompt asks for JSON so the answer can be acted on rather than only read,
 * and the checks a machine can do exactly — placeholders, glossary terms — are
 * verified in code afterwards rather than trusted to the model.
 */
object ProofreadPrompt {
    fun system(sourceLang: String, targetLang: String, context: String?): String = buildString {
        append("You are a senior localization reviewer. You are given a source string in ")
        append("$sourceLang and its $targetLang translation. Judge the translation. ")
        context?.takeIf { it.isNotBlank() }?.let {
            append("Project context and glossary — treat it as binding: $it. ")
        }
        append("Reply with ONLY a JSON object of this shape: ")
        append("""{"verdict":"good|needs_work|wrong",""")
        append(""""issues":[{"kind":"placeholder|terminology|grammar|tone|length|meaning",""")
        append(""""severity":"minor|major","message":"one sentence"}],""")
        append(""""suggestion":"a corrected translation, or null when the translation is fine"}""")
        append(". Report only real problems; an empty issues array is the right answer for a good translation.")
    }

    fun user(sourceText: String, translation: String): String =
        "Source: $sourceText\nTranslation: $translation"
}

/** Parses the model's JSON, tolerating the fences some models wrap it in. */
object ProofreadParser {
    fun parse(raw: String, mapper: tools.jackson.databind.ObjectMapper): JsonNode? {
        val cleaned = raw.trim()
            .removePrefix("```json").removePrefix("```")
            .removeSuffix("```")
            .trim()
        val start = cleaned.indexOf('{')
        val end = cleaned.lastIndexOf('}')
        if (start < 0 || end <= start) return null
        return runCatching { mapper.readTree(cleaned.substring(start, end + 1)) }.getOrNull()
    }
}
