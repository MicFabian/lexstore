package io.lexstore.translation

import io.lexstore.ai.AiTranslationService
import io.lexstore.ai.TranslateRequest
import io.lexstore.common.CurrentUser
import io.lexstore.common.RelativeTime
import io.lexstore.common.TranslationStatus
import io.lexstore.language.LanguageRepository
import io.lexstore.project.ProjectNotFoundException
import io.lexstore.project.ProjectRepository
import io.lexstore.term.AuditEntry
import io.lexstore.term.CommentView
import io.lexstore.term.EditorResponse
import io.lexstore.term.EditorCounts
import io.lexstore.term.EditorRow
import io.lexstore.term.PluralForms
import io.lexstore.term.Term
import io.lexstore.term.TermComment
import io.lexstore.term.TermCommentRepository
import io.lexstore.term.TermNotFoundException
import io.lexstore.term.TermRepository
import io.lexstore.term.toView
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

class LanguageNotInProjectException(code: String) :
    RuntimeException("Language '$code' is not part of this project.")

class TranslationConflictException :
    RuntimeException("Someone else saved this translation while you were editing it. Reload to see their version.")

private const val MAX_AUTO_TRANSLATE_BATCH = 200
private const val DEFAULT_EDITOR_PAGE = 100
private const val MAX_EDITOR_PAGE = 500

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

    /**
     * One page of the editor for one language.
     *
     * The filter is applied in the database rather than in the browser, so a
     * project with thousands of terms sends a page instead of all of them. The
     * tab counts come from separate counting queries, because they describe the
     * whole project and must not change as the reader pages through it.
     */
    fun editor(
        projectId: UUID,
        languageCode: String,
        page: Int = 0,
        size: Int = DEFAULT_EDITOR_PAGE,
        status: String? = null,
        query: String? = null,
        featureId: UUID? = null,
    ): EditorResponse {
        val project = projects.findById(projectId)
            .orElseThrow { ProjectNotFoundException(projectId.toString()) }
        languages.findByProjectIdAndCode(projectId, languageCode)
            ?: throw LanguageNotInProjectException(languageCode)

        val statusFilter = status?.takeIf { it != "all" }?.trim().orEmpty()
        val q = query?.trim().orEmpty()
        val boundedSize = size.coerceIn(1, MAX_EDITOR_PAGE)

        val ids = terms.editorPageIds(
            projectId, languageCode, statusFilter, q, featureId,
            org.springframework.data.domain.PageRequest.of(page.coerceAtLeast(0), boundedSize),
        )
        val total = terms.editorCount(projectId, languageCode, statusFilter, q, featureId)

        val pageTerms = if (ids.isEmpty()) emptyList() else terms.findByIdIn(ids)
        val ordered = ids.mapNotNull { id -> pageTerms.firstOrNull { it.id == id } }
        val byTerm = if (ids.isEmpty()) emptyMap()
        else translations.findByTermIdInAndLanguageCode(ids, languageCode).associateBy { it.termId }

        return EditorResponse(
            languageCode = languageCode,
            sourceLang = project.sourceLang,
            rows = ordered.map { t -> editorRow(t, byTerm[t.id]) },
            page = page.coerceAtLeast(0),
            size = boundedSize,
            total = total,
            counts = countsFor(projectId, languageCode, q, featureId),
        )
    }

    private fun countsFor(
        projectId: UUID,
        languageCode: String,
        q: String,
        featureId: UUID?,
    ) = EditorCounts(
        all = terms.editorCount(projectId, languageCode, "", q, featureId),
        untranslated = terms.editorCount(projectId, languageCode, "untranslated", q, featureId),
        new = terms.editorCount(projectId, languageCode, "new", q, featureId),
        fuzzy = terms.editorCount(projectId, languageCode, "fuzzy", q, featureId),
        proofread = terms.editorCount(projectId, languageCode, "proofread", q, featureId),
    )

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
        val projTerms = terms.findByProjectIdOrderByCreatedAtDescIdAsc(projectId)
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
