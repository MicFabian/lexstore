package io.translad.ai

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/**
 * One cached translation. The natural key is a hash over everything that affects
 * the output (source text + languages + provider/model + tone + formality), so an
 * identical request is a guaranteed hit. Source/target text are stored plainly so
 * the cache is browsable and individually invalidatable.
 */
@Entity
@Table(name = "translation_cache")
class TranslationCacheEntry(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "cache_key", nullable = false, unique = true)
    val cacheKey: String,

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

    @Column(name = "target_text", nullable = false, length = 4000)
    var targetText: String,

    @Column(nullable = false)
    var hits: Long = 0,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "last_used_at", nullable = false)
    var lastUsedAt: Instant = Instant.now(),
)
