package io.lexstore.ai

import io.lexstore.common.RelativeTime
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

@Service
class AiTranslationService(
    private val cache: TranslationCacheRepository,
    private val requests: TranslationRequestRepository,
    private val settingsRepo: AiSettingsRepository,
    private val mock: MockTranslator,
    private val claude: ClaudeTranslator,
    private val gemini: GeminiTranslator,
) {
    // ---------------- Translate (cache-first) ----------------

    /**
     * Runs in its own transaction: a provider failure must not mark a caller's
     * transaction rollback-only, or a batch translating term by term would
     * lose every translation it had already paid for.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    fun translate(req: TranslateRequest): TranslateResponse {
        val settings = settings()
        val model = req.model ?: settings.model
        val temperature = req.temperature ?: settings.temperature
        val tone = req.tone ?: settings.tone
        val formality = req.formality ?: settings.formality
        val translator = translatorFor(settings.provider)
        val key = cacheKey(
            req.sourceText, req.sourceLang, req.targetLang,
            translator.provider, model, tone, formality, req.projectContext, temperature,
        )

        val start = System.nanoTime()

        // Cache hit (unless explicitly bypassed).
        if (!req.noCache) {
            val hit = cache.findByCacheKey(key)?.takeUnless { expired(it, settings.cacheTtlHours) }
            if (hit != null) {
                hit.hits += 1
                hit.lastUsedAt = Instant.now()
                val latency = elapsedMs(start)
                logRequest(req, translator.provider, model, hit.targetText, true, latency, 0, 0, "ok", null)
                return TranslateResponse(hit.targetText, translator.provider, model, true, latency, 0, 0)
            }
        }

        // Miss → translate, store, log.
        return try {
            val out = translator.translate(
                TranslateInput(
                    req.sourceText, req.sourceLang, req.targetLang, model, temperature,
                    tone, formality, req.projectContext,
                ),
            )
            // Upsert: a forced (noCache) refresh of an existing key updates it in place.
            val entry = cache.findByCacheKey(key)
            if (entry != null) {
                entry.targetText = out.text
                entry.lastUsedAt = Instant.now()
            } else {
                cache.save(
                    TranslationCacheEntry(
                        cacheKey = key,
                        sourceText = req.sourceText,
                        sourceLang = req.sourceLang,
                        targetLang = req.targetLang,
                        provider = translator.provider,
                        model = out.model,
                        targetText = out.text,
                    ),
                )
            }
            val latency = elapsedMs(start)
            logRequest(req, translator.provider, out.model, out.text, false, latency, out.inputTokens, out.outputTokens, "ok", null)
            TranslateResponse(out.text, translator.provider, out.model, false, latency, out.inputTokens, out.outputTokens)
        } catch (e: Exception) {
            val latency = elapsedMs(start)
            logRequest(req, translator.provider, model, null, false, latency, 0, 0, "error", e.message)
            throw AiTranslationException(e.message ?: "Translation failed")
        }
    }

    private fun translatorFor(provider: String): Translator = when (provider) {
        "claude" -> if (claude.available) claude else mock
        "gemini" -> if (gemini.available) gemini else mock
        else -> mock
    }

    // ---------------- Request log ----------------

    @Transactional(readOnly = true)
    fun requests(page: Int, size: Int): List<RequestLogView> =
        requests.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size)).map {
            RequestLogView(
                id = it.id,
                sourceText = it.sourceText,
                sourceLang = it.sourceLang,
                targetLang = it.targetLang,
                provider = it.provider,
                model = it.model,
                resultText = it.resultText,
                cacheHit = it.cacheHit,
                latencyMs = it.latencyMs,
                inputTokens = it.inputTokens,
                outputTokens = it.outputTokens,
                status = it.status,
                errorMessage = it.errorMessage,
                at = relativeTime(it.createdAt),
            )
        }

    // ---------------- Cache browser ----------------

    @Transactional(readOnly = true)
    fun cacheEntries(query: String?, page: Int, size: Int): List<CacheEntryView> {
        val pageable = PageRequest.of(page, size)
        val entries = if (query.isNullOrBlank()) cache.findAllByOrderByLastUsedAtDesc(pageable)
        else cache.search(query, pageable)
        return entries.map {
            CacheEntryView(
                id = it.id,
                sourceText = it.sourceText,
                sourceLang = it.sourceLang,
                targetLang = it.targetLang,
                provider = it.provider,
                model = it.model,
                targetText = it.targetText,
                hits = it.hits,
                createdAt = relativeTime(it.createdAt),
                lastUsedAt = relativeTime(it.lastUsedAt),
            )
        }
    }

    @Transactional(readOnly = true)
    /**
     * Counted in the database: the entries carry the full source and target
     * text, so loading them all to sum one column reads megabytes to produce
     * two numbers.
     */
    fun stats(): CacheStats {
        val entryCount = cache.count()
        val totalHits = cache.totalHits()
        val total = requests.count()
        val hits = requests.countByCacheHit(true)
        val rate = if (total == 0L) 0 else ((hits * 100.0) / total).toInt()
        return CacheStats(entryCount, totalHits, total, hits, rate)
    }

    @Transactional
    fun deleteCacheEntry(id: UUID) = cache.deleteById(id)

    /** Invalidate every cached translation for a given source content. */
    @Transactional
    fun invalidateContent(sourceText: String): Int = cache.deleteBySourceText(sourceText)

    @Transactional
    fun clearCache() = cache.deleteAllInBatch()

    // ---------------- Settings ----------------

    @Transactional
    fun settings(): AiSettings =
        settingsRepo.findById(1).orElseGet { settingsRepo.save(AiSettings()) }

    fun settingsView(): AiSettingsView {
        val s = settings()
        return AiSettingsView(
            s.provider, s.model, s.temperature, s.formality, s.tone,
            s.autoFlagFuzzy, s.cacheTtlHours, claude.available, gemini.available,
        )
    }

    @Transactional
    fun updateSettings(req: UpdateAiSettings): AiSettingsView {
        val s = settings()
        req.provider?.let { s.provider = it }
        req.model?.let { s.model = it }
        req.temperature?.let { s.temperature = it.coerceIn(0.0, 1.0) }
        req.formality?.let { s.formality = it }
        req.tone?.let { s.tone = it.ifBlank { null } }
        req.autoFlagFuzzy?.let { s.autoFlagFuzzy = it }
        req.cacheTtlHours?.let { s.cacheTtlHours = it.coerceAtLeast(0) }
        settingsRepo.save(s)
        return settingsView()
    }

    // ---------------- helpers ----------------

    private fun logRequest(
        req: TranslateRequest, provider: String, model: String, result: String?,
        hit: Boolean, latency: Long, inTok: Int, outTok: Int, status: String, error: String?,
    ) {
        requests.save(
            TranslationRequestLog(
                sourceText = req.sourceText, sourceLang = req.sourceLang, targetLang = req.targetLang,
                provider = provider, model = model, resultText = result, cacheHit = hit,
                latencyMs = latency, inputTokens = inTok, outputTokens = outTok, status = status, errorMessage = error,
            ),
        )
    }

    private fun cacheKey(
        src: String, srcLang: String, tgtLang: String, provider: String, model: String,
        tone: String?, formality: String?, projectContext: String?, temperature: Double,
    ): String {
        // v2 includes temperature, which changes the output: without it a
        // creative request could be answered from a deterministic one's entry.
        val raw = listOf(
            "v2", src, srcLang, tgtLang, provider, model,
            tone ?: "", formality ?: "", projectContext ?: "", temperature.toString(),
        ).joinToString("\u0000")
        val digest = MessageDigest.getInstance("SHA-256").digest(raw.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }

    /**
     * A TTL of zero disables reuse entirely; anything else measures from when
     * the entry was created, not when it was last read, so a busy entry still
     * ages out instead of living for ever.
     */
    private fun expired(entry: TranslationCacheEntry, ttlHours: Int): Boolean {
        if (ttlHours <= 0) return true
        return entry.createdAt.isBefore(Instant.now().minus(java.time.Duration.ofHours(ttlHours.toLong())))
    }

    private fun elapsedMs(startNanos: Long): Long = (System.nanoTime() - startNanos) / 1_000_000

    private fun relativeTime(at: Instant): String = RelativeTime.format(at, withTime = true)
}

class AiTranslationException(msg: String) : RuntimeException(msg)
