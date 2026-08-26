package io.lexstore.common

import com.zaxxer.hikari.HikariDataSource
import org.flywaydb.core.Flyway
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import javax.sql.DataSource

/**
 * Dev/test-only helpers. Resetting the database is gated behind `lexstore.dev-reset`
 * (off by default) so it can never be triggered in a real deployment.
 *
 * The reset is serialised and starts by terminating every other database
 * session: `flyway.clean()` needs exclusive locks, and a request still in
 * flight from before the reset — or a pooled connection left idle in a
 * transaction — otherwise blocks it indefinitely. Terminating sessions leaves
 * corpses in the connection pool, so those are evicted before Flyway borrows.
 */
@RestController
@RequestMapping("/api/dev")
class DevController(
    private val flyway: Flyway,
    private val jdbc: JdbcTemplate,
    private val dataSource: DataSource,
    @Value("\${lexstore.dev-reset:false}") private val resetEnabled: Boolean,
) {
    private val resetLock = Any()

    @PostMapping("/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun reset() {
        require(resetEnabled) { "Dev reset is disabled." }
        synchronized(resetLock) {
            jdbc.execute(
                "select pg_terminate_backend(pid) from pg_stat_activity " +
                    "where datname = current_database() and pid <> pg_backend_pid()",
            )
            (dataSource as? HikariDataSource)?.hikariPoolMXBean?.softEvictConnections()
            flyway.clean()
            flyway.migrate()
        }
    }
}
