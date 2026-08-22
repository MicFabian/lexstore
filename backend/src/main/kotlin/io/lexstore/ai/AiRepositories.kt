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

interface TranslationRequestRepository : JpaRepository<TranslationRequestLog, UUID> {
    fun findAllByOrderByCreatedAtDesc(pageable: Pageable): List<TranslationRequestLog>
    fun countByCacheHit(cacheHit: Boolean): Long
}
