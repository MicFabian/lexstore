package io.translad.io

import io.translad.language.Language
import io.translad.language.LanguageRepository
import io.translad.project.CreateProjectRequest
import io.translad.project.ProjectNotFoundException
import io.translad.project.ProjectRepository
import io.translad.project.ProjectService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

data class PoeditorImportRequest(
    val apiToken: String,
    val poeditorProjectId: Long,
    /** POEditor language codes to import; each becomes a project language. */
    val languages: List<String>,
)

/** Import a POEditor project into a TransLad project created for it. */
data class PoeditorImportAsProjectRequest(
    val apiToken: String,
    val poeditorProjectId: Long,
    val languages: List<String>,
    /** Defaults to the POEditor project name and a slug derived from it. */
    val name: String? = null,
    val code: String? = null,
)

data class PoeditorImportResult(
    val projectId: UUID,
    val projectName: String,
    val languages: List<PoeditorLanguageImport>,
    val termsCreated: Int,
    val translationsImported: Int,
)

data class PoeditorLanguageImport(val code: String, val name: String, val imported: Int)

/** One row of the pre-import preview: the key and what each language holds. */
data class PoeditorPreviewRow(
    val key: String,
    val context: String?,
    val translations: Map<String, String?>,
)

data class PoeditorPreview(
    val languages: List<PoeditorLanguageImport>,
    val rows: List<PoeditorPreviewRow>,
    val totalTerms: Int,
)

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
    private val projectService: ProjectService,
) {
    fun projects(token: String): List<PoeditorProject> = client.projects(token)

    fun languages(token: String, poeditorProjectId: Long): List<PoeditorLanguage> =
        client.languages(token, poeditorProjectId)

    /**
     * Reads the first [limit] terms of the chosen languages so the wizard can
     * show what an import would bring in. Costs one API call per language.
     */
    fun preview(token: String, poeditorProjectId: Long, codes: List<String>, limit: Int = 25): PoeditorPreview {
        val available = client.languages(token, poeditorProjectId).associateBy { it.code }
        val perLanguage = mutableListOf<PoeditorLanguageImport>()
        val byKey = LinkedHashMap<String, MutableMap<String, String?>>()
        val contexts = mutableMapOf<String, String?>()
        var total = 0

        for (code in codes) {
            val remote = available[code] ?: throw PoeditorException("Language '$code' is not in that POEditor project.")
            val terms = client.terms(token, poeditorProjectId, code)
            total = maxOf(total, terms.size)
            perLanguage += PoeditorLanguageImport(code, remote.name, terms.count { it.translation != null })

            for (t in terms.take(limit)) {
                contexts.putIfAbsent(t.term, t.context)
                byKey.getOrPut(t.term) { mutableMapOf() }[code] = t.translation
            }
        }

        val rows = byKey.entries.take(limit).map { (key, translations) ->
            PoeditorPreviewRow(key, contexts[key], translations)
        }
        return PoeditorPreview(perLanguage, rows, total)
    }

    /** Import into an existing TransLad project. */
    @Transactional
    fun import(projectId: UUID, req: PoeditorImportRequest): PoeditorImportResult {
        val project = projects.findById(projectId)
            .orElseThrow { ProjectNotFoundException(projectId.toString()) }
        return pull(project.id, project.name, req.apiToken, req.poeditorProjectId, req.languages)
    }

    /** Import a whole POEditor project into a new TransLad project. */
    @Transactional
    fun importAsNewProject(req: PoeditorImportAsProjectRequest): PoeditorImportResult {
        val remote = client.projects(req.apiToken).find { it.id == req.poeditorProjectId }
            ?: throw PoeditorException("That POEditor project is not on this account.")
        val name = req.name?.takeIf { it.isNotBlank() } ?: remote.name
        val created = projectService.create(
            CreateProjectRequest(name = name, code = req.code?.takeIf { it.isNotBlank() } ?: slugFor(name)),
        )
        return pull(created.id, created.name, req.apiToken, req.poeditorProjectId, req.languages)
    }

    private fun pull(
        projectId: UUID,
        projectName: String,
        token: String,
        poeditorProjectId: Long,
        codes: List<String>,
    ): PoeditorImportResult {
        val available = client.languages(token, poeditorProjectId).associateBy { it.code }

        var created = 0
        var imported = 0
        val perLanguage = codes.map { code ->
            val remote = available[code] ?: throw PoeditorException("Language '$code' is not in that POEditor project.")
            ensureLanguage(projectId, remote)

            val entries = client.terms(token, poeditorProjectId, code)
                .mapNotNull { t -> t.translation?.let { t.term to it } }
                .toMap()

            val result = importExport.import(projectId, code, entries)
            created += result.created
            imported += result.updated
            PoeditorLanguageImport(code, remote.name, result.updated)
        }
        return PoeditorImportResult(projectId, projectName, perLanguage, created, imported)
    }

    /** A POEditor name becomes a slug; a clash gets a numeric suffix. */
    private fun slugFor(name: String): String {
        val base = name.lowercase()
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
            .ifBlank { "poeditor-import" }
        if (!projects.existsByCode(base)) return base
        var n = 2
        while (projects.existsByCode("$base-$n")) n++
        return "$base-$n"
    }

    private fun ensureLanguage(projectId: UUID, remote: PoeditorLanguage) {
        if (languages.findByProjectIdAndCode(projectId, remote.code) != null) return
        languages.save(Language(projectId = projectId, code = remote.code, name = remote.name))
    }
}
