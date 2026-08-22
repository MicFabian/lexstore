package io.lexstore.ai

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.springframework.data.jpa.repository.JpaRepository

/** Global AI translation configuration (single row, id = 1). */
@Entity
@Table(name = "ai_settings")
class AiSettings(
    @Id
    val id: Int = 1,

    @Column(nullable = false)
    var provider: String = "mock",

    @Column(nullable = false)
    var model: String = "claude-haiku-4-5",

    @Column(nullable = false)
    var temperature: Double = 0.2,

    /** informal | formal | neutral */
    @Column(nullable = false)
    var formality: String = "neutral",

    @Column(length = 1000)
    var tone: String? = null,

    @Column(name = "auto_flag_fuzzy", nullable = false)
    var autoFlagFuzzy: Boolean = true,

    @Column(name = "cache_ttl_hours", nullable = false)
    var cacheTtlHours: Int = 720,
)

interface AiSettingsRepository : JpaRepository<AiSettings, Int>
