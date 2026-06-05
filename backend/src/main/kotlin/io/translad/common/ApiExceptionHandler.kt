package io.translad.common

import io.translad.ai.AiTranslationException
import io.translad.apikey.*
import io.translad.language.DuplicateLanguageException
import io.translad.project.DuplicateProjectCodeException
import io.translad.project.ProjectNotFoundException
import io.translad.term.DuplicateTermKeyException
import io.translad.term.TermNotFoundException
import io.translad.translation.LanguageNotInProjectException
import org.springframework.http.HttpStatus
import org.springframework.http.ProblemDetail
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class ApiExceptionHandler {

    @ExceptionHandler(ProjectNotFoundException::class, TermNotFoundException::class)
    fun notFound(ex: RuntimeException): ProblemDetail =
        problem(HttpStatus.NOT_FOUND, "Not found", ex.message)

    @ExceptionHandler(
        DuplicateProjectCodeException::class,
        DuplicateTermKeyException::class,
        DuplicateLanguageException::class,
    )
    fun conflict(ex: RuntimeException): ProblemDetail =
        problem(HttpStatus.CONFLICT, "Conflict", ex.message)

    @ExceptionHandler(LanguageNotInProjectException::class, IllegalArgumentException::class)
    fun badRequest(ex: RuntimeException): ProblemDetail =
        problem(HttpStatus.BAD_REQUEST, "Invalid request", ex.message)

    @ExceptionHandler(AiTranslationException::class)
    fun aiFailure(ex: AiTranslationException): ProblemDetail =
        problem(HttpStatus.BAD_GATEWAY, "Translation provider error", ex.message)

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun validation(ex: MethodArgumentNotValidException): ProblemDetail {
        val detail = ex.bindingResult.fieldErrors.joinToString("; ") { "${it.field}: ${it.defaultMessage}" }
        return problem(HttpStatus.BAD_REQUEST, "Validation failed", detail)
    }

    private fun problem(status: HttpStatus, title: String, detail: String?): ProblemDetail =
        ProblemDetail.forStatus(status).apply {
            this.title = title
            this.detail = detail ?: title
        }
}
