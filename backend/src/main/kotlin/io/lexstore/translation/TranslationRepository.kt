package io.lexstore.translation

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface LanguageStatusCounts {
    val languageCode: String
    val translated: Long
    val fuzzy: Long
}

interface ProjectTranslationCounts {
    val projectId: UUID
    val done: Long
    val fuzzy: Long
    val filled: Long
}

interface TranslationRepository : JpaRepository<Translation, UUID> {
    fun findByTermId(termId: UUID): List<Translation>
    fun findByTermIdIn(termIds: Collection<UUID>): List<Translation>
    fun findByTermIdInAndLanguageCode(termIds: Collection<UUID>, languageCode: String): List<Translation>
    fun findByTermIdAndLanguageCode(termId: UUID, languageCode: String): Translation?

    /** Removes a language's translations across a project, when it is deleted. */
    @org.springframework.data.jpa.repository.Modifying
    @Query(
        """
        delete from Translation tr
        where tr.languageCode = :languageCode
          and tr.termId in (select t.id from Term t where t.projectId = :projectId)
        """,
    )
    fun deleteByProjectAndLanguage(projectId: UUID, languageCode: String): Int

    @Query(
        """
        select t.projectId as projectId,
               sum(case when tr.status in (io.lexstore.common.TranslationStatus.TRANSLATED,
                                           io.lexstore.common.TranslationStatus.PROOFREAD)
                        then 1 else 0 end) as done,
               sum(case when tr.status = io.lexstore.common.TranslationStatus.FUZZY
                        then 1 else 0 end) as fuzzy,
               sum(case when tr.status <> io.lexstore.common.TranslationStatus.UNTRANSLATED
                             and tr.value is not null
                        then 1 else 0 end) as filled
        from Translation tr join Term t on t.id = tr.termId
        group by t.projectId
        """,
    )
    fun countsByProject(): List<ProjectTranslationCounts>

    @Query(
        """
        select tr.languageCode as languageCode,
               sum(case when tr.status in (io.lexstore.common.TranslationStatus.TRANSLATED,
                                           io.lexstore.common.TranslationStatus.PROOFREAD)
                        then 1 else 0 end) as translated,
               sum(case when tr.status = io.lexstore.common.TranslationStatus.FUZZY
                        then 1 else 0 end) as fuzzy
        from Translation tr join Term t on t.id = tr.termId
        where t.projectId = :projectId
        group by tr.languageCode
        """,
    )
    fun statusCountsByLanguage(projectId: UUID): List<LanguageStatusCounts>
}
