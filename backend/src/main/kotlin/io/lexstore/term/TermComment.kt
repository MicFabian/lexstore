package io.lexstore.term

import io.lexstore.common.RelativeTime
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "term_comment")
class TermComment(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "term_id", nullable = false)
    val termId: UUID,

    @Column(name = "author_name", nullable = false)
    var authorName: String,

    @Column(name = "author_avatar", nullable = false)
    var authorAvatar: Int = 0,

    @Column(nullable = false, length = 2000)
    var text: String,

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
)

fun TermComment.toView(): CommentView =
    CommentView(id, authorName, authorAvatar, text, RelativeTime.format(createdAt))
