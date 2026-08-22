package io.lexstore.common

import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/** Human-friendly relative timestamps ("just now", "3h ago", "May 2, 2026"). */
object RelativeTime {

    private val DATE: DateTimeFormatter =
        DateTimeFormatter.ofPattern("MMM d, yyyy").withZone(ZoneOffset.UTC)

    private val DATE_TIME: DateTimeFormatter =
        DateTimeFormatter.ofPattern("MMM d, HH:mm").withZone(ZoneOffset.UTC)

    fun format(at: Instant, withTime: Boolean = false): String {
        val d = Duration.between(at, Instant.now())
        return when {
            d.toMinutes() < 1 -> "just now"
            d.toMinutes() < 60 -> "${d.toMinutes()}m ago"
            d.toHours() < 24 -> "${d.toHours()}h ago"
            d.toDays() < 7 -> "${d.toDays()}d ago"
            else -> (if (withTime) DATE_TIME else DATE).format(at)
        }
    }
}
