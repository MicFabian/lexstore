package io.translad.translation

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TranslationRepository : JpaRepository<Translation, UUID> {
    fun findByTermId(termId: UUID): List<Translation>
    fun findByTermIdIn(termIds: Collection<UUID>): List<Translation>
    fun findByTermIdAndLanguageCode(termId: UUID, languageCode: String): Translation?
}
