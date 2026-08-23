package io.lexstore

import io.lexstore.ai.TranslationCacheRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class AiRobustnessTest : IntegrationTestBase() {

    @Autowired private lateinit var cache: TranslationCacheRepository

    private val mapType =
        object : org.springframework.core.ParameterizedTypeReference<Map<String, Any?>>() {}

    @Test
    fun `two requests missing the same key both get an answer`() {
        val text = "Race probe ${System.nanoTime()}"
        val pool = Executors.newFixedThreadPool(2)

        val results = (1..2).map {
            pool.submit<String> {
                client.post().uri("/api/ai/translate")
                    .body(mapOf("sourceText" to text, "sourceLang" to "en", "targetLang" to "de"))
                    .retrieve().body(mapType)!!["text"] as String
            }
        }.map { it.get(20, TimeUnit.SECONDS) }
        pool.shutdown()

        // Neither caller is failed by the other winning the write.
        assertThat(results).allMatch { it.isNotBlank() }
        assertThat(results[0]).isEqualTo(results[1])

        // And exactly one entry exists for that content.
        assertThat(cache.findAll().count { it.sourceText == text }).isEqualTo(1)
    }
}
