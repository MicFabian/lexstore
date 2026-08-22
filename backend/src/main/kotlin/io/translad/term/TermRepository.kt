package io.translad.term

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
    fun findByProjectIdOrderByCreatedAtDesc(projectId: UUID): List<Term>
    fun findByProjectIdOrderByCreatedAtDesc(projectId: UUID, pageable: Pageable): List<Term>
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
}
