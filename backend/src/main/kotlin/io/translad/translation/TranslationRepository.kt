package io.translad.translation

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface ProjectTranslationCounts {
    val projectId: UUID
    val done: Long
    val fuzzy: Long
    val filled: Long
}

interface TranslationRepository : JpaRepository<Translation, UUID> {
    fun findByTermId(termId: UUID): List<Translation>
    fun findByTermIdIn(termIds: Collection<UUID>): List<Translation>
    fun findByTermIdAndLanguageCode(termId: UUID, languageCode: String): Translation?

    @Query(
        """
        select t.projectId as projectId,
               sum(case when tr.status in (io.translad.common.TranslationStatus.TRANSLATED,
                                           io.translad.common.TranslationStatus.PROOFREAD)
                        then 1 else 0 end) as done,
               sum(case when tr.status = io.translad.common.TranslationStatus.FUZZY
                        then 1 else 0 end) as fuzzy,
               sum(case when tr.status <> io.translad.common.TranslationStatus.UNTRANSLATED
                             and tr.value is not null
                        then 1 else 0 end) as filled
        from Translation tr join Term t on t.id = tr.termId
        group by t.projectId
        """,
    )
    fun countsByProject(): List<ProjectTranslationCounts>
}
