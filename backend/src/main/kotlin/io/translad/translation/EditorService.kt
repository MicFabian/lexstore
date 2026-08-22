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

class TranslationConflictException :
    RuntimeException("Someone else saved this translation while you were editing it. Reload to see their version.")

private const val MAX_AUTO_TRANSLATE_BATCH = 200

/** A term's history panel shows the recent past; the full audit lives in the events table. */
private const val MAX_HISTORY_ENTRIES = 100

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
    @org.springframework.context.annotation.Lazy private val self: EditorService,
) {
    private val log = org.slf4j.LoggerFactory.getLogger(javaClass)

    fun editor(projectId: UUID, languageCode: String): EditorResponse {
        val project = projects.findById(projectId)
            .orElseThrow { ProjectNotFoundException(projectId.toString()) }
        languages.findByProjectIdAndCode(projectId, languageCode)
            ?: throw LanguageNotInProjectException(languageCode)

        val projTerms = terms.findByProjectIdOrderByCreatedAtDesc(projectId)
        val byTerm = if (projTerms.isEmpty()) emptyMap()
        else translations.findByTermIdInAndLanguageCode(projTerms.map { it.id }, languageCode)
            .associateBy { it.termId }

        val rows = projTerms.map { t -> editorRow(t, byTerm[t.id]) }
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
        val author = me.name
        val avatar = me.avatar
        val now = Instant.now()

        val existing = translations.findByTermIdAndLanguageCode(termId, languageCode)
        if (req.version != null && existing != null && existing.version != req.version) {
            throw TranslationConflictException()
        }
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

        return editorRow(term, saved)
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

    /**
     * Auto-translate the untranslated terms of a language.
     *
     * Each term is translated and committed on its own, because every call
     * costs money at the provider: a failure on term 900 must not roll back
     * the 899 translations already paid for. The batch is capped so one
     * request cannot spend without bound; the response reports what is left
     * so the caller can continue.
     *
     * Deliberately not transactional itself: each save commits on its own via
     * the proxy, and the class default of readOnly would otherwise swallow
     * those writes.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    fun autoTranslate(projectId: UUID, languageCode: String): AutoTranslateResult {
        val project = projects.findById(projectId)
            .orElseThrow { ProjectNotFoundException(projectId.toString()) }
        languages.findByProjectIdAndCode(projectId, languageCode)
            ?: throw LanguageNotInProjectException(languageCode)

        val targetStatus = if (ai.settings().autoFlagFuzzy) "fuzzy" else "translated"
        val pending = pendingTermIds(projectId, languageCode)
        val batch = pending.take(MAX_AUTO_TRANSLATE_BATCH)

        var translated = 0
        var failed = 0
        for (termId in batch) {
            val sourceText = terms.findById(termId).orElse(null)?.sourceText ?: continue
            val text = try {
                ai.translate(
                    TranslateRequest(
                        sourceText,
                        project.sourceLang,
                        languageCode,
                        projectContext = project.translationContext,
                    ),
                ).text
            } catch (ex: Exception) {
                log.warn("Auto-translate failed for term {} in {}", termId, languageCode, ex)
                failed++
                continue
            }
            self.save(projectId, termId, languageCode, SaveTranslationRequest(text, null, targetStatus))
            translated++
        }
        return AutoTranslateResult(
            translated = translated,
            status = targetStatus,
            failed = failed,
            remaining = (pending.size - batch.size).coerceAtLeast(0),
        )
    }

    private fun pendingTermIds(projectId: UUID, languageCode: String): List<UUID> {
        val projTerms = terms.findByProjectIdOrderByCreatedAtDesc(projectId)
        val existing = translations
            .findByTermIdInAndLanguageCode(projTerms.map { it.id }, languageCode)
            .associateBy { it.termId }
        return projTerms.filter { existing[it.id]?.value.isNullOrBlank() }.map { it.id }
    }

    /** Full translation history for a term across every language, newest first. */
    fun history(projectId: UUID, termId: UUID): List<TranslationHistoryEntry> {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        return events.findByTermIdOrderByCreatedAtDesc(
            termId,
            org.springframework.data.domain.PageRequest.of(0, MAX_HISTORY_ENTRIES),
        ).map {
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

    private fun editorRow(term: Term, tr: Translation?): EditorRow {
        val editedAt = tr?.modifiedByName?.let { RelativeTime.format(tr.updatedAt) }
        return EditorRow(
            id = term.id,
            key = term.key,
            ctx = term.ctx,
            source = term.sourceText,
            plural = if (term.isPlural) PluralForms(term.pluralOne, term.pluralOther) else null,
            tags = term.tagList,
            isNew = term.isNew,
            featureId = term.featureId,
            target = tr?.value,
            version = tr?.version,
            status = (tr?.status?.name ?: "UNTRANSLATED").lowercase(),
            modifiedBy = tr?.modifiedByName?.let {
                AuditEntry(it, tr.modifiedByAvatar ?: 0, "edited", editedAt.orEmpty())
            },
            modifiedAt = editedAt,
        )
    }

    private fun actionFor(old: String?, new: String?, status: TranslationStatus): String = when {
        new.isNullOrBlank() -> "cleared"
        status == TranslationStatus.PROOFREAD -> "proofread"
        status == TranslationStatus.FUZZY -> "flagged"
        old.isNullOrBlank() -> "translated"
        else -> "edited"
    }
}
