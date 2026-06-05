package io.translad.common

import org.flywaydb.core.Flyway
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * Dev/test-only helpers. Resetting the database is gated behind `translad.dev-reset`
 * (off by default) so it can never be triggered in a real deployment.
 */
@RestController
@RequestMapping("/api/dev")
class DevController(
    private val flyway: Flyway,
    @Value("\${translad.dev-reset:false}") private val resetEnabled: Boolean,
) {
    @PostMapping("/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun reset() {
        require(resetEnabled) { "Dev reset is disabled." }
        flyway.clean()
        flyway.migrate()
    }
}
