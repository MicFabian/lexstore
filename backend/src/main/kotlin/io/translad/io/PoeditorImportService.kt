package io.translad.io

import io.translad.language.Language
import io.translad.language.LanguageRepository
import io.translad.project.ProjectNotFoundException
import io.translad.project.ProjectRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

data class PoeditorImportRequest(
    val apiToken: String,
    val poeditorProjectId: Long,
    /** POEditor language codes to import; each becomes a project language. */
    val languages: List<String>,
    /** Import the POEditor source strings as terms when a key is unknown. */
    val createMissingTerms: Boolean = true,
)

data class PoeditorImportResult(
    val languages: List<PoeditorLanguageImport>,
    val termsCreated: Int,
    val translationsImported: Int,
)

data class PoeditorLanguageImport(val code: String, val name: String, val imported: Int)

/**
 * Pulls terms and translations from a POEditor project into a TransLad project.
 * The POEditor term itself is the key; its translation becomes the value.
 */
@Service
class PoeditorImportService(
    private val client: PoeditorClient,
    private val projects: ProjectRepository,
    private val languages: LanguageRepository,
    private val importExport: ImportExportService,
) {
    fun projects(token: String): List<PoeditorProject> = client.projects(token)

    fun languages(token: String, poeditorProjectId: Long): List<PoeditorLanguage> =
        client.languages(token, poeditorProjectId)

    @Transactional
    fun import(projectId: UUID, req: PoeditorImportRequest): PoeditorImportResult {
        projects.findById(projectId).orElseThrow { ProjectNotFoundException(projectId.toString()) }
        val available = client.languages(req.apiToken, req.poeditorProjectId).associateBy { it.code }

        var created = 0
        var imported = 0
        val perLanguage = req.languages.map { code ->
            val remote = available[code] ?: throw PoeditorException("Language '$code' is not in that POEditor project.")
            ensureLanguage(projectId, remote)

            val entries = client.terms(req.apiToken, req.poeditorProjectId, code)
                .mapNotNull { t -> t.translation?.let { t.term to it } }
                .toMap()

            val result = importExport.import(projectId, code, entries)
            created += result.created
            imported += result.updated
            PoeditorLanguageImport(code, remote.name, result.updated)
        }
        return PoeditorImportResult(perLanguage, created, imported)
    }

    private fun ensureLanguage(projectId: UUID, remote: PoeditorLanguage) {
        if (languages.findByProjectIdAndCode(projectId, remote.code) != null) return
        languages.save(Language(projectId = projectId, code = remote.code, name = remote.name))
    }
}
