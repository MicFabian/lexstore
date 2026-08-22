package io.lexstore.apikey

import io.lexstore.common.ApiKeyScope
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.util.UUID

@Entity
@Table(name = "api_key")
class ApiKey(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "project_id", nullable = false)
    val projectId: UUID,

    @Column(nullable = false)
    var label: String,

    @Column(nullable = false)
    var prefix: String,

    @Column(nullable = false)
    var tail: String,

    /**
     * SHA-256 of the generated secret. The secret itself is shown once, at
     * creation, and never stored: a database or backup copy must not yield a
     * usable credential.
     */
    @Column(name = "secret_hash", nullable = false)
    var secretHash: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var scope: ApiKeyScope = ApiKeyScope.READ_WRITE,

    @Column(name = "created_label", nullable = false)
    var createdLabel: String,

    @Column(name = "last_used_label", nullable = false)
    var lastUsedLabel: String = "—",
)
