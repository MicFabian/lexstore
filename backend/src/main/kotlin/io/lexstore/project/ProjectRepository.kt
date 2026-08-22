package io.lexstore.project

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ProjectRepository : JpaRepository<Project, UUID> {
    fun findByCode(code: String): Project?
    fun existsByCode(code: String): Boolean
}
