package io.lexstore.glossary

import io.lexstore.common.ContributorRole
import io.lexstore.common.RequiresProjectRole
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

/** Terms a project insists on, and terms it insists on leaving alone. */
@RestController
@RequestMapping("/api/projects/{projectId}/glossary")
class GlossaryController(private val service: GlossaryService) {

    @GetMapping
    fun list(@PathVariable projectId: UUID): List<GlossaryEntryView> = service.list(projectId)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','TRANSLATOR','PROOFREADER')")
    @RequiresProjectRole(
        ContributorRole.OWNER,
        ContributorRole.ADMIN,
        ContributorRole.PROOFREADER,
    )
    fun add(
        @PathVariable projectId: UUID,
        @Valid @RequestBody req: SaveGlossaryEntryRequest,
    ): GlossaryEntryView = service.add(projectId, req)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','TRANSLATOR','PROOFREADER')")
    @RequiresProjectRole(
        ContributorRole.OWNER,
        ContributorRole.ADMIN,
        ContributorRole.PROOFREADER,
    )
    fun delete(@PathVariable projectId: UUID, @PathVariable id: UUID) = service.delete(projectId, id)
}
