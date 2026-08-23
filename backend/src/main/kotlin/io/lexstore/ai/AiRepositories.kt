package io.lexstore.ai

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface TranslationCacheRepository : JpaRepository<TranslationCacheEntry, UUID> {
    fun findByCacheKey(cacheKey: String): TranslationCacheEntry?

    fun findAllByOrderByLastUsedAtDesc(pageable: Pageable): List<TranslationCacheEntry>

    @Query("select coalesce(sum(c.hits), 0) from TranslationCacheEntry c")
    fun totalHits(): Long

    /**
     * Inserts only when the key is still free. Two callers can miss the same
     * key at once; letting the second one collide would abort its transaction
     * over a translation that is already bought and already stored.
     */
    @Modifying
    @Query(
        nativeQuery = true,
        value = """
        insert into translation_cache
            (id, cache_key, source_text, source_lang, target_lang, provider, model, target_text,
             hits, created_at, last_used_at)
        values (gen_random_uuid(), :cacheKey, :sourceText, :sourceLang, :targetLang, :provider,
                :model, :targetText, 0, now(), now())
        on conflict (cache_key) do nothing
        """,
    )
    fun insertIfAbsent(
        cacheKey: String,
        sourceText: String,
        sourceLang: String,
        targetLang: String,
        provider: String,
        model: String,
        targetText: String,
    ): Int

    @Query(
        """
        select c from TranslationCacheEntry c
        where lower(c.sourceText) like lower(concat('%', :q, '%'))
           or lower(c.targetText) like lower(concat('%', :q, '%'))
        order by c.lastUsedAt desc
        """,
    )
    fun search(@Param("q") q: String, pageable: Pageable): List<TranslationCacheEntry>

    /** Invalidate every cached translation whose source matches this content exactly. */
    @Modifying
    @Query("delete from TranslationCacheEntry c where c.sourceText = :text")
    fun deleteBySourceText(@Param("text") text: String): Int
}

interface ProviderUsageRow {
    val provider: String
    val requests: Long
    val inputTokens: Long
    val outputTokens: Long
}

interface DailyUsageRow {
    val day: java.time.LocalDate
    val requests: Long
    val tokens: Long
}

interface UsageTotals {
    val requests: Long
    val hits: Long
    val failures: Long
    val inputTokens: Long
    val outputTokens: Long
}

interface TranslationRequestRepository : JpaRepository<TranslationRequestLog, UUID> {
    fun findAllByOrderByCreatedAtDesc(pageable: Pageable): List<TranslationRequestLog>
    fun countByCacheHit(cacheHit: Boolean): Long

    fun findByOrgIdOrderByCreatedAtDesc(orgId: UUID, pageable: Pageable): List<TranslationRequestLog>

    @org.springframework.data.jpa.repository.Modifying
    @Query("delete from TranslationRequestLog r where r.createdAt < :cutoff")
    fun deleteByCreatedAtBefore(cutoff: java.time.Instant): Int

    @Query(
        """
        select coalesce(count(r), 0) as requests,
               coalesce(sum(case when r.cacheHit = true then 1 else 0 end), 0) as hits,
               coalesce(sum(case when r.status <> 'ok' then 1 else 0 end), 0) as failures,
               coalesce(sum(r.inputTokens), 0) as inputTokens,
               coalesce(sum(r.outputTokens), 0) as outputTokens
        from TranslationRequestLog r
        where (:orgId is null or r.orgId = :orgId) and r.createdAt >= :since
        """,
    )
    fun totalsSince(orgId: UUID?, since: java.time.Instant): UsageTotals

    @Query(
        """
        select r.provider as provider,
               count(r) as requests,
               coalesce(sum(r.inputTokens), 0) as inputTokens,
               coalesce(sum(r.outputTokens), 0) as outputTokens
        from TranslationRequestLog r
        where (:orgId is null or r.orgId = :orgId) and r.createdAt >= :since
        group by r.provider
        """,
    )
    fun usageByProvider(orgId: UUID?, since: java.time.Instant): List<ProviderUsageRow>

    @Query(
        nativeQuery = true,
        value = """
        select date(created_at) as day,
               count(*) as requests,
               coalesce(sum(input_tokens + output_tokens), 0) as tokens
        from translation_request
        where (cast(:orgId as uuid) is null or org_id = cast(:orgId as uuid))
          and created_at >= :since
        group by date(created_at)
        order by day
        """,
    )
    fun usageByDay(orgId: UUID?, since: java.time.Instant): List<DailyUsageRow>
}
