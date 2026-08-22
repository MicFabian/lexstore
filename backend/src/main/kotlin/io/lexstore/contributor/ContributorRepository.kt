package io.lexstore.contributor

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ContributorRepository : JpaRepository<Contributor, UUID> {
    fun findByProjectIdOrderByName(projectId: UUID): List<Contributor>
    fun countByProjectId(projectId: UUID): Long
    fun findByProjectId(projectId: UUID): List<Contributor>
    fun findByEmailIgnoreCase(email: String): List<Contributor>
}
