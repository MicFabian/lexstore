package io.translad.translation

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TranslationEventRepository : JpaRepository<TranslationEvent, UUID> {
    fun findByTermIdOrderByCreatedAtDesc(termId: UUID): List<TranslationEvent>
    fun findByTermIdOrderByCreatedAtDesc(termId: UUID, pageable: Pageable): List<TranslationEvent>
    fun findByTermIdAndLanguageCodeOrderByCreatedAtDesc(termId: UUID, languageCode: String): List<TranslationEvent>
}
