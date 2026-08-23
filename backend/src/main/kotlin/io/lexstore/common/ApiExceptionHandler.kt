package io.lexstore.common

import io.lexstore.ai.AiTranslationException
import io.lexstore.contributor.ContributorNotFoundException
import io.lexstore.feature.DuplicateFeatureKeyException
import io.lexstore.feature.FeatureNotFoundException
import io.lexstore.io.PoeditorException
import io.lexstore.io.PoeditorRateLimitException
import io.lexstore.apikey.*
import io.lexstore.language.DuplicateLanguageException
import io.lexstore.project.DuplicateProjectCodeException
import io.lexstore.project.ProjectNotFoundException
import io.lexstore.term.DuplicateTermKeyException
import io.lexstore.term.TermNotFoundException
import io.lexstore.translation.LanguageNotInProjectException
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ProblemDetail
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class ApiExceptionHandler {

    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler(
        ProjectNotFoundException::class,
        TermNotFoundException::class,
        ContributorNotFoundException::class,
        FeatureNotFoundException::class,
    )
    fun notFound(ex: RuntimeException): ProblemDetail =
        problem(HttpStatus.NOT_FOUND, "Not found", ex.message)

    @ExceptionHandler(
        io.lexstore.translation.TranslationConflictException::class,
        org.springframework.orm.ObjectOptimisticLockingFailureException::class,
    )
    fun staleWrite(ex: Exception): ProblemDetail =
        problem(
            HttpStatus.CONFLICT,
            "Conflict",
            "Someone else saved this translation while you were editing it. Reload to see their version.",
        )

    @ExceptionHandler(
        DuplicateProjectCodeException::class,
        DuplicateTermKeyException::class,
        DuplicateLanguageException::class,
        DuplicateFeatureKeyException::class,
        io.lexstore.glossary.DuplicateGlossaryTermException::class,
    )
    fun conflict(ex: RuntimeException): ProblemDetail =
        problem(HttpStatus.CONFLICT, "Conflict", ex.message)

    @ExceptionHandler(ApiKeyNotAllowedException::class)
    fun apiKeyNotAllowed(ex: RuntimeException): ProblemDetail =
        problem(HttpStatus.FORBIDDEN, "Not allowed for an API key", ex.message)

    @ExceptionHandler(ReadOnlyKeyException::class)
    fun readOnlyKey(ex: RuntimeException): ProblemDetail =
        problem(HttpStatus.FORBIDDEN, "Read-only key", ex.message)

    @ExceptionHandler(io.lexstore.org.OrgAccessDeniedException::class)
    fun orgDenied(ex: RuntimeException): ProblemDetail =
        problem(HttpStatus.FORBIDDEN, "Forbidden", ex.message)

    @ExceptionHandler(io.lexstore.org.AgentQuotaExceededException::class)
    fun quotaExceeded(ex: RuntimeException): ProblemDetail =
        problem(HttpStatus.PAYMENT_REQUIRED, "Agent quota reached", ex.message)

    @ExceptionHandler(io.lexstore.org.SecretUnavailableException::class)
    fun secretMissing(ex: RuntimeException): ProblemDetail =
        problem(HttpStatus.SERVICE_UNAVAILABLE, "Encryption unavailable", ex.message)

    @ExceptionHandler(LanguageNotInProjectException::class, IllegalArgumentException::class)
    fun badRequest(ex: RuntimeException): ProblemDetail =
        problem(HttpStatus.BAD_REQUEST, "Invalid request", ex.message)

    /**
     * A body that cannot become the expected type — malformed JSON, or a
     * required field left out of a Kotlin non-null parameter — is the caller's
     * mistake, so it must not surface as a server error.
     */
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun unreadableBody(ex: HttpMessageNotReadableException): ProblemDetail =
        problem(HttpStatus.BAD_REQUEST, "Invalid request", "The request body is missing a required field or is not valid JSON.")

    @ExceptionHandler(ProjectAccessDeniedException::class)
    fun forbidden(ex: ProjectAccessDeniedException): ProblemDetail =
        problem(HttpStatus.FORBIDDEN, "Forbidden", "You do not have access to this project.")

    @ExceptionHandler(AiTranslationException::class)
    fun aiFailure(ex: AiTranslationException): ProblemDetail =
        problem(HttpStatus.BAD_GATEWAY, "Translation provider error", ex.message)

    @ExceptionHandler(PoeditorException::class)
    fun poeditorFailure(ex: PoeditorException): ProblemDetail =
        problem(HttpStatus.BAD_GATEWAY, "POEditor error", ex.message)

    @ExceptionHandler(PoeditorRateLimitException::class)
    fun poeditorRateLimited(ex: PoeditorRateLimitException): ProblemDetail =
        problem(HttpStatus.TOO_MANY_REQUESTS, "POEditor rate limit", ex.message)

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun validation(ex: MethodArgumentNotValidException): ProblemDetail {
        val detail = ex.bindingResult.fieldErrors.joinToString("; ") { "${it.field}: ${it.defaultMessage}" }
        return problem(HttpStatus.BAD_REQUEST, "Validation failed", detail)
    }

    /**
     * A value too long for its column, or a duplicate where the schema demands
     * uniqueness, is the caller's mistake. Reported as such rather than as a
     * server error, without echoing the SQL that says so.
     */
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException::class)
    fun dataIntegrity(ex: org.springframework.dao.DataIntegrityViolationException): ProblemDetail {
        log.warn("Rejected a request that violates a database constraint", ex)
        val message = ex.mostSpecificCause.message.orEmpty()
        val detail = when {
            message.contains("too long", ignoreCase = true) ||
                message.contains("value too long", ignoreCase = true) ->
                "One of the values is longer than this field allows."
            message.contains("duplicate key", ignoreCase = true) ->
                "That value is already taken."
            message.contains("not-null", ignoreCase = true) ->
                "A required value is missing."
            else -> "The request does not fit what this field accepts."
        }
        return problem(HttpStatus.BAD_REQUEST, "Invalid request", detail)
    }

    /**
     * Programming errors that would otherwise surface their message to the
     * client. Spring's own request exceptions keep their proper 4xx handling.
     * The client gets a generic message; the cause goes to the log, since an
     * exception message can carry SQL, hostnames, or user data.
     */
    @ExceptionHandler(IllegalStateException::class, NullPointerException::class)
    fun unexpected(ex: RuntimeException): ProblemDetail {
        log.error("Unhandled exception", ex)
        return problem(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "Something went wrong",
            "The request could not be completed. If it keeps happening, contact an administrator.",
        )
    }

    private fun problem(status: HttpStatus, title: String, detail: String?): ProblemDetail =
        ProblemDetail.forStatus(status).apply {
            this.title = title
            this.detail = detail ?: title
        }
}
