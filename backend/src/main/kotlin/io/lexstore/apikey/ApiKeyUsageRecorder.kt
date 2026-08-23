package io.lexstore.apikey

import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.util.UUID

private val WRITE_AT_MOST_EVERY = Duration.ofMinutes(5)

/**
 * Records that a key was used, at most once every few minutes.
 *
 * A build pipeline can make thousands of calls in a run; stamping every one
 * would turn a read into a write without telling anyone anything the coarser
 * timestamp does not already say.
 */
@Component
class ApiKeyUsageRecorder(private val keys: ApiKeyRepository) {

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun record(keyId: UUID, lastUsedAt: Instant?) {
        val now = Instant.now()
        if (lastUsedAt != null && Duration.between(lastUsedAt, now) < WRITE_AT_MOST_EVERY) return
        runCatching { keys.markUsed(keyId, now) }
    }
}
