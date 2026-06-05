package io.translad.translation

import io.translad.common.TranslationStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/** Immutable audit record: one row per saved change to a translation. */
@Entity
@Table(name = "translation_event")
class TranslationEvent(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "project_id", nullable = false)
    val projectId: UUID,

    @Column(name = "term_id", nullable = false)
    val termId: UUID,

    @Column(name = "language_code", nullable = false)
    val languageCode: String,

    /** edited | proofread | flagged | cleared */
    @Column(nullable = false)
    val action: String,

    @Column(name = "old_value", length = 2000)
    val oldValue: String? = null,

    @Column(name = "new_value", length = 2000)
    val newValue: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "old_status")
    val oldStatus: TranslationStatus? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", nullable = false)
    val newStatus: TranslationStatus,

    @Column(name = "author_name", nullable = false)
    val authorName: String,

    @Column(name = "author_avatar", nullable = false)
    val authorAvatar: Int = 0,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
