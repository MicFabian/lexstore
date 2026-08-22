package io.lexstore.ai

import jakarta.validation.constraints.NotBlank
import java.util.UUID

data class TranslateRequest(
    @field:NotBlank val sourceText: String,
    @field:NotBlank val sourceLang: String,
    @field:NotBlank val targetLang: String,
    /** Optional overrides; otherwise the saved AI settings are used. */
    val model: String? = null,
    val temperature: Double? = null,
    val tone: String? = null,
    val formality: String? = null,
    /** Domain and glossary guidance, usually the calling project's context. */
    val projectContext: String? = null,
    /** Skip the cache and force a fresh translation. */
    val noCache: Boolean = false,
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
    val provider: String?,
    val model: String?,
    val temperature: Double?,
    val formality: String?,
    val tone: String?,
    val autoFlagFuzzy: Boolean?,
    val cacheTtlHours: Int?,
)
