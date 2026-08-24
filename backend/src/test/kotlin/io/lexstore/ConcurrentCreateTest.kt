package io.lexstore

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.core.ParameterizedTypeReference
import org.springframework.web.client.HttpClientErrorException
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

private const val MOSAIC_WEB = "35f54c71-131a-cc6e-aad2-f22b0eca789f"

/**
 * A uniqueness clash must read the same whether the caller arrived second or
 * raced: a client decides what to do from the status code.
 */
class ConcurrentCreateTest : IntegrationTestBase() {

    private val mapType = object : ParameterizedTypeReference<Map<String, Any?>>() {}

    private fun create(key: String): Int =
        try {
            client.post().uri("/api/projects/$MOSAIC_WEB/terms")
                .body(mapOf("key" to key, "source" to "Race probe"))
                .retrieve().body(mapType)
            201
        } catch (ex: HttpClientErrorException) {
            ex.statusCode.value()
        }

    @Test
    fun `racing callers creating the same key get one success and conflicts`() {
        val key = "race.${System.nanoTime()}"
        val pool = Executors.newFixedThreadPool(3)
        val codes = (1..3).map { pool.submit<Int> { create(key) } }.map { it.get(20, TimeUnit.SECONDS) }
        pool.shutdown()

        assertThat(codes.count { it == 201 }).isEqualTo(1)
        assertThat(codes.filter { it != 201 }).allMatch { it == 409 }
    }

    @Test
    fun `arriving second is the same conflict`() {
        val key = "sequential.${System.nanoTime()}"
        assertThat(create(key)).isEqualTo(201)
        assertThat(create(key)).isEqualTo(409)
    }
}
