package io.lexstore.translation

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface LastActivity {
    val authorName: String
    val at: java.time.Instant
}

interface TranslationEventRepository : JpaRepository<TranslationEvent, UUID> {

    /** When each person last changed anything in this project. */
    @org.springframework.data.jpa.repository.Query(
        """
        select e.authorName as authorName, max(e.createdAt) as at
        from TranslationEvent e
        where e.projectId = :projectId
        group by e.authorName
        """,
    )
    fun lastActivityByAuthor(projectId: UUID): List<LastActivity>

    fun findByTermIdOrderByCreatedAtDesc(termId: UUID): List<TranslationEvent>
    fun findByTermIdOrderByCreatedAtDesc(termId: UUID, pageable: Pageable): List<TranslationEvent>
    fun findByTermIdAndLanguageCodeOrderByCreatedAtDesc(termId: UUID, languageCode: String): List<TranslationEvent>
    fun findByTermIdInOrderByCreatedAtDesc(termIds: Collection<UUID>): List<TranslationEvent>
}
