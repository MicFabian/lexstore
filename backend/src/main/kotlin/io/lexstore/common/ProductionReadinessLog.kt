package io.lexstore.common

import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.annotation.Profile
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

/**
 * One honest line per missing production setting, at startup, where an operator
 * reads it — instead of a puzzling failure the first time a user needs it.
 * The application still starts: every one of these has a working fallback.
 */
@Component
@Profile("prod")
class ProductionReadinessLog(
    @Value("\${lexstore.secret-key:}") private val secretKey: String,
    @Value("\${lexstore.agent.anthropic-key:}") private val agentKey: String,
) {
    private val log = org.slf4j.LoggerFactory.getLogger(javaClass)

    @EventListener(ApplicationReadyEvent::class)
    fun report() {
        if (secretKey.isBlank()) {
            log.warn(
                "LEXSTORE_SECRET_KEY is not set: provider keys cannot be stored through the UI, " +
                    "and translation falls back to the environment-supplied keys.",
            )
        }
        if (agentKey.isBlank()) {
            log.warn(
                "LEXSTORE_AGENT_KEY is not set: organisations on an agent plan cannot translate " +
                    "until it is provided.",
            )
        }
    }
}
