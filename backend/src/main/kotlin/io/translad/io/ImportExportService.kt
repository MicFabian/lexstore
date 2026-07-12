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
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
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
                existing.apply {
                    this.value = value
                    status = TranslationStatus.TRANSLATED
                    updatedAt = Instant.now()
                    modifiedByName = me.name
                    modifiedByAvatar = me.avatar
                }
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
            }
            updated++
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
        return projTerms.associateTo(LinkedHashMap()) { it.key to (byTerm[it.id]?.value ?: "") }
    }
}
