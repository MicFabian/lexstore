package io.translad.language

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface ProjectLanguageCount {
    val projectId: UUID
    val total: Long
}

interface LanguageRepository : JpaRepository<Language, UUID> {
    fun findByProjectIdOrderByName(projectId: UUID): List<Language>
    fun findByProjectIdAndCode(projectId: UUID, code: String): Language?
    fun existsByProjectIdAndCode(projectId: UUID, code: String): Boolean

    @Query("select l.projectId as projectId, count(l) as total from Language l group by l.projectId")
    fun countsByProject(): List<ProjectLanguageCount>
}
