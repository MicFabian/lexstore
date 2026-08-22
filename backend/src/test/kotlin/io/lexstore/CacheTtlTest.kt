package io.lexstore

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.core.ParameterizedTypeReference

class CacheTtlTest : IntegrationTestBase() {

    private val mapType = object : ParameterizedTypeReference<Map<String, Any?>>() {}

    private fun translate(text: String): Map<String, Any?> =
        client.post().uri("/api/ai/translate")
            .body(mapOf("sourceText" to text, "sourceLang" to "en", "targetLang" to "de"))
            .retrieve().body(mapType)!!

    private fun setTtl(hours: Int) {
        client.put().uri("/api/ai/settings")
            .body(mapOf("cacheTtlHours" to hours))
            .retrieve().toBodilessEntity()
    }

    @Test
    fun `a repeat translation is served from the cache`() {
        translate("Cache me")
        assertThat(translate("Cache me")["cacheHit"]).isEqualTo(true)
    }

    @Test
    fun `a ttl of zero stops the cache from being reused`() {
        translate("Never reuse me")
        setTtl(0)
        assertThat(translate("Never reuse me")["cacheHit"]).isEqualTo(false)
    }
}
