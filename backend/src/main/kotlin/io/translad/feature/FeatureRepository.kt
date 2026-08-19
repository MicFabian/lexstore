package io.translad.feature

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface FeatureRepository : JpaRepository<Feature, UUID> {
    fun findByProjectIdOrderByName(projectId: UUID): List<Feature>
    fun findByProjectIdAndKey(projectId: UUID, key: String): Feature?
    fun existsByProjectIdAndKey(projectId: UUID, key: String): Boolean
}
