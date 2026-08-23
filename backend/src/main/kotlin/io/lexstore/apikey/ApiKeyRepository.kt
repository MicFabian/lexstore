package io.lexstore.apikey

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ApiKeyRepository : JpaRepository<ApiKey, UUID> {
    /** Looks a presented key up by its digest; the key itself is never stored. */
    fun findBySecretHash(secretHash: String): ApiKey?

    fun findByProjectIdOrderByCreatedLabel(projectId: UUID): List<ApiKey>
    fun findByOrgId(orgId: UUID): List<ApiKey>

    /** Recorded without loading the key, so authentication stays cheap. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
        "update ApiKey k set k.lastUsedAt = :at where k.id = :id",
    )
    fun markUsed(id: UUID, at: java.time.Instant)
}
