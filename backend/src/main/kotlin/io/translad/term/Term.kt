package io.translad.term

import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderBy
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "term")
class Term(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "project_id", nullable = false)
    val projectId: UUID,

    @Column(name = "term_key", nullable = false)
    var key: String,

    @Column(nullable = false)
    var ctx: String = "",

    @Column(name = "source_text", nullable = false, length = 2000)
    var sourceText: String,

    @Column(name = "plural_one")
    var pluralOne: String? = null,

    @Column(name = "plural_other")
    var pluralOther: String? = null,

    /** Comma-joined tag slugs. */
    @Column(name = "tags")
    var tags: String = "",

    @Column(name = "is_new", nullable = false)
    var isNew: Boolean = false,

    @Column(name = "added_label", nullable = false)
    var addedLabel: String,

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),

    @OneToMany(mappedBy = "termId", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("createdAt ASC")
    val comments: MutableList<TermComment> = mutableListOf(),
) {
    val tagList: List<String>
        get() = tags.split(",").map { it.trim() }.filter { it.isNotEmpty() }

    val isPlural: Boolean get() = pluralOne != null || pluralOther != null
}
