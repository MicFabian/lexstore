package io.lexstore.project

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ProjectRepository : JpaRepository<Project, UUID> {

    /**
     * Bump the project's activity clock without loading it. Called from write
     * paths so the dashboard's "updated" column reflects real work.
     */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
        "update Project p set p.updatedAt = :at where p.id = :id",
    )
    fun touch(id: UUID, at: java.time.Instant)

    fun findByCode(code: String): Project?
    fun countByOrgId(orgId: UUID): Long
    fun findByOrgId(orgId: UUID): List<Project>
    fun existsByCode(code: String): Boolean
}
