package io.lexstore.ai

import jakarta.validation.constraints.DecimalMax
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.util.UUID

/**
 * Every field here reaches a paid provider, so each one is bounded: an
 * unbounded prompt is an unbounded bill, and a non-finite temperature is a
 * request no provider can answer.
 */
data class TranslateRequest(
    @field:NotBlank @field:Size(max = 4000) val sourceText: String,
    @field:NotBlank @field:Size(max = 16) val sourceLang: String,
    @field:NotBlank @field:Size(max = 16) val targetLang: String,
    /** Optional overrides; otherwise the saved AI settings are used. */
    @field:Size(max = 100) val model: String? = null,
    @field:DecimalMin("0.0") @field:DecimalMax("2.0") val temperature: Double? = null,
    @field:Size(max = 500) val tone: String? = null,
    @field:Size(max = 32) val formality: String? = null,
    /** Domain and glossary guidance, usually the calling project's context. */
    @field:Size(max = 4000) val projectContext: String? = null,
    /** Skip the cache and force a fresh translation. */
    val noCache: Boolean = false,
    /** Whose key and budget this call uses; null falls back to the environment. */
    val projectId: java.util.UUID? = null,
)

data class TranslateResponse(
    val text: String,
    val provider: String,
    val model: String,
    val cacheHit: Boolean,
    val latencyMs: Long,
    val inputTokens: Int,
    val outputTokens: Int,
)

data class RequestLogView(
    val id: UUID,
    val sourceText: String,
    val sourceLang: String,
    val targetLang: String,
    val provider: String,
    val model: String,
    val resultText: String?,
    val cacheHit: Boolean,
    val latencyMs: Long,
    val inputTokens: Int,
    val outputTokens: Int,
    val status: String,
    val errorMessage: String?,
    val at: String,
)

data class CacheEntryView(
    val id: UUID,
    val sourceText: String,
    val sourceLang: String,
    val targetLang: String,
    val provider: String,
    val model: String,
    val targetText: String,
    val hits: Long,
    val createdAt: String,
    val lastUsedAt: String,
)

data class CacheStats(
    val entries: Long,
    val totalHits: Long,
    val requests: Long,
    val cacheHits: Long,
    val hitRate: Int,
)

data class AiSettingsView(
    val provider: String,
    val model: String,
    val temperature: Double,
    val formality: String,
    val tone: String?,
    val autoFlagFuzzy: Boolean,
    val cacheTtlHours: Int,
    val claudeAvailable: Boolean,
    val geminiAvailable: Boolean,
)

data class UpdateAiSettings(
    @field:Size(max = 32) val provider: String?,
    @field:Size(max = 100) val model: String?,
    @field:DecimalMin("0.0") @field:DecimalMax("2.0") val temperature: Double?,
    @field:Size(max = 32) val formality: String?,
    @field:Size(max = 500) val tone: String?,
    val autoFlagFuzzy: Boolean?,
    @field:jakarta.validation.constraints.Min(0)
    @field:jakarta.validation.constraints.Max(8760)
    val cacheTtlHours: Int?,
)
