package io.translad.apikey

import io.translad.common.ApiKeyScope
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

    /** Full secret, only returned once on creation. */
    @Column(name = "secret", nullable = false)
    var secret: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var scope: ApiKeyScope = ApiKeyScope.READ_WRITE,

    @Column(name = "created_label", nullable = false)
    var createdLabel: String,

    @Column(name = "last_used_label", nullable = false)
    var lastUsedLabel: String = "—",
)
