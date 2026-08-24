package io.lexstore.language

import io.lexstore.common.TranslationStatus
import io.lexstore.contributor.ContributorRepository
import io.lexstore.term.TermRepository
import io.lexstore.translation.TranslationRepository
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
    private val projects: io.lexstore.project.ProjectRepository,
) {
    private val log = org.slf4j.LoggerFactory.getLogger(javaClass)

    fun list(projectId: UUID): List<LanguageView> {
        requireProject(projectId)
        val langs = languages.findByProjectIdOrderByName(projectId)
        val termCount = terms.countByProjectId(projectId).toInt()
        val byLang = translations.statusCountsByLanguage(projectId).associateBy { it.languageCode }
        val contribByLang = contributors.findByProjectIdOrderByName(projectId)
            .flatMap { c -> c.languageList.map { it to c } }
            .groupBy({ it.first }, { it.second })

        return langs.map { l ->
            val counts = byLang[l.code]
            fun pct(n: Int) = if (termCount == 0) 0 else ((n * 100.0) / termCount).toInt()
            val translated = (counts?.translated ?: 0).toInt()
            val fuzzy = (counts?.fuzzy ?: 0).toInt()
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
    /**
     * Removing a language removes its translations with it.
     *
     * They referenced the language by code, not by row, so they survived the
     * delete and reappeared if the same code was added again — someone
     * resetting a language got their old values back without asking.
     */
    fun remove(projectId: UUID, code: String) {
        languages.findByProjectIdAndCode(projectId, code)?.let {
            val removed = translations.deleteByProjectAndLanguage(projectId, code)
            languages.delete(it)
            if (removed > 0) log.info("Removed {} translations along with language {}", removed, code)
        }
    }

    /**
     * A missing project is a not-found, not an empty one: answering with an
     * empty list makes a wrong id in a URL look like real, empty data.
     */
    private fun requireProject(projectId: UUID) {
        if (!projects.existsById(projectId)) {
            throw io.lexstore.project.ProjectNotFoundException(projectId.toString())
        }
    }
}
