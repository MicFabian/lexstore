package io.translad.translation

import io.translad.ai.AiTranslationService
import io.translad.ai.TranslateRequest
import io.translad.common.CurrentUser
import io.translad.common.RelativeTime
import io.translad.common.TranslationStatus
import io.translad.language.LanguageRepository
import io.translad.project.ProjectNotFoundException
import io.translad.project.ProjectRepository
import io.translad.term.AuditEntry
import io.translad.term.CommentView
import io.translad.term.EditorResponse
import io.translad.term.EditorRow
import io.translad.term.PluralForms
import io.translad.term.Term
import io.translad.term.TermComment
import io.translad.term.TermCommentRepository
import io.translad.term.TermNotFoundException
import io.translad.term.TermRepository
import io.translad.term.toView
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
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
    private val ai: AiTranslationService,
    private val currentUser: CurrentUser,
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

        val rows = projTerms.map { t -> editorRow(t, byTerm[t.id], commentsOf(t.id)) }
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
            existing.apply {
                value = req.value
                pluralOne = req.pluralOne
                status = newStatus
                updatedAt = now
                modifiedByName = author
                modifiedByAvatar = avatar
            }
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

        return editorRow(term, saved, commentsOf(termId))
    }

    /** AI machine-translation suggestion for one term (cached). Does not save. */
    fun suggest(projectId: UUID, termId: UUID, languageCode: String): SuggestionResponse {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        val project = projects.findById(projectId)
            .orElseThrow { ProjectNotFoundException(projectId.toString()) }
        val res = ai.translate(TranslateRequest(term.sourceText, project.sourceLang, languageCode, projectContext = project.translationContext))
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

        val targetStatus = if (ai.settings().autoFlagFuzzy) "fuzzy" else "translated"
        val projTerms = terms.findByProjectIdOrderByCreatedAtDesc(projectId)
        val existing = translations.findByTermIdIn(projTerms.map { it.id })
            .filter { it.languageCode == languageCode }
            .associateBy { it.termId }

        var translated = 0
        for (t in projTerms) {
            if (!existing[t.id]?.value.isNullOrBlank()) continue // already translated
            val res = ai.translate(TranslateRequest(t.sourceText, project.sourceLang, languageCode, projectContext = project.translationContext))
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
                at = RelativeTime.format(it.createdAt, withTime = true),
            )
        }
    }

    private fun commentsOf(termId: UUID): List<CommentView> =
        comments.findByTermIdOrderByCreatedAt(termId).map(TermComment::toView)

    private fun editorRow(term: Term, tr: Translation?, comments: List<CommentView>): EditorRow =
        EditorRow(
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
            modifiedBy = tr?.modifiedByName?.let {
                AuditEntry(it, tr.modifiedByAvatar ?: 0, "edited", RelativeTime.format(tr.updatedAt))
            },
            modifiedAt = tr?.modifiedByName?.let { RelativeTime.format(tr.updatedAt) },
        )

    private fun actionFor(old: String?, new: String?, status: TranslationStatus): String = when {
        new.isNullOrBlank() -> "cleared"
        status == TranslationStatus.PROOFREAD -> "proofread"
        status == TranslationStatus.FUZZY -> "flagged"
        old.isNullOrBlank() -> "translated"
        else -> "edited"
    }
}
