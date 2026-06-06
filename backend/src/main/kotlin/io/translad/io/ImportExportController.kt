package io.translad.io

import io.translad.common.CurrentUser
import io.translad.common.TranslationStatus
import io.translad.language.LanguageRepository
import io.translad.project.ProjectNotFoundException
import io.translad.project.ProjectRepository
import io.translad.term.Term
import io.translad.term.TermRepository
import io.translad.translation.Translation
import io.translad.translation.TranslationRepository
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.util.UUID

data class ImportResult(val created: Int, val updated: Int, val total: Int)

@Service
@Transactional
class ImportExportService(
    private val projects: ProjectRepository,
    private val languages: LanguageRepository,
    private val terms: TermRepository,
    private val translations: TranslationRepository,
    private val currentUser: CurrentUser,
) {
    /** Import a flat key→value map into a language, creating missing terms. */
    fun import(projectId: UUID, languageCode: String, entries: Map<String, String>): ImportResult {
        projects.findById(projectId).orElseThrow { ProjectNotFoundException(projectId.toString()) }
        require(languages.findByProjectIdAndCode(projectId, languageCode) != null) {
            "Language '$languageCode' is not part of this project."
        }

        val me = currentUser.identity()
        var created = 0
        var updated = 0
        for ((key, value) in entries) {
            if (key.isBlank()) continue
            val term = terms.findByProjectIdAndKey(projectId, key) ?: terms.save(
                Term(
                    projectId = projectId,
                    key = key,
                    sourceText = value,
                    addedLabel = "Imported",
                    isNew = true,
                ),
            ).also { created++ }

            val existing = translations.findByTermIdAndLanguageCode(term.id, languageCode)
            if (existing != null) {
                existing.value = value
                existing.status = TranslationStatus.TRANSLATED
                existing.updatedAt = Instant.now()
                existing.modifiedByName = me.name
                existing.modifiedByAvatar = me.avatar
                updated++
            } else {
                translations.save(
                    Translation(
                        termId = term.id,
                        languageCode = languageCode,
                        value = value,
                        status = TranslationStatus.TRANSLATED,
                        modifiedByName = me.name,
                        modifiedByAvatar = me.avatar,
                    ),
                )
                updated++
            }
        }
        return ImportResult(created, updated, entries.size)
    }

    /** Export a language as an ordered key→value map of all terms. */
    @Transactional(readOnly = true)
    fun export(projectId: UUID, languageCode: String): LinkedHashMap<String, String> {
        projects.findById(projectId).orElseThrow { ProjectNotFoundException(projectId.toString()) }
        val projTerms = terms.findByProjectIdOrderByCreatedAtDesc(projectId).sortedBy { it.key }
        val byTerm = translations.findByTermIdIn(projTerms.map { it.id })
            .filter { it.languageCode == languageCode }
            .associateBy { it.termId }
        val out = LinkedHashMap<String, String>()
        for (t in projTerms) out[t.key] = byTerm[t.id]?.value ?: ""
        return out
    }
}

@RestController
@RequestMapping("/api/projects/{projectId}")
class ImportExportController(private val service: ImportExportService) {

    /** Import a JSON object of key→value translations for one language. */
    @PostMapping("/import")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','TRANSLATOR')")
    fun import(
        @PathVariable projectId: UUID,
        @RequestParam lang: String,
        @RequestBody entries: Map<String, String>,
    ): ImportResult = service.import(projectId, lang, entries)

    /** Export one language as a downloadable JSON or CSV file. */
    @GetMapping("/export")
    fun export(
        @PathVariable projectId: UUID,
        @RequestParam lang: String,
        @RequestParam(defaultValue = "json") format: String,
    ): ResponseEntity<ByteArray> {
        val data = service.export(projectId, lang)
        return if (format.equals("csv", ignoreCase = true)) {
            val csv = buildString {
                append("key,value\n")
                for ((k, v) in data) append("${csvCell(k)},${csvCell(v)}\n")
            }
            file(csv.toByteArray(), "translations-$lang.csv", "text/csv")
        } else {
            val json = buildString {
                append("{\n")
                val entries = data.entries.toList()
                entries.forEachIndexed { i, (k, v) ->
                    append("  ${jsonStr(k)}: ${jsonStr(v)}")
                    append(if (i < entries.size - 1) ",\n" else "\n")
                }
                append("}\n")
            }
            file(json.toByteArray(), "translations-$lang.json", "application/json")
        }
    }

    private fun file(bytes: ByteArray, name: String, type: String): ResponseEntity<ByteArray> =
        ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"$name\"")
            .contentType(MediaType.parseMediaType(type))
            .body(bytes)

    private fun csvCell(s: String): String =
        if (s.contains(',') || s.contains('"') || s.contains('\n')) "\"${s.replace("\"", "\"\"")}\"" else s

    private fun jsonStr(s: String): String =
        "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""
}
