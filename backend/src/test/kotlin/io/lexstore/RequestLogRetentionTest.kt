package io.lexstore

import io.lexstore.ai.RequestLogRetention
import io.lexstore.ai.TranslationRequestLog
import io.lexstore.ai.TranslationRequestRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.TestPropertySource
import java.time.Duration
import java.time.Instant

@TestPropertySource(properties = ["lexstore.retention.request-log-days=30"])
class RequestLogRetentionTest : IntegrationTestBase() {

    @Autowired private lateinit var requests: TranslationRequestRepository
    @Autowired private lateinit var retention: RequestLogRetention

    private fun log(ageDays: Long) = requests.save(
        TranslationRequestLog(
            sourceText = "probe $ageDays",
            sourceLang = "en",
            targetLang = "de",
            provider = "mock",
            model = "m",
            resultText = "Ergebnis",
            cacheHit = false,
            latencyMs = 5,
            inputTokens = 1,
            outputTokens = 1,
            status = "ok",
            createdAt = Instant.now().minus(Duration.ofDays(ageDays)),
        ),
    )

    @Test
    fun `pruning removes rows past the window and keeps the rest`() {
        val old = log(100)
        val edge = log(31)
        val recent = log(2)

        retention.prune()

        val ids = requests.findAll().map { it.id }
        assertThat(ids).doesNotContain(old.id, edge.id)
        assertThat(ids).contains(recent.id)
    }
}
