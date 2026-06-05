package io.translad.translation

import io.translad.common.TranslationStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.Instant
import java.util.UUID

@Entity
@Table(
    name = "translation",
    uniqueConstraints = [UniqueConstraint(columnNames = ["term_id", "language_code"])],
)
class Translation(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "term_id", nullable = false)
    val termId: UUID,

    @Column(name = "language_code", nullable = false)
    val languageCode: String,

    @Column(length = 2000)
    var value: String? = null,

    @Column(name = "plural_one")
    var pluralOne: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: TranslationStatus = TranslationStatus.UNTRANSLATED,

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
)
