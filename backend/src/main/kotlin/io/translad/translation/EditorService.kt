package io.translad.translation

import io.translad.common.TranslationStatus
import io.translad.language.LanguageRepository
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
            EditorRow(
                id = t.id,
                key = t.key,
                ctx = t.ctx,
                source = t.sourceText,
                plural = if (t.isPlural) PluralForms(t.pluralOne, t.pluralOther) else null,
                tags = t.tagList,
                isNew = t.isNew,
                target = tr?.value,
                status = (tr?.status?.name ?: "UNTRANSLATED").lowercase(),
                comments = commentsByTerm[t.id].orEmpty(),
            )
        }
        return EditorResponse(languageCode, project.sourceLang, rows)
    }

    @Transactional
    fun save(projectId: UUID, termId: UUID, languageCode: String, req: SaveTranslationRequest): EditorRow {
        val term = terms.findById(termId).orElseThrow { TermNotFoundException(termId.toString()) }
        require(term.projectId == projectId) { "Term does not belong to this project." }
        languages.findByProjectIdAndCode(projectId, languageCode)
            ?: throw LanguageNotInProjectException(languageCode)

        val status = TranslationStatus.from(req.status)
        val existing = translations.findByTermIdAndLanguageCode(termId, languageCode)
        val saved = if (existing != null) {
            existing.value = req.value
            existing.pluralOne = req.pluralOne
            existing.status = status
            existing.updatedAt = Instant.now()
            existing
        } else {
            translations.save(
                Translation(
                    termId = termId,
                    languageCode = languageCode,
                    value = req.value,
                    pluralOne = req.pluralOne,
                    status = status,
                ),
            )
        }
        // Saving a real value clears the "new" flag on the source term.
        if (!req.value.isNullOrBlank()) term.isNew = false

        return EditorRow(
            id = term.id,
            key = term.key,
            ctx = term.ctx,
            source = term.sourceText,
            plural = if (term.isPlural) PluralForms(term.pluralOne, term.pluralOther) else null,
            tags = term.tagList,
            isNew = term.isNew,
            target = saved.value,
            status = saved.status.name.lowercase(),
            comments = comments.findByTermIdOrderByCreatedAt(termId)
                .map { CommentView(it.id, it.authorName, it.authorAvatar, it.text, it.timeLabel) },
        )
    }
}
