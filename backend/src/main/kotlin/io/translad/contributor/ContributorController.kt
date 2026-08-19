package io.translad.contributor

import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/projects/{projectId}/contributors")
class ContributorController(private val service: ContributorService) {

    @GetMapping
    fun list(@PathVariable projectId: UUID): List<ContributorView> = service.list(projectId)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    fun invite(
        @PathVariable projectId: UUID,
        @Valid @RequestBody req: InviteContributorRequest,
    ): ContributorView = service.invite(projectId, req)

    /** Change a contributor's role or the languages they may work on. */
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    fun update(
        @PathVariable projectId: UUID,
        @PathVariable id: UUID,
        @RequestBody req: UpdateContributorRequest,
    ): ContributorView = service.update(projectId, id, req)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    fun remove(@PathVariable projectId: UUID, @PathVariable id: UUID) = service.remove(projectId, id)
}
