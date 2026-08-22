package io.translad.apikey

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
@RequestMapping("/api/projects/{projectId}/api-keys")
class ApiKeyController(private val service: ApiKeyService) {

    @GetMapping
    fun list(@PathVariable projectId: UUID): List<ApiKeyView> = service.list(projectId)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @io.translad.common.RequiresProjectRole(io.translad.common.ContributorRole.OWNER, io.translad.common.ContributorRole.ADMIN)
    fun generate(
        @PathVariable projectId: UUID,
        @Valid @RequestBody req: GenerateApiKeyRequest,
    ): ApiKeyCreated = service.generate(projectId, req)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @io.translad.common.RequiresProjectRole(io.translad.common.ContributorRole.OWNER, io.translad.common.ContributorRole.ADMIN)
    fun revoke(@PathVariable projectId: UUID, @PathVariable id: UUID) = service.revoke(projectId, id)
}
