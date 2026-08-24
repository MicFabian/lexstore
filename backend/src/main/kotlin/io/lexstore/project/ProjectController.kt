package io.lexstore.project

import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/projects")
class ProjectController(private val service: ProjectService) {

    @GetMapping
    fun list(): List<ProjectSummary> = service.list()

    @GetMapping("/{projectId}")
    fun get(@PathVariable projectId: UUID): ProjectDetail = service.detail(projectId)

    /**
     * The project's image, served from its own URL so a listing does not carry
     * up to 512 KB of data URI per project for something drawn at 28 pixels.
     */
    @GetMapping("/{projectId}/image")
    fun image(@PathVariable projectId: UUID): org.springframework.http.ResponseEntity<ByteArray> {
        val image = service.get(projectId).image
            ?: return org.springframework.http.ResponseEntity.notFound().build()
        val mediaType = image.substringAfter("data:").substringBefore(";").ifBlank { "image/png" }
        val bytes = runCatching {
            java.util.Base64.getDecoder().decode(image.substringAfter(","))
        }.getOrElse { return org.springframework.http.ResponseEntity.notFound().build() }
        return org.springframework.http.ResponseEntity.ok()
            .header("Content-Type", mediaType)
            .header("Cache-Control", "public, max-age=3600")
            .body(bytes)
    }

    /** Removing a project takes its terms, translations and members with it. */
    @DeleteMapping("/{projectId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('OWNER')")
    @io.lexstore.common.RequiresProjectRole(io.lexstore.common.ContributorRole.OWNER)
    fun delete(@PathVariable projectId: UUID) = service.delete(projectId)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER')")
    @io.lexstore.common.RequiresProjectRole(io.lexstore.common.ContributorRole.OWNER)
    fun create(@Valid @RequestBody req: CreateProjectRequest): ProjectDetail = service.create(req)

    @PatchMapping("/{projectId}")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @io.lexstore.common.RequiresProjectRole(io.lexstore.common.ContributorRole.OWNER, io.lexstore.common.ContributorRole.ADMIN)
    fun update(@PathVariable projectId: UUID, @Valid @RequestBody req: UpdateProjectRequest): ProjectDetail =
        service.update(projectId, req)
}
