package io.lexstore.project

import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
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
