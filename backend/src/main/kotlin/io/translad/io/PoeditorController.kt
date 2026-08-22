package io.translad.io

import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

data class PoeditorTokenRequest(val apiToken: String)

data class PoeditorLanguagesRequest(val apiToken: String, val poeditorProjectId: Long)

data class PoeditorPreviewRequest(
    val apiToken: String,
    val poeditorProjectId: Long,
    val languages: List<String>,
)

/**
 * Import wizard endpoints. The POEditor token is supplied per request and only
 * used to call POEditor — it is never persisted or logged.
 */
@RestController
@RequestMapping("/api/poeditor")
@PreAuthorize("hasAnyRole('OWNER','ADMIN','TRANSLATOR')")
@io.translad.common.RequiresProjectRole(io.translad.common.ContributorRole.OWNER, io.translad.common.ContributorRole.ADMIN, io.translad.common.ContributorRole.TRANSLATOR)
class PoeditorController(private val service: PoeditorImportService) {

    @PostMapping("/projects")
    fun projects(@RequestBody req: PoeditorTokenRequest): List<PoeditorProject> =
        service.projects(req.apiToken)

    @PostMapping("/languages")
    fun languages(@RequestBody req: PoeditorLanguagesRequest): List<PoeditorLanguage> =
        service.languages(req.apiToken, req.poeditorProjectId)

    /** What the selected languages would bring in, before importing. */
    @PostMapping("/preview")
    fun preview(@RequestBody req: PoeditorPreviewRequest): PoeditorPreview =
        service.preview(req.apiToken, req.poeditorProjectId, req.languages)

    /** Import into an existing project. */
    @PostMapping("/projects/{projectId}/import")
    fun import(
        @PathVariable projectId: UUID,
        @RequestBody req: PoeditorImportRequest,
    ): PoeditorImportResult = service.import(projectId, req)

    /** Import a whole POEditor project into a newly created one. */
    @PostMapping("/import")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @io.translad.common.RequiresProjectRole(io.translad.common.ContributorRole.OWNER, io.translad.common.ContributorRole.ADMIN)
    fun importAsNewProject(@RequestBody req: PoeditorImportAsProjectRequest): PoeditorImportResult =
        service.importAsNewProject(req)
}
