package io.translad.term

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TermRepository : JpaRepository<Term, UUID> {
    fun findByProjectIdOrderByCreatedAtDesc(projectId: UUID): List<Term>
    fun findByProjectIdOrderByCreatedAtDesc(projectId: UUID, pageable: Pageable): List<Term>
    fun findByProjectIdAndKey(projectId: UUID, key: String): Term?
    fun existsByProjectIdAndKey(projectId: UUID, key: String): Boolean
    fun countByProjectId(projectId: UUID): Long
    fun findByFeatureId(featureId: UUID): List<Term>
    fun countByFeatureId(featureId: UUID): Long
}
