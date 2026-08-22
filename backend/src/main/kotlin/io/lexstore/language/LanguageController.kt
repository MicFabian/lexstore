package io.lexstore.language

import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/projects/{projectId}/languages")
class LanguageController(private val service: LanguageService) {

    @GetMapping
    fun list(@PathVariable projectId: UUID): List<LanguageView> = service.list(projectId)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @io.lexstore.common.RequiresProjectRole(io.lexstore.common.ContributorRole.OWNER, io.lexstore.common.ContributorRole.ADMIN)
    fun add(@PathVariable projectId: UUID, @Valid @RequestBody req: AddLanguageRequest): LanguageView =
        service.add(projectId, req)

    @DeleteMapping("/{code}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @io.lexstore.common.RequiresProjectRole(io.lexstore.common.ContributorRole.OWNER, io.lexstore.common.ContributorRole.ADMIN)
    fun remove(@PathVariable projectId: UUID, @PathVariable code: String) =
        service.remove(projectId, code)
}
