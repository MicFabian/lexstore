package io.translad.term

import io.translad.language.LanguageRepository
import io.translad.translation.Translation
import io.translad.translation.TranslationRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

class TermNotFoundException(id: String) : RuntimeException("No term found for '$id'.")

class DuplicateTermKeyException(key: String) :
    RuntimeException("That key already exists in this project. Keys must be unique.")

@Service
@Transactional(readOnly = true)
class TermService(
    private val terms: TermRepository,
    private val translations: TranslationRepository,
    private val languages: LanguageRepository,
    private val comments: io.translad.term.TermCommentRepository,
    private val currentUser: io.translad.common.CurrentUser,
) {
    fun list(projectId: UUID): List<TermView> {
        val projTerms = terms.findByProjectIdOrderByCreatedAtDesc(projectId)
        return assemble(projectId, projTerms)
    }

    /** Page-limited variant — only the requested slice of terms is hydrated. */
    fun listPaged(projectId: UUID, page: Int, size: Int): Page<TermView> {
        val total = terms.countByProjectId(projectId)
        val slice = terms.findByProjectIdOrderByCreatedAtDesc(
            projectId,
            org.springframework.data.domain.PageRequest.of(page, size),
        )
        return Page(assemble(projectId, slice), page, size, total)
    }

    private fun assemble(projectId: UUID, projTerms: List<Term>): List<TermView> {
        if (projTerms.isEmpty()) return emptyList()
        val langs = languages.findByProjectIdOrderByName(projectId)
        val trByTerm = translations.findByTermIdIn(projTerms.map { it.id }).groupBy { it.termId }
        return projTerms.map { toView(it, langs, trByTerm[it.id].orEmpty()) }
    }

    fun get(projectId: UUID, termId: UUID): TermView {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
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
            ),
        )
        val langs = languages.findByProjectIdOrderByName(projectId)
        return toView(saved, langs, emptyList())
    }

    @Transactional
    fun update(projectId: UUID, termId: UUID, req: UpdateTermRequest): TermView {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        req.source?.let { term.sourceText = it }
        req.ctx?.let { term.ctx = it }
        req.tags?.let { term.tags = it.joinToString(",") }
        val langs = languages.findByProjectIdOrderByName(projectId)
        return toView(term, langs, translations.findByTermId(termId))
    }

    @Transactional
    fun delete(projectId: UUID, termId: UUID) {
        val term = terms.findById(termId).orElse(null) ?: return
        require(term.projectId == projectId) { "Term does not belong to this project." }
        translations.findByTermId(termId).forEach { translations.delete(it) }
        terms.delete(term)
    }

    fun listComments(projectId: UUID, termId: UUID): List<CommentView> {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        return comments.findByTermIdOrderByCreatedAt(termId)
            .map { CommentView(it.id, it.authorName, it.authorAvatar, it.text, it.timeLabel) }
    }

    @Transactional
    fun addComment(projectId: UUID, termId: UUID, req: AddCommentRequest): CommentView {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        val me = currentUser.identity()
        val saved = comments.save(
            TermComment(
                termId = termId,
                authorName = me.name,
                authorAvatar = me.avatar,
                text = req.text,
                timeLabel = "just now",
            ),
        )
        return CommentView(saved.id, saved.authorName, saved.authorAvatar, saved.text, saved.timeLabel)
    }

    @Transactional
    fun deleteComment(projectId: UUID, termId: UUID, commentId: UUID) {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        comments.findById(commentId).ifPresent {
            if (it.termId == termId) comments.delete(it)
        }
    }

    private fun toView(
        term: Term,
        langs: List<io.translad.language.Language>,
        tr: List<Translation>,
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
                    AuditEntry(it, t.modifiedByAvatar ?: 0, "edited", relativeTime(t.updatedAt))
                },
            )
        }
        val cmts = comments.findByTermIdOrderByCreatedAt(term.id).map {
            CommentView(it.id, it.authorName, it.authorAvatar, it.text, it.timeLabel)
        }
        val creator = AuditEntry("Marcus Hale", 6, "created the term", term.addedLabel)
        val history = buildList {
            add(AuditEntry("Amélie Rousseau", 0, "edited the translation", term.addedLabel))
            cmts.lastOrNull()?.let { add(AuditEntry(it.authorName, it.authorAvatar, "commented", it.time)) }
            add(creator)
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
            createdBy = creator,
            modifiedAt = cmts.lastOrNull()?.time ?: term.addedLabel,
            modifiedBy = history.firstOrNull(),
            translations = trViews,
            comments = cmts,
            history = history,
        )
    }

    private fun relativeTime(at: Instant): String {
        val d = java.time.Duration.between(at, Instant.now())
        return when {
            d.toMinutes() < 1 -> "just now"
            d.toMinutes() < 60 -> "${d.toMinutes()}m ago"
            d.toHours() < 24 -> "${d.toHours()}h ago"
            d.toDays() < 7 -> "${d.toDays()}d ago"
            else -> ISO.format(at)
        }
    }

    companion object {
        private val ISO: java.time.format.DateTimeFormatter =
            java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy").withZone(java.time.ZoneOffset.UTC)
    }
}
