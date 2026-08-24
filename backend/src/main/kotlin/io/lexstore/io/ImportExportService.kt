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

data class ImportResult(
    val created: Int,
    val updated: Int,
    val total: Int,
    /** Entries whose translation already matched, so nothing was written. */
    val unchanged: Int = 0,
)

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
    private val events: io.lexstore.translation.TranslationEventRepository,
    private val currentUser: CurrentUser,
) {
    private fun event(
        projectId: UUID,
        termId: UUID,
        languageCode: String,
        oldValue: String?,
        newValue: String?,
        me: io.lexstore.common.UserIdentity,
        at: Instant,
    ) = io.lexstore.translation.TranslationEvent(
        projectId = projectId,
        termId = termId,
        languageCode = languageCode,
        action = "imported",
        oldValue = oldValue,
        newValue = newValue,
        newStatus = TranslationStatus.TRANSLATED,
        authorName = me.name,
        authorAvatar = me.avatar,
        createdAt = at,
    )

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
        val existingTerms = terms.findByProjectIdOrderByCreatedAtDescIdAsc(projectId)
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
        var unchanged = 0
        val fresh = mutableListOf<Translation>()
        // An import changes translations like any other edit, so it belongs in
        // the history: without this a value changes with no trace of who or when.
        val history = mutableListOf<io.lexstore.translation.TranslationEvent>()
        for ((key, value) in entries) {
            if (key.isBlank()) continue
            val term = termsByKey.getValue(key)
            val existing = existingTranslations[term.id]
            if (existing != null) {
                val before = existing.value
                // A re-import of unchanged content must not claim the row: it
                // would make the importer the last editor of every string and
                // report work that did not happen.
                if (before != value) {
                    existing.apply {
                        this.value = value
                        status = TranslationStatus.TRANSLATED
                        updatedAt = now
                        modifiedByName = me.name
                        modifiedByAvatar = me.avatar
                    }
                    history += event(projectId, term.id, languageCode, before, value, me, now)
                    updated++
                } else {
                    unchanged++
                }
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
        fresh.forEach {
            history += event(projectId, it.termId, languageCode, null, it.value, me, now)
        }
        events.saveAll(history)
        projects.touch(projectId, now)
        return ImportResult(created, updated + fresh.size, entries.size, unchanged)
    }

    /** Export a language as an ordered key→value map of all terms. */
    @Transactional(readOnly = true)
    fun export(projectId: UUID, languageCode: String): LinkedHashMap<String, String> {
        projects.findById(projectId).orElseThrow { ProjectNotFoundException(projectId.toString()) }
        val projTerms = terms.findByProjectIdOrderByCreatedAtDescIdAsc(projectId).sortedBy { it.key }
        // Filtered by the database: reading every language to keep one means a
        // twenty-language project fetches twenty times the rows it exports.
        val byTerm = translations
            .findByTermIdInAndLanguageCode(projTerms.map { it.id }, languageCode)
            .associateBy { it.termId }
        return projTerms.associateTo(LinkedHashMap()) { it.key to (byTerm[it.id]?.value ?: "") }
    }
}
