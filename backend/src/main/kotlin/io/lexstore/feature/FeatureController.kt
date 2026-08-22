package io.lexstore.feature

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
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/projects/{projectId}/features")
class FeatureController(private val service: FeatureService) {

    @GetMapping
    fun list(@PathVariable projectId: UUID): List<FeatureView> = service.list(projectId)

    @GetMapping("/{featureId}")
    fun detail(@PathVariable projectId: UUID, @PathVariable featureId: UUID): FeatureView =
        service.detail(projectId, featureId)

    /** Everything still to translate in this feature, optionally for one language. */
    @GetMapping("/{featureId}/open")
    fun open(
        @PathVariable projectId: UUID,
        @PathVariable featureId: UUID,
        @RequestParam(required = false) lang: String?,
    ): List<OpenTranslationView> = service.openTranslations(projectId, featureId, lang)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @io.lexstore.common.RequiresProjectRole(io.lexstore.common.ContributorRole.OWNER, io.lexstore.common.ContributorRole.ADMIN)
    fun create(
        @PathVariable projectId: UUID,
        @Valid @RequestBody req: CreateFeatureRequest,
    ): FeatureView = service.create(projectId, req)

    @PatchMapping("/{featureId}")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @io.lexstore.common.RequiresProjectRole(io.lexstore.common.ContributorRole.OWNER, io.lexstore.common.ContributorRole.ADMIN)
    fun update(
        @PathVariable projectId: UUID,
        @PathVariable featureId: UUID,
        @RequestBody req: UpdateFeatureRequest,
    ): FeatureView = service.update(projectId, featureId, req)

    @DeleteMapping("/{featureId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @io.lexstore.common.RequiresProjectRole(io.lexstore.common.ContributorRole.OWNER, io.lexstore.common.ContributorRole.ADMIN)
    fun delete(@PathVariable projectId: UUID, @PathVariable featureId: UUID) =
        service.delete(projectId, featureId)

    /** Move terms into this feature. */
    @PostMapping("/{featureId}/terms")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','TRANSLATOR')")
    @io.lexstore.common.RequiresProjectRole(io.lexstore.common.ContributorRole.OWNER, io.lexstore.common.ContributorRole.ADMIN, io.lexstore.common.ContributorRole.TRANSLATOR)
    fun assign(
        @PathVariable projectId: UUID,
        @PathVariable featureId: UUID,
        @RequestBody req: AssignTermsRequest,
    ): FeatureView = service.assign(projectId, featureId, req)

    /** Take terms out of whatever feature they are in. */
    @DeleteMapping("/terms")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','TRANSLATOR')")
    @io.lexstore.common.RequiresProjectRole(io.lexstore.common.ContributorRole.OWNER, io.lexstore.common.ContributorRole.ADMIN, io.lexstore.common.ContributorRole.TRANSLATOR)
    fun unassign(@PathVariable projectId: UUID, @RequestBody req: AssignTermsRequest) =
        service.unassign(projectId, req)
}
