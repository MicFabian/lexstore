package io.lexstore.io

import io.lexstore.common.CurrentUser
import io.lexstore.common.TranslationStatus
import io.lexstore.language.LanguageRepository
import io.lexstore.project.ProjectNotFoundException
import io.lexstore.project.ProjectRepository
import io.lexstore.term.Term
import io.lexstore.term.TermRepository
import io.lexstore.translation.Translation
import io.lexstore.translation.TranslationRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class ImportResult(val created: Int, val updated: Int, val total: Int)

private const val MAX_IMPORT_ENTRIES = 20_000
private const val MAX_IMPORT_KEY_CHARS = 512
private const val MAX_IMPORT_VALUE_CHARS = 10_000

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
        require(entries.size <= MAX_IMPORT_ENTRIES) {
            "An import carries at most $MAX_IMPORT_ENTRIES entries; this one has ${entries.size}."
        }
        entries.forEach { (key, value) ->
            require(key.length <= MAX_IMPORT_KEY_CHARS) {
                "The key '${key.take(60)}…' is longer than $MAX_IMPORT_KEY_CHARS characters."
            }
            require(value.length <= MAX_IMPORT_VALUE_CHARS) {
                "The value for '$key' is longer than $MAX_IMPORT_VALUE_CHARS characters."
            }
        }

        val me = currentUser.identity()
        val now = Instant.now()

        // One lookup for the whole import rather than two per entry: a 5,000
        // entry file otherwise costs 10,000 round trips to the database.
        val existingTerms = terms.findByProjectIdOrderByCreatedAtDesc(projectId)
            .associateBy { it.key }
        val newTerms = entries.keys
            .filter { it.isNotBlank() && it !in existingTerms }
            .map { key ->
                Term(
                    projectId = projectId,
                    key = key,
                    sourceText = entries.getValue(key),
                    addedLabel = "Imported",
                    isNew = true,
                )
            }
        val created = newTerms.size
        val termsByKey = existingTerms + terms.saveAll(newTerms).associateBy { it.key }

        val existingTranslations = translations
            .findByTermIdInAndLanguageCode(termsByKey.values.map { it.id }, languageCode)
            .associateBy { it.termId }

        var updated = 0
        val fresh = mutableListOf<Translation>()
        for ((key, value) in entries) {
            if (key.isBlank()) continue
            val term = termsByKey.getValue(key)
            val existing = existingTranslations[term.id]
            if (existing != null) {
                existing.apply {
                    this.value = value
                    status = TranslationStatus.TRANSLATED
                    updatedAt = now
                    modifiedByName = me.name
                    modifiedByAvatar = me.avatar
                }
                updated++
            } else {
                fresh += Translation(
                    termId = term.id,
                    languageCode = languageCode,
                    value = value,
                    status = TranslationStatus.TRANSLATED,
                    modifiedByName = me.name,
                    modifiedByAvatar = me.avatar,
                )
            }
        }
        translations.saveAll(fresh)
        return ImportResult(created, updated + fresh.size, entries.size)
    }

    /** Export a language as an ordered key→value map of all terms. */
    @Transactional(readOnly = true)
    fun export(projectId: UUID, languageCode: String): LinkedHashMap<String, String> {
        projects.findById(projectId).orElseThrow { ProjectNotFoundException(projectId.toString()) }
        val projTerms = terms.findByProjectIdOrderByCreatedAtDesc(projectId).sortedBy { it.key }
        // Filtered by the database: reading every language to keep one means a
        // twenty-language project fetches twenty times the rows it exports.
        val byTerm = translations
            .findByTermIdInAndLanguageCode(projTerms.map { it.id }, languageCode)
            .associateBy { it.termId }
        return projTerms.associateTo(LinkedHashMap()) { it.key to (byTerm[it.id]?.value ?: "") }
    }
}
