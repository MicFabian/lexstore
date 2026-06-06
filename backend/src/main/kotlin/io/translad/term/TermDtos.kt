package io.translad.term

import com.fasterxml.jackson.annotation.JsonProperty
import jakarta.validation.constraints.NotBlank
import java.util.UUID

data class PluralForms(val one: String?, val other: String?)

data class CommentView(
    val id: UUID,
    val authorName: String,
    val authorAvatar: Int,
    val text: String,
    val time: String,
)

data class TermTranslationView(
    val code: String,
    val name: String,
    val value: String?,
    val status: String,
    /** Who last changed this translation (null if never edited). */
    val modifiedBy: AuditEntry?,
)

data class AuditEntry(val name: String, val avatar: Int, val action: String, val at: String)

/** Full term as shown in the Terms screen expandable row. */
data class TermView(
    val id: UUID,
    val key: String,
    val ctx: String,
    val source: String,
    val plural: PluralForms?,
    val tags: List<String>,
    @get:JsonProperty("isNew") val isNew: Boolean,
    val added: String,
    val createdAt: String,
    val createdBy: AuditEntry?,
    val modifiedAt: String?,
    val modifiedBy: AuditEntry?,
    val translations: List<TermTranslationView>,
    val comments: List<CommentView>,
    val history: List<AuditEntry>,
)

/** One row in the translation editor for a single target language. */
data class EditorRow(
    val id: UUID,
    val key: String,
    val ctx: String,
    val source: String,
    val plural: PluralForms?,
    val tags: List<String>,
    @get:JsonProperty("isNew") val isNew: Boolean,
    val target: String?,
    val status: String,
    val comments: List<CommentView>,
    /** Who last changed this translation, and when (null if never edited). */
    val modifiedBy: AuditEntry?,
    val modifiedAt: String?,
)

data class EditorResponse(
    val languageCode: String,
    val sourceLang: String,
    val rows: List<EditorRow>,
)

/** Minimal pagination envelope for collection endpoints that can grow. */
data class Page<T>(
    val content: List<T>,
    val page: Int,
    val size: Int,
    val total: Long,
) {
    companion object {
        fun <T> of(all: List<T>, page: Int, size: Int): Page<T> {
            val from = (page * size).coerceIn(0, all.size)
            val to = (from + size).coerceIn(from, all.size)
            return Page(all.subList(from, to), page, size, all.size.toLong())
        }
    }
}

data class CreateTermRequest(
    @field:NotBlank val key: String,
    @field:NotBlank val source: String,
    val ctx: String? = null,
    val tags: List<String>? = null,
    val pluralOne: String? = null,
    val pluralOther: String? = null,
)

data class UpdateTermRequest(
    val source: String?,
    val ctx: String?,
    val tags: List<String>?,
)

data class AddCommentRequest(
    @field:NotBlank val text: String,
    // Author is taken from the authenticated user; these are accepted but ignored.
    val authorName: String? = null,
    val authorAvatar: Int? = null,
)
