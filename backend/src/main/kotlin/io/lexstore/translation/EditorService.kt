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
private val EDITOR_FILTERS = setOf("untranslated", "new", "fuzzy", "proofread")
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
    private val proofreader: io.lexstore.ai.ProofreadService,
    private val glossary: io.lexstore.glossary.GlossaryService,
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

        // An unrecognised filter would match nothing and read as an empty
        // project, so a typo is refused rather than answered with silence.
        val statusFilter = status?.trim()?.takeIf { it.isNotEmpty() && it != "all" }.orEmpty()
        require(statusFilter.isEmpty() || statusFilter in EDITOR_FILTERS) {
            "Unknown filter '$statusFilter'. Use one of: " + EDITOR_FILTERS.joinToString(", ") + "."
        }
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

        val newStatus = TranslationStatus.parse(req.status)
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
                // The text's origin flips to human only when a person changes the
                // text; confirming or re-flagging an AI draft keeps it machine-made.
                if (value != req.value) origin = "human"
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
        projects.touch(projectId, now)

        return editorRow(term, saved)
    }

    /** AI machine-translation suggestion for one term (cached). Does not save. */
    /** Review what is stored for this term and language, without changing it. */
    fun proofread(projectId: UUID, termId: UUID, languageCode: String): io.lexstore.ai.ProofreadResult {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        val project = projects.findById(projectId)
            .orElseThrow { ProjectNotFoundException(projectId.toString()) }
        languages.findByProjectIdAndCode(projectId, languageCode)
            ?: throw LanguageNotInProjectException(languageCode)
        val stored = translations.findByTermIdAndLanguageCode(termId, languageCode)?.value.orEmpty()
        return proofreader.proofread(
            projectId = projectId,
            languageCode = languageCode,
            // A plural term keeps its placeholders in the plural forms, so
            // checking the singular alone would miss {count} entirely.
            sourceText = listOfNotNull(term.sourceText, term.pluralOne, term.pluralOther)
                .distinct()
                .joinToString(" "),
            translation = stored,
            sourceLang = project.sourceLang,
            projectContext = project.translationContext,
        )
    }

    fun suggest(projectId: UUID, termId: UUID, languageCode: String): SuggestionResponse {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        val project = projects.findById(projectId)
            .orElseThrow { ProjectNotFoundException(projectId.toString()) }
        val res = ai.translate(
            TranslateRequest(
                term.sourceText,
                project.sourceLang,
                languageCode,
                projectContext = contextFor(projectId, languageCode, project.translationContext),
                projectId = projectId,
            ),
        )
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
            val result = try {
                ai.translate(
                    TranslateRequest(
                        sourceText,
                        project.sourceLang,
                        languageCode,
                        projectContext = contextFor(projectId, languageCode, project.translationContext),
                        projectId = projectId,
                    ),
                )
            } catch (ex: Exception) {
                log.warn("Auto-translate failed for term {} in {}", termId, languageCode, ex)
                failed++
                continue
            }
            self.saveMachine(projectId, termId, languageCode, result.text, result.provider, targetStatus)
            translated++
        }
        return AutoTranslateResult(
            translated = translated,
            status = targetStatus,
            failed = failed,
            remaining = (pending.size - batch.size).coerceAtLeast(0),
        )
    }

    /**
     * Draft this term into every project language that has no text yet. Each
     * language gets one machine translation, attributed to the provider and
     * marked by the organisation's review policy. Like auto-translate, each
     * save commits on its own so one failing language cannot roll back the rest.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    fun draftTerm(projectId: UUID, termId: UUID): AiDraftResult {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        val project = projects.findById(projectId)
            .orElseThrow { ProjectNotFoundException(projectId.toString()) }

        val targetStatus = if (ai.settings().autoFlagFuzzy) "fuzzy" else "translated"
        var drafted = 0
        var failed = 0
        var skipped = 0
        for (lang in languages.findByProjectIdOrderByName(projectId)) {
            val existing = translations.findByTermIdAndLanguageCode(termId, lang.code)
            if (!existing?.value.isNullOrBlank()) {
                skipped++
                continue
            }
            val result = try {
                ai.translate(
                    TranslateRequest(
                        term.sourceText,
                        project.sourceLang,
                        lang.code,
                        projectContext = contextFor(projectId, lang.code, project.translationContext),
                        projectId = projectId,
                    ),
                )
            } catch (ex: Exception) {
                log.warn("AI draft failed for term {} in {}", termId, lang.code, ex)
                failed++
                continue
            }
            self.saveMachine(projectId, termId, lang.code, result.text, result.provider, targetStatus)
            drafted++
        }
        return AiDraftResult(drafted = drafted, failed = failed, skipped = skipped, status = targetStatus)
    }

    /** A machine wrote this text: the provider is the author, and the origin says so. */
    @Transactional
    fun saveMachine(
        projectId: UUID,
        termId: UUID,
        languageCode: String,
        text: String,
        provider: String,
        status: String,
    ) {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        val newStatus = TranslationStatus.parse(status)
        val author = provider.replaceFirstChar { it.uppercase() }
        val now = Instant.now()

        val existing = translations.findByTermIdAndLanguageCode(termId, languageCode)
        val oldValue = existing?.value
        val oldStatus = existing?.status
        if (existing != null) {
            existing.apply {
                value = text
                this.status = newStatus
                updatedAt = now
                modifiedByName = author
                modifiedByAvatar = null
                origin = "ai"
            }
        } else {
            translations.save(
                Translation(
                    termId = termId,
                    languageCode = languageCode,
                    value = text,
                    status = newStatus,
                    updatedAt = now,
                    modifiedByName = author,
                    origin = "ai",
                ),
            )
        }
        events.save(
            TranslationEvent(
                projectId = projectId,
                termId = termId,
                languageCode = languageCode,
                action = actionFor(oldValue, text, newStatus),
                oldValue = oldValue,
                newValue = text,
                oldStatus = oldStatus,
                newStatus = newStatus,
                authorName = author,
                authorAvatar = 0,
                createdAt = now,
            ),
        )
        projects.touch(projectId, now)
    }

    /** Machine drafts still waiting for a person, newest first. */
    fun aiReview(projectId: UUID): List<AiReviewRow> {
        projects.findById(projectId).orElseThrow { ProjectNotFoundException(projectId.toString()) }
        val drafts = translations.findAiDraftsForReview(projectId)
        val termById = terms.findAllById(drafts.map { it.termId }.distinct()).associateBy { it.id }
        val langNames = languages.findByProjectIdOrderByName(projectId).associate { it.code to it.name }
        return drafts.mapNotNull { tr ->
            val term = termById[tr.termId] ?: return@mapNotNull null
            AiReviewRow(
                termId = tr.termId,
                key = term.key,
                source = term.sourceText,
                languageCode = tr.languageCode,
                languageName = langNames[tr.languageCode] ?: tr.languageCode,
                value = tr.value.orEmpty(),
                version = tr.version,
                provider = tr.modifiedByName ?: "AI",
                at = RelativeTime.format(tr.updatedAt),
            )
        }
    }

    /** The project's own guidance plus its glossary for this language. */
    private fun contextFor(projectId: UUID, languageCode: String, projectContext: String?): String? =
        listOfNotNull(projectContext, glossary.promptFor(projectId, languageCode))
            .joinToString(". ")
            .takeIf { it.isNotBlank() }

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
            origin = tr?.origin ?: "human",
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
