package io.lexstore.org

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant
import java.util.UUID

/**
 * A provider key belonging to either an organisation or a single project.
 * Exactly one of the two scopes is set; the database enforces that.
 */
@Entity
@Table(name = "ai_credential")
class AiCredential(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "org_id")
    val orgId: UUID? = null,

    @Column(name = "project_id")
    val projectId: UUID? = null,

    @Column(nullable = false)
    val provider: String,

    @Column(nullable = false)
    var label: String = "",

    @Column(name = "secret_cipher", nullable = false)
    var secretCipher: String,

    /** Last four characters, so a saved key is recognisable without revealing it. */
    @Column(nullable = false)
    var tail: String = "",

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "created_by")
    var createdBy: String? = null,
)

interface AiCredentialRepository : JpaRepository<AiCredential, UUID> {
    fun findByOrgId(orgId: UUID): List<AiCredential>
    fun findByProjectId(projectId: UUID): List<AiCredential>
    fun findByOrgIdAndProvider(orgId: UUID, provider: String): AiCredential?
    fun findByProjectIdAndProvider(projectId: UUID, provider: String): AiCredential?
}
