package io.translad.translation

import io.translad.common.TranslationStatus
import io.translad.language.LanguageRepository
import io.translad.term.AuditEntry
import io.translad.term.CommentView
import io.translad.term.EditorResponse
import io.translad.term.EditorRow
import io.translad.term.PluralForms
import io.translad.term.TermCommentRepository
import io.translad.term.TermNotFoundException
import io.translad.term.TermRepository
import io.translad.project.ProjectRepository
import io.translad.project.ProjectNotFoundException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

class LanguageNotInProjectException(code: String) :
    RuntimeException("Language '$code' is not part of this project.")

@Service
@Transactional(readOnly = true)
class EditorService(
    private val terms: TermRepository,
    private val translations: TranslationRepository,
    private val languages: LanguageRepository,
    private val projects: ProjectRepository,
    private val comments: TermCommentRepository,
    private val events: TranslationEventRepository,
    private val ai: io.translad.ai.AiTranslationService,
    private val currentUser: io.translad.common.CurrentUser,
) {
    fun editor(projectId: UUID, languageCode: String): EditorResponse {
        val project = projects.findById(projectId)
            .orElseThrow { ProjectNotFoundException(projectId.toString()) }
        languages.findByProjectIdAndCode(projectId, languageCode)
            ?: throw LanguageNotInProjectException(languageCode)

        val projTerms = terms.findByProjectIdOrderByCreatedAtDesc(projectId)
        val byTerm = if (projTerms.isEmpty()) emptyMap()
        else translations.findByTermIdIn(projTerms.map { it.id })
            .filter { it.languageCode == languageCode }
            .associateBy { it.termId }
        val commentsByTerm = projTerms.associate { t ->
            t.id to comments.findByTermIdOrderByCreatedAt(t.id)
                .map { CommentView(it.id, it.authorName, it.authorAvatar, it.text, it.timeLabel) }
        }

        val rows = projTerms.map { t ->
            val tr = byTerm[t.id]
            editorRow(t, tr, commentsByTerm[t.id].orEmpty())
        }
        return EditorResponse(languageCode, project.sourceLang, rows)
    }

    @Transactional
    fun save(projectId: UUID, termId: UUID, languageCode: String, req: SaveTranslationRequest): EditorRow {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        languages.findByProjectIdAndCode(projectId, languageCode)
            ?: throw LanguageNotInProjectException(languageCode)

        val newStatus = TranslationStatus.from(req.status)
        val me = currentUser.identity()
        val author = req.authorName ?: me.name
        val avatar = req.authorAvatar ?: me.avatar
        val now = Instant.now()

        val existing = translations.findByTermIdAndLanguageCode(termId, languageCode)
        val oldValue = existing?.value
        val oldStatus = existing?.status

        val saved = if (existing != null) {
            existing.value = req.value
            existing.pluralOne = req.pluralOne
            existing.status = newStatus
            existing.updatedAt = now
            existing.modifiedByName = author
            existing.modifiedByAvatar = avatar
            existing
        } else {
            translations.save(
                Translation(
                    termId = termId,
                    languageCode = languageCode,
                    value = req.value,
                    pluralOne = req.pluralOne,
                    status = newStatus,
                    updatedAt = now,
                    modifiedByName = author,
                    modifiedByAvatar = avatar,
                ),
            )
        }

        events.save(
            TranslationEvent(
                projectId = projectId,
                termId = termId,
                languageCode = languageCode,
                action = actionFor(oldValue, req.value, newStatus),
                oldValue = oldValue,
                newValue = req.value,
                oldStatus = oldStatus,
                newStatus = newStatus,
                authorName = author,
                authorAvatar = avatar,
                createdAt = now,
            ),
        )

        // Saving a real value clears the "new" flag on the source term.
        if (!req.value.isNullOrBlank()) term.isNew = false

        return editorRow(term, saved, comments.findByTermIdOrderByCreatedAt(termId)
            .map { CommentView(it.id, it.authorName, it.authorAvatar, it.text, it.timeLabel) })
    }

    /** AI machine-translation suggestion for one term (cached). Does not save. */
    fun suggest(projectId: UUID, termId: UUID, languageCode: String): SuggestionResponse {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        val project = projects.findById(projectId)
            .orElseThrow { ProjectNotFoundException(projectId.toString()) }
        val res = ai.translate(
            io.translad.ai.TranslateRequest(
                sourceText = term.sourceText,
                sourceLang = project.sourceLang,
                targetLang = languageCode,
            ),
        )
        return SuggestionResponse(res.text, res.provider, res.model, res.cacheHit)
    }

    /** Auto-translate every untranslated term for a language. Saved as fuzzy when settings ask. */
    @Transactional
    fun autoTranslate(projectId: UUID, languageCode: String): AutoTranslateResult {
        val author = currentUser.name()
        val project = projects.findById(projectId)
            .orElseThrow { ProjectNotFoundException(projectId.toString()) }
        languages.findByProjectIdAndCode(projectId, languageCode)
            ?: throw LanguageNotInProjectException(languageCode)

        val flagFuzzy = ai.settings().autoFlagFuzzy
        val targetStatus = if (flagFuzzy) "fuzzy" else "translated"

        val projTerms = terms.findByProjectIdOrderByCreatedAtDesc(projectId)
        val existing = translations.findByTermIdIn(projTerms.map { it.id })
            .filter { it.languageCode == languageCode }
            .associateBy { it.termId }

        var translated = 0
        for (t in projTerms) {
            val cur = existing[t.id]
            if (!cur?.value.isNullOrBlank()) continue // skip already-translated
            val res = ai.translate(
                io.translad.ai.TranslateRequest(t.sourceText, project.sourceLang, languageCode),
            )
            save(projectId, t.id, languageCode, SaveTranslationRequest(res.text, null, targetStatus, author, 0))
            translated++
        }
        return AutoTranslateResult(translated, targetStatus)
    }

    /** Full translation history for a term across every language, newest first. */
    fun history(projectId: UUID, termId: UUID): List<TranslationHistoryEntry> {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        return events.findByTermIdOrderByCreatedAtDesc(termId).map {
            TranslationHistoryEntry(
                languageCode = it.languageCode,
                action = it.action,
                oldValue = it.oldValue,
                newValue = it.newValue,
                oldStatus = it.oldStatus?.name?.lowercase(),
                newStatus = it.newStatus.name.lowercase(),
                authorName = it.authorName,
                authorAvatar = it.authorAvatar,
                at = relativeTime(it.createdAt),
            )
        }
    }

    private fun editorRow(
        term: io.translad.term.Term,
        tr: Translation?,
        comments: List<CommentView>,
    ): EditorRow = EditorRow(
        id = term.id,
        key = term.key,
        ctx = term.ctx,
        source = term.sourceText,
        plural = if (term.isPlural) PluralForms(term.pluralOne, term.pluralOther) else null,
        tags = term.tagList,
        isNew = term.isNew,
        target = tr?.value,
        status = (tr?.status?.name ?: "UNTRANSLATED").lowercase(),
        comments = comments,
        modifiedBy = tr?.modifiedByName?.let { AuditEntry(it, tr.modifiedByAvatar ?: 0, "edited", relativeTime(tr.updatedAt)) },
        modifiedAt = tr?.modifiedByName?.let { relativeTime(tr.updatedAt) },
    )

    private fun actionFor(old: String?, new: String?, status: TranslationStatus): String = when {
        new.isNullOrBlank() -> "cleared"
        status == TranslationStatus.PROOFREAD -> "proofread"
        status == TranslationStatus.FUZZY -> "flagged"
        old.isNullOrBlank() -> "translated"
        else -> "edited"
    }

    private fun relativeTime(at: Instant): String {
        val d = Duration.between(at, Instant.now())
        return when {
            d.toMinutes() < 1 -> "just now"
            d.toMinutes() < 60 -> "${d.toMinutes()}m ago"
            d.toHours() < 24 -> "${d.toHours()}h ago"
            d.toDays() < 7 -> "${d.toDays()}d ago"
            else -> ISO.format(at)
        }
    }

    companion object {
        private val ISO: DateTimeFormatter =
            DateTimeFormatter.ofPattern("MMM d, yyyy").withZone(ZoneOffset.UTC)
    }
}
