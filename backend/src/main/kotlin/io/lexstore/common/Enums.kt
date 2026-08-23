package io.lexstore.common

enum class TranslationStatus {
    UNTRANSLATED, TRANSLATED, FUZZY, PROOFREAD;

    companion object {
        /** Lenient parse, for seeds and internal callers that supply a known value. */
        fun from(raw: String): TranslationStatus =
            entries.firstOrNull { it.name.equals(raw, ignoreCase = true) } ?: UNTRANSLATED

        /**
         * Strict parse for anything a caller sends. Falling back to
         * UNTRANSLATED turned a typo such as "proofred" into a silent change of
         * workflow state.
         */
        fun parse(raw: String): TranslationStatus =
            entries.firstOrNull { it.name.equals(raw, ignoreCase = true) }
                ?: throw IllegalArgumentException(
                    "Unknown status '\$raw'. Use one of: " +
                        entries.joinToString(", ") { it.name.lowercase() } + ".",
                )
    }
}

enum class ContributorRole {
    OWNER, ADMIN, TRANSLATOR, PROOFREADER;

    companion object {
        /** Lenient parse for seeding and invites; unknown input becomes a translator. */
        fun from(raw: String): ContributorRole = parse(raw) ?: TRANSLATOR

        /** Strict parse: null when the caller sent something that is not a role. */
        fun parse(raw: String): ContributorRole? =
            entries.firstOrNull { it.name.equals(raw, ignoreCase = true) }
    }
}

enum class ApiKeyScope { READ_ONLY, READ_WRITE }
