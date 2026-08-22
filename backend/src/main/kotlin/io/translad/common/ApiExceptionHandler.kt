package io.translad.common

import io.translad.ai.AiTranslationException
import io.translad.contributor.ContributorNotFoundException
import io.translad.feature.DuplicateFeatureKeyException
import io.translad.feature.FeatureNotFoundException
import io.translad.io.PoeditorException
import io.translad.io.PoeditorRateLimitException
import io.translad.apikey.*
import io.translad.language.DuplicateLanguageException
import io.translad.project.DuplicateProjectCodeException
import io.translad.project.ProjectNotFoundException
import io.translad.term.DuplicateTermKeyException
import io.translad.term.TermNotFoundException
import io.translad.translation.LanguageNotInProjectException
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
        DuplicateProjectCodeException::class,
        DuplicateTermKeyException::class,
        DuplicateLanguageException::class,
        DuplicateFeatureKeyException::class,
    )
    fun conflict(ex: RuntimeException): ProblemDetail =
        problem(HttpStatus.CONFLICT, "Conflict", ex.message)

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
