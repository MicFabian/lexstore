package io.lexstore.ai

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant

/**
 * Trims the AI request log.
 *
 * Every translation writes a row carrying its source and result text, and
 * nothing removed them: a busy instance grows the table without bound until
 * the disk decides the matter. The window is long enough for the usage views
 * that read it, and configurable for anyone who needs longer.
 */
@Component
class RequestLogRetention(
    private val requests: TranslationRequestRepository,
    @Value("\${lexstore.retention.request-log-days:90}") private val days: Long,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(cron = "\${lexstore.retention.cron:0 30 3 * * *}")
    @Transactional
    fun prune() {
        if (days <= 0) return
        val cutoff = Instant.now().minus(Duration.ofDays(days))
        val removed = requests.deleteByCreatedAtBefore(cutoff)
        if (removed > 0) log.info("Pruned {} AI request log rows older than {} days", removed, days)
    }
}
