package io.lexstore.glossary

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.validation.constraints.NotBlank
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant
import java.util.UUID

/**
 * A term the project wants translated a particular way, or not at all.
 *
 * A null languageCode makes the rule apply to every language, which is what a
 * do-not-translate entry for a product name needs.
 */
@Entity
@Table(name = "glossary_entry")
class GlossaryEntry(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "project_id", nullable = false)
    val projectId: UUID,

    @Column(nullable = false)
    var term: String,

    @Column(name = "language_code")
    var languageCode: String? = null,

    @Column
    var translation: String? = null,

    @Column(name = "do_not_translate", nullable = false)
    var doNotTranslate: Boolean = false,

    @Column
    var note: String? = null,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)

interface GlossaryRepository : JpaRepository<GlossaryEntry, UUID> {
    fun findByProjectIdOrderByTerm(projectId: UUID): List<GlossaryEntry>
    fun findByProjectIdAndTermIgnoreCase(projectId: UUID, term: String): List<GlossaryEntry>
}

data class GlossaryEntryView(
    val id: UUID,
    val term: String,
    val languageCode: String?,
    val translation: String?,
    val doNotTranslate: Boolean,
    val note: String?,
)

data class SaveGlossaryEntryRequest(
    @field:NotBlank val term: String,
    val languageCode: String? = null,
    val translation: String? = null,
    val doNotTranslate: Boolean = false,
    val note: String? = null,
)
