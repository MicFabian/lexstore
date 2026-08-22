package io.lexstore.term

import io.lexstore.common.CurrentUser
import io.lexstore.common.RelativeTime
import io.lexstore.language.Language
import io.lexstore.language.LanguageRepository
import io.lexstore.translation.Translation
import io.lexstore.translation.TranslationRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

class TermNotFoundException(id: String) : RuntimeException("No term found for '$id'.")

class DuplicateTermKeyException(key: String) :
    RuntimeException("That key already exists in this project. Keys must be unique.")

private const val MAX_TERM_HISTORY = 20

@Service
@Transactional(readOnly = true)
class TermService(
    private val terms: TermRepository,
    private val translations: TranslationRepository,
    private val languages: LanguageRepository,
    private val comments: TermCommentRepository,
    private val events: io.lexstore.translation.TranslationEventRepository,
    private val currentUser: CurrentUser,
) {
    fun list(projectId: UUID): List<TermView> =
        assemble(projectId, terms.findByProjectIdOrderByCreatedAtDescIdAsc(projectId))

    /** Page-limited variant — only the requested slice of terms is hydrated. */
    fun listPaged(projectId: UUID, page: Int, size: Int): Page<TermView> {
        val total = terms.countByProjectId(projectId)
        val slice = terms.findByProjectIdOrderByCreatedAtDescIdAsc(projectId, PageRequest.of(page, size))
        return Page(assemble(projectId, slice), page, size, total)
    }

    fun get(projectId: UUID, termId: UUID): TermView {
        val term = owned(projectId, termId)
        val langs = languages.findByProjectIdOrderByName(projectId)
        return toView(term, langs, translations.findByTermId(termId))
    }

    @Transactional
    fun create(projectId: UUID, req: CreateTermRequest): TermView {
        if (terms.existsByProjectIdAndKey(projectId, req.key)) throw DuplicateTermKeyException(req.key)
        val saved = terms.save(
            Term(
                projectId = projectId,
                key = req.key,
                ctx = req.ctx ?: "",
                sourceText = req.source,
                pluralOne = req.pluralOne,
                pluralOther = req.pluralOther,
                tags = req.tags?.joinToString(",") ?: "",
                isNew = true,
                addedLabel = "Today",
                createdByName = currentUser.identity().name,
                createdByAvatar = currentUser.identity().avatar,
            ),
        )
        return toView(saved, languages.findByProjectIdOrderByName(projectId), emptyList())
    }

    @Transactional
    fun update(projectId: UUID, termId: UUID, req: UpdateTermRequest): TermView {
        val term = owned(projectId, termId)
        req.source?.let { term.sourceText = it }
        req.ctx?.let { term.ctx = it }
        req.tags?.let { term.tags = it.joinToString(",") }
        return toView(term, languages.findByProjectIdOrderByName(projectId), translations.findByTermId(termId))
    }

    @Transactional
    fun delete(projectId: UUID, termId: UUID) {
        val term = terms.findById(termId).orElse(null) ?: return
        require(term.projectId == projectId) { "Term does not belong to this project." }
        // Translations, comments, and events cascade at the database level.
        terms.delete(term)
    }

    fun listComments(projectId: UUID, termId: UUID): List<CommentView> {
        owned(projectId, termId)
        return comments.findByTermIdOrderByCreatedAt(termId).map(TermComment::toView)
    }

    @Transactional
    fun addComment(projectId: UUID, termId: UUID, req: AddCommentRequest): CommentView {
        owned(projectId, termId)
        val me = currentUser.identity()
        return comments.save(
            TermComment(
                termId = termId,
                authorName = me.name,
                authorAvatar = me.avatar,
                text = req.text,
            ),
        ).toView()
    }

    @Transactional
    fun deleteComment(projectId: UUID, termId: UUID, commentId: UUID) {
        owned(projectId, termId)
        comments.findById(commentId).ifPresent {
            if (it.termId == termId) comments.delete(it)
        }
    }

    private fun owned(projectId: UUID, termId: UUID): Term {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        return term
    }

    private fun assemble(projectId: UUID, projTerms: List<Term>): List<TermView> {
        if (projTerms.isEmpty()) return emptyList()
        val langs = languages.findByProjectIdOrderByName(projectId)
        val trByTerm = translations.findByTermIdIn(projTerms.map { it.id }).groupBy { it.termId }
        val cmtByTerm = comments.findByTermIdInOrderByCreatedAt(projTerms.map { it.id })
            .groupBy({ it.termId }, { it.toView() })
        val evByTerm = events.findByTermIdInOrderByCreatedAtDesc(projTerms.map { it.id })
            .groupBy({ it.termId }) {
                AuditEntry(
                    it.authorName,
                    it.authorAvatar,
                    "${it.action} ${it.languageCode}",
                    RelativeTime.format(it.createdAt),
                )
            }
        return projTerms.map {
            toView(
                it,
                langs,
                trByTerm[it.id].orEmpty(),
                cmtByTerm[it.id].orEmpty(),
                evByTerm[it.id].orEmpty().take(MAX_TERM_HISTORY),
            )
        }
    }

    private fun toView(
        term: Term,
        langs: List<Language>,
        tr: List<Translation>,
        preloadedComments: List<CommentView>? = null,
        preloadedEvents: List<AuditEntry>? = null,
    ): TermView {
        val byCode = tr.associateBy { it.languageCode }
        val trViews = langs.map { l ->
            val t = byCode[l.code]
            TermTranslationView(
                code = l.code,
                name = l.name,
                value = t?.value,
                status = (t?.status?.name ?: "UNTRANSLATED").lowercase(),
                modifiedBy = t?.modifiedByName?.let {
                    AuditEntry(it, t.modifiedByAvatar ?: 0, "edited", RelativeTime.format(t.updatedAt))
                },
            )
        }
        val cmts = preloadedComments ?: comments.findByTermIdOrderByCreatedAt(term.id).map(TermComment::toView)
        // Real events only: an invented author reads as fact to whoever opens the term.
        val history = buildList {
            preloadedEvents?.let { addAll(it) }
                ?: events.findByTermIdOrderByCreatedAtDesc(
                    term.id,
                    org.springframework.data.domain.PageRequest.of(0, MAX_TERM_HISTORY),
                ).forEach {
                    add(AuditEntry(it.authorName, it.authorAvatar, "${it.action} ${it.languageCode}", RelativeTime.format(it.createdAt)))
                }
            cmts.lastOrNull()?.let { add(AuditEntry(it.authorName, it.authorAvatar, "commented", it.time)) }
            term.createdByName?.let {
                add(AuditEntry(it, term.createdByAvatar ?: 0, "created the term", term.addedLabel))
            }
        }
        return TermView(
            id = term.id,
            key = term.key,
            ctx = term.ctx,
            source = term.sourceText,
            plural = if (term.isPlural) PluralForms(term.pluralOne, term.pluralOther) else null,
            tags = term.tagList,
            isNew = term.isNew,
            added = term.addedLabel,
            createdAt = term.addedLabel,
            createdBy = term.createdByName?.let {
                AuditEntry(it, term.createdByAvatar ?: 0, "created the term", term.addedLabel)
            },
            modifiedAt = cmts.lastOrNull()?.time ?: term.addedLabel,
            modifiedBy = history.firstOrNull(),
            translations = trViews,
            comments = cmts,
            history = history,
        )
    }
}
