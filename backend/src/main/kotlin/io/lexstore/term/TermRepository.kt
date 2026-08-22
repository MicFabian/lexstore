package io.lexstore.term

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface ProjectTermCounts {
    val projectId: UUID
    val total: Long
    val newTerms: Long
}

interface TermRepository : JpaRepository<Term, UUID> {
    /**
     * Ordered by id as well as time: seeded and imported terms share a
     * timestamp, and without a unique tiebreaker paging can repeat or skip
     * rows between requests.
     */
    fun findByProjectIdOrderByCreatedAtDescIdAsc(projectId: UUID): List<Term>
    fun findByProjectIdOrderByCreatedAtDescIdAsc(projectId: UUID, pageable: Pageable): List<Term>
    fun findByProjectIdAndKey(projectId: UUID, key: String): Term?
    fun existsByProjectIdAndKey(projectId: UUID, key: String): Boolean
    fun countByProjectId(projectId: UUID): Long
    fun findByFeatureId(featureId: UUID): List<Term>
    fun findByFeatureIdIn(featureIds: Collection<UUID>): List<Term>
    fun countByFeatureId(featureId: UUID): Long

    @Query(
        """
        select t.projectId as projectId,
               count(t) as total,
               sum(case when t.isNew = true then 1 else 0 end) as newTerms
        from Term t
        group by t.projectId
        """,
    )
    fun countsByProject(): List<ProjectTermCounts>

    @Query("select t.id from Term t where t.projectId = :projectId")
    fun idsByProject(projectId: UUID): List<UUID>

    /**
     * Term ids for one page of the editor, filtered the way the screen filters:
     * by status in the addressed language, by key or source text, and by
     * feature. Ordering matches the unfiltered editor so paging is stable.
     */
    @Query(
        """
        select t.id from Term t
        left join Translation tr on tr.termId = t.id and tr.languageCode = :lang
        where t.projectId = :projectId
          and (:featureId is null or t.featureId = :featureId)
          and (:q = '' or lower(t.key) like lower(concat('%', :q, '%'))
                       or lower(t.sourceText) like lower(concat('%', :q, '%')))
          and (
            :status = ''
            or (:status = 'new' and t.isNew = true)
            or (:status = 'untranslated' and (tr is null or tr.value is null or tr.value = ''
                                              or tr.status = io.lexstore.common.TranslationStatus.UNTRANSLATED))
            or (:status = 'fuzzy' and tr.status = io.lexstore.common.TranslationStatus.FUZZY)
            or (:status = 'proofread' and tr.status = io.lexstore.common.TranslationStatus.PROOFREAD)
          )
        order by t.createdAt desc, t.id
        """,
    )
    fun editorPageIds(
        projectId: UUID,
        lang: String,
        status: String,
        q: String,
        featureId: UUID?,
        pageable: Pageable,
    ): List<UUID>

    @Query(
        """
        select count(t) from Term t
        left join Translation tr on tr.termId = t.id and tr.languageCode = :lang
        where t.projectId = :projectId
          and (:featureId is null or t.featureId = :featureId)
          and (:q = '' or lower(t.key) like lower(concat('%', :q, '%'))
                       or lower(t.sourceText) like lower(concat('%', :q, '%')))
          and (
            :status = ''
            or (:status = 'new' and t.isNew = true)
            or (:status = 'untranslated' and (tr is null or tr.value is null or tr.value = ''
                                              or tr.status = io.lexstore.common.TranslationStatus.UNTRANSLATED))
            or (:status = 'fuzzy' and tr.status = io.lexstore.common.TranslationStatus.FUZZY)
            or (:status = 'proofread' and tr.status = io.lexstore.common.TranslationStatus.PROOFREAD)
          )
        """,
    )
    fun editorCount(
        projectId: UUID,
        lang: String,
        status: String,
        q: String,
        featureId: UUID?,
    ): Long

    fun findByIdIn(ids: Collection<UUID>): List<Term>
}
