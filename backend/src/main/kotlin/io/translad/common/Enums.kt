package io.translad.common

enum class TranslationStatus {
    UNTRANSLATED, TRANSLATED, FUZZY, PROOFREAD;

    companion object {
        fun from(raw: String): TranslationStatus =
            entries.firstOrNull { it.name.equals(raw, ignoreCase = true) } ?: UNTRANSLATED
    }
}

enum class ContributorRole {
    ADMIN, TRANSLATOR, PROOFREADER;

    companion object {
        fun from(raw: String): ContributorRole =
            entries.firstOrNull { it.name.equals(raw, ignoreCase = true) } ?: TRANSLATOR
    }
}

enum class ApiKeyScope { READ_ONLY, READ_WRITE }
