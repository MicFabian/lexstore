package io.lexstore.glossary

import io.lexstore.ai.ProofreadIssue
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

class GlossaryEntryNotFoundException(id: UUID) : RuntimeException("No glossary entry with id $id.")

class DuplicateGlossaryTermException(term: String) :
    RuntimeException("\"$term\" already has a rule for that language. Remove it first, or edit that one.")

private const val MAX_PROMPT_TERMS = 40

@Service
@Transactional(readOnly = true)
class GlossaryService(private val entries: GlossaryRepository) {

    fun list(projectId: UUID): List<GlossaryEntryView> =
        entries.findByProjectIdOrderByTerm(projectId).map(::toView)

    @Transactional
    fun add(projectId: UUID, req: SaveGlossaryEntryRequest): GlossaryEntryView {
        require(req.doNotTranslate || !req.translation.isNullOrBlank()) {
            "Give the translation to use, or mark the term as do-not-translate."
        }
        val language = req.languageCode?.trim()?.takeIf { it.isNotBlank() }
        val clash = entries.findByProjectIdAndTermIgnoreCase(projectId, req.term.trim())
            .any { it.languageCode.equals(language, ignoreCase = true) }
        if (clash) throw DuplicateGlossaryTermException(req.term.trim())

        val saved = entries.save(
            GlossaryEntry(
                projectId = projectId,
                term = req.term.trim(),
                languageCode = language,
                translation = req.translation?.trim()?.takeIf { it.isNotBlank() },
                doNotTranslate = req.doNotTranslate,
                note = req.note?.trim()?.takeIf { it.isNotBlank() },
            ),
        )
        return toView(saved)
    }

    @Transactional
    fun delete(projectId: UUID, id: UUID) {
        val entry = entries.findById(id).orElseThrow { GlossaryEntryNotFoundException(id) }
        require(entry.projectId == projectId) { "That glossary entry belongs to another project." }
        entries.delete(entry)
    }

    /**
     * The glossary as prompt text for one language, so the model is told the
     * rules rather than being expected to guess them. Capped, because a long
     * glossary would otherwise crowd out the string being translated.
     */
    fun promptFor(projectId: UUID, languageCode: String?): String? {
        val relevant = entries.findByProjectIdOrderByTerm(projectId)
            .filter { it.languageCode == null || it.languageCode.equals(languageCode, ignoreCase = true) }
            .take(MAX_PROMPT_TERMS)
        if (relevant.isEmpty()) return null
        return relevant.joinToString("; ") { e ->
            when {
                e.doNotTranslate -> "leave \"${e.term}\" untranslated"
                else -> "translate \"${e.term}\" as \"${e.translation}\""
            }
        }
    }

    /**
     * Glossary violations found by comparing text, not by asking a model: a
     * term marked do-not-translate must appear verbatim, and a term with a
     * required translation must use it.
     */
    fun issues(projectId: UUID, languageCode: String, sourceText: String, translation: String): List<ProofreadIssue> {
        if (translation.isBlank()) return emptyList()
        return entries.findByProjectIdOrderByTerm(projectId)
            .filter { it.languageCode == null || it.languageCode.equals(languageCode, ignoreCase = true) }
            .filter { sourceText.contains(it.term, ignoreCase = true) }
            .mapNotNull { e ->
                when {
                    e.doNotTranslate && !translation.contains(e.term, ignoreCase = true) ->
                        ProofreadIssue(
                            "terminology",
                            "major",
                            "\"${e.term}\" must stay untranslated, but it does not appear in the translation.",
                        )
                    !e.doNotTranslate && e.translation != null &&
                        !translation.contains(e.translation!!, ignoreCase = true) ->
                        ProofreadIssue(
                            "terminology",
                            "major",
                            "The glossary requires \"${e.term}\" to be translated as \"${e.translation}\".",
                        )
                    else -> null
                }
            }
    }

    private fun toView(e: GlossaryEntry) =
        GlossaryEntryView(e.id, e.term, e.languageCode, e.translation, e.doNotTranslate, e.note)
}
