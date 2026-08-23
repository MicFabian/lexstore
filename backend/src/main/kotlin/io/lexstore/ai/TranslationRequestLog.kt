package io.lexstore.ai

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/** Audit row for every translate call — hit or miss — powering the AI overview. */
@Entity
@Table(name = "translation_request")
class TranslationRequestLog(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "project_id")
    val projectId: java.util.UUID? = null,

    @Column(name = "org_id")
    val orgId: java.util.UUID? = null,

    /** PROJECT | ORGANISATION | PLATFORM_AGENT | ENVIRONMENT */
    @Column(name = "credential_source")
    val credentialSource: String? = null,

    @Column(name = "source_text", nullable = false, length = 4000)
    val sourceText: String,

    @Column(name = "source_lang", nullable = false)
    val sourceLang: String,

    @Column(name = "target_lang", nullable = false)
    val targetLang: String,

    @Column(nullable = false)
    val provider: String,

    @Column(nullable = false)
    val model: String,

    @Column(name = "result_text", length = 4000)
    val resultText: String?,

    @Column(name = "cache_hit", nullable = false)
    val cacheHit: Boolean,

    @Column(name = "latency_ms", nullable = false)
    val latencyMs: Long,

    @Column(name = "input_tokens", nullable = false)
    val inputTokens: Int = 0,

    @Column(name = "output_tokens", nullable = false)
    val outputTokens: Int = 0,

    /** ok | error */
    @Column(nullable = false)
    val status: String = "ok",

    @Column(name = "error_message")
    val errorMessage: String? = null,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
