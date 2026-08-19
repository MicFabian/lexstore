package io.translad.feature

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/** A slice of a project's terms — a screen, flow, or release the team ships together. */
@Entity
@Table(name = "feature")
class Feature(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "project_id", nullable = false)
    val projectId: UUID,

    @Column(nullable = false)
    var name: String,

    @Column(name = "feature_key", nullable = false)
    var key: String,

    @Column(length = 1000)
    var description: String? = null,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
