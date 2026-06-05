package io.translad.contributor

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ContributorRepository : JpaRepository<Contributor, UUID> {
    fun findByProjectIdOrderByName(projectId: UUID): List<Contributor>
    fun countByProjectId(projectId: UUID): Long
}
