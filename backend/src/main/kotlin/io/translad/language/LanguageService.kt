package io.translad.language

import io.translad.common.TranslationStatus
import io.translad.contributor.ContributorRepository
import io.translad.term.TermRepository
import io.translad.translation.TranslationRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

class DuplicateLanguageException(code: String) :
    RuntimeException("Language '$code' is already in this project.")

@Service
@Transactional(readOnly = true)
class LanguageService(
    private val languages: LanguageRepository,
    private val terms: TermRepository,
    private val translations: TranslationRepository,
    private val contributors: ContributorRepository,
) {
    fun list(projectId: UUID): List<LanguageView> {
        val langs = languages.findByProjectIdOrderByName(projectId)
        val termIds = terms.findByProjectIdOrderByCreatedAtDesc(projectId).map { it.id }
        val termCount = termIds.size
        val byLang = if (termIds.isEmpty()) emptyMap()
        else translations.findByTermIdIn(termIds).groupBy { it.languageCode }
        val contribByLang = contributors.findByProjectIdOrderByName(projectId)
            .flatMap { c -> c.languageList.map { it to c } }
            .groupBy({ it.first }, { it.second })

        return langs.map { l ->
            val tr = byLang[l.code].orEmpty()
            fun pct(n: Int) = if (termCount == 0) 0 else ((n * 100.0) / termCount).toInt()
            val translated = tr.count {
                it.status == TranslationStatus.TRANSLATED || it.status == TranslationStatus.PROOFREAD
            }
            val fuzzy = tr.count { it.status == TranslationStatus.FUZZY }
            val translatedPct = pct(translated)
            val fuzzyPct = pct(fuzzy)
            LanguageView(
                id = l.id,
                code = l.code,
                name = l.name,
                translated = translatedPct,
                fuzzy = fuzzyPct,
                untranslated = (100 - translatedPct - fuzzyPct).coerceAtLeast(0),
                contributors = contribByLang[l.code]?.size ?: 0,
            )
        }
    }

    @Transactional
    fun add(projectId: UUID, req: AddLanguageRequest): LanguageView {
        if (languages.existsByProjectIdAndCode(projectId, req.code)) {
            throw DuplicateLanguageException(req.code)
        }
        val saved = languages.save(Language(projectId = projectId, code = req.code, name = req.name))
        return LanguageView(saved.id, saved.code, saved.name, 0, 0, 100, 0)
    }

    @Transactional
    fun remove(projectId: UUID, code: String) {
        languages.findByProjectIdAndCode(projectId, code)?.let { languages.delete(it) }
    }
}
