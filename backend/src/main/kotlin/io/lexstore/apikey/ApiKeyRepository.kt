package io.lexstore.apikey

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ApiKeyRepository : JpaRepository<ApiKey, UUID> {
    fun findByProjectIdOrderByCreatedLabel(projectId: UUID): List<ApiKey>
}
