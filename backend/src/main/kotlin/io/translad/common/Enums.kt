package io.translad.common

enum class TranslationStatus {
    UNTRANSLATED, TRANSLATED, FUZZY, PROOFREAD;

    companion object {
        fun from(raw: String): TranslationStatus =
            entries.firstOrNull { it.name.equals(raw, ignoreCase = true) } ?: UNTRANSLATED
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
