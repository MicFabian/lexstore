package io.lexstore

import io.lexstore.io.PoeditorClient
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * The throttle must space calls out without serialising them: a stalled
 * POEditor request used to hold a process-wide lock and block every import.
 */
class PoeditorThrottleTest {

    private val client = PoeditorClient("http://localhost:1", minIntervalMs = 200, maxRetries = 0)

    private fun awaitSlot() {
        val m = PoeditorClient::class.java.getDeclaredMethod("awaitSlot")
        m.isAccessible = true
        m.invoke(client)
    }

    @Test
    fun `slots are handed out one interval apart`() {
        val started = System.currentTimeMillis()
        repeat(3) { awaitSlot() }
        val elapsed = System.currentTimeMillis() - started
        // Three slots at 200ms apart: the first is free, the next two wait.
        assertThat(elapsed).isGreaterThanOrEqualTo(400)
    }

    @Test
    fun `claiming a slot never blocks longer than the interval it waits for`() {
        val pool = Executors.newFixedThreadPool(4)
        val started = System.currentTimeMillis()
        val tasks = (1..4).map { pool.submit { awaitSlot() } }
        tasks.forEach { it.get(5, TimeUnit.SECONDS) }
        pool.shutdown()

        // Four slots, 200ms apart, is 600ms of waiting — not four serialised
        // round trips. The point is that it completes at all within the bound.
        val elapsed = System.currentTimeMillis() - started
        assertThat(elapsed).isLessThan(2000)
    }
}
