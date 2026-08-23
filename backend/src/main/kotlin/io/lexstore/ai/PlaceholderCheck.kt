package io.lexstore.ai

/**
 * Compares the placeholders of a source string and its translation.
 *
 * This is the one class of translation bug that breaks software rather than
 * merely reading badly: {count} rendered as {cout} throws at runtime. It is
 * exact, so it is decided in code rather than asked of a model.
 */
object PlaceholderCheck {
    private val PATTERNS = listOf(
        Regex("""\{[^{}]{1,60}\}"""),        // {count}, {0}, {count, plural, ...}
        Regex("""%[sdfx@]"""),               // %s, %d, printf style
        Regex("""%\d+\$[sdfx@]"""),          // %1$s, positional printf
        Regex("""\$\{[^{}]{1,60}\}"""),      // ${name}
        Regex("""<[a-zA-Z][^<>]{0,40}>"""),  // <b>, <link>
    )

    fun placeholdersIn(text: String): List<String> =
        PATTERNS.flatMap { p -> p.findAll(text).map { it.value } }.sorted()

    /** Placeholders the translation is missing, and ones it invented. */
    fun compare(source: String, translation: String): PlaceholderDiff {
        val inSource = placeholdersIn(source)
        val inTarget = placeholdersIn(translation)
        val missing = inSource.toMutableList()
        val added = mutableListOf<String>()
        for (t in inTarget) {
            if (!missing.remove(t)) added += t
        }
        return PlaceholderDiff(missing, added)
    }

    fun issues(source: String, translation: String): List<ProofreadIssue> {
        if (translation.isBlank()) return emptyList()
        val diff = compare(source, translation)
        return buildList {
            diff.missing.takeIf { it.isNotEmpty() }?.let {
                add(
                    ProofreadIssue(
                        "placeholder",
                        "major",
                        "The translation is missing ${it.joinToString(", ")}, which the source string uses.",
                    ),
                )
            }
            diff.added.takeIf { it.isNotEmpty() }?.let {
                add(
                    ProofreadIssue(
                        "placeholder",
                        "major",
                        "The translation adds ${it.joinToString(", ")}, which the source string does not have.",
                    ),
                )
            }
        }
    }
}

data class PlaceholderDiff(val missing: List<String>, val added: List<String>)
