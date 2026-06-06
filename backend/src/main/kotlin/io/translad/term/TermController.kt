package io.translad.term

import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/projects/{projectId}/terms")
class TermController(private val service: TermService) {

    @GetMapping
    fun list(
        @PathVariable projectId: UUID,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int,
    ): Page<TermView> = service.listPaged(projectId, page, size.coerceIn(1, 200))

    @GetMapping("/{termId}")
    fun get(@PathVariable projectId: UUID, @PathVariable termId: UUID): TermView =
        service.get(projectId, termId)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','TRANSLATOR')")
    fun create(@PathVariable projectId: UUID, @Valid @RequestBody req: CreateTermRequest): TermView =
        service.create(projectId, req)

    @PatchMapping("/{termId}")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','TRANSLATOR')")
    fun update(
        @PathVariable projectId: UUID,
        @PathVariable termId: UUID,
        @RequestBody req: UpdateTermRequest,
    ): TermView = service.update(projectId, termId, req)

    @DeleteMapping("/{termId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    fun delete(@PathVariable projectId: UUID, @PathVariable termId: UUID) =
        service.delete(projectId, termId)

    @GetMapping("/{termId}/comments")
    fun listComments(
        @PathVariable projectId: UUID,
        @PathVariable termId: UUID,
    ): List<CommentView> = service.listComments(projectId, termId)

    @PostMapping("/{termId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    fun addComment(
        @PathVariable projectId: UUID,
        @PathVariable termId: UUID,
        @Valid @RequestBody req: AddCommentRequest,
    ): CommentView = service.addComment(projectId, termId, req)

    @DeleteMapping("/{termId}/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','TRANSLATOR','PROOFREADER')")
    fun deleteComment(
        @PathVariable projectId: UUID,
        @PathVariable termId: UUID,
        @PathVariable commentId: UUID,
    ) = service.deleteComment(projectId, termId, commentId)
}
