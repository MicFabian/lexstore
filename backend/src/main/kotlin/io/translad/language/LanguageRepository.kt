package io.translad.language

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface LanguageRepository : JpaRepository<Language, UUID> {
    fun findByProjectIdOrderByName(projectId: UUID): List<Language>
    fun findByProjectIdAndCode(projectId: UUID, code: String): Language?
    fun existsByProjectIdAndCode(projectId: UUID, code: String): Boolean
}
