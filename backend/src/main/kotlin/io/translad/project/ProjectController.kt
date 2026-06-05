package io.translad.project

import jakarta.validation.Valid
import org.springframework.http.HttpStatus
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

    @GetMapping("/{id}")
    fun get(@PathVariable id: UUID): ProjectDetail = service.detail(id)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: CreateProjectRequest): ProjectDetail = service.create(req)

    @PatchMapping("/{id}")
    fun update(@PathVariable id: UUID, @RequestBody req: UpdateProjectRequest): ProjectDetail =
        service.update(id, req)
}
