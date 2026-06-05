package io.translad.project

import io.translad.common.TranslationStatus
import io.translad.language.LanguageRepository
import io.translad.term.TermRepository
import io.translad.translation.TranslationRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

class ProjectNotFoundException(idOrCode: String) :
    RuntimeException("No project found for '$idOrCode'.")

class DuplicateProjectCodeException(code: String) :
    RuntimeException("A project with slug '$code' already exists. Slugs must be unique.")

@Service
@Transactional(readOnly = true)
class ProjectService(
    private val projects: ProjectRepository,
    private val languages: LanguageRepository,
    private val terms: TermRepository,
    private val translations: TranslationRepository,
) {
    fun list(): List<ProjectSummary> = projects.findAll().map { summarize(it) }

    fun get(id: UUID): Project = projects.findById(id)
        .orElseThrow { ProjectNotFoundException(id.toString()) }

    fun getByCode(code: String): Project = projects.findByCode(code)
        ?: throw ProjectNotFoundException(code)

    fun detail(id: UUID): ProjectDetail {
        val p = get(id)
        return ProjectDetail(p.id, p.name, p.code, p.sourceLang, p.mark, terms.countByProjectId(p.id))
    }

    @Transactional
    fun create(req: CreateProjectRequest): ProjectDetail {
        if (projects.existsByCode(req.code)) throw DuplicateProjectCodeException(req.code)
        val saved = projects.save(
            Project(
                name = req.name,
                code = req.code,
                sourceLang = req.sourceLang ?: "en",
                mark = req.mark ?: "#3a5bff",
                updatedLabel = "just now",
            ),
        )
        return ProjectDetail(saved.id, saved.name, saved.code, saved.sourceLang, saved.mark, 0)
    }

    @Transactional
    fun update(id: UUID, req: UpdateProjectRequest): ProjectDetail {
        val p = get(id)
        req.name?.let { p.name = it }
        req.mark?.let { p.mark = it }
        req.sourceLang?.let { p.sourceLang = it }
        return ProjectDetail(p.id, p.name, p.code, p.sourceLang, p.mark, terms.countByProjectId(p.id))
    }

    private fun summarize(p: Project): ProjectSummary {
        val projTerms = terms.findByProjectIdOrderByCreatedAtDesc(p.id)
        val langs = languages.findByProjectIdOrderByName(p.id)
        val termIds = projTerms.map { it.id }
        val allTr = if (termIds.isEmpty()) emptyList() else translations.findByTermIdIn(termIds)

        val totalSlots = projTerms.size.toLong() * langs.size
        val translatedSlots = allTr.count {
            it.status == TranslationStatus.TRANSLATED ||
                it.status == TranslationStatus.PROOFREAD
        }
        val progress = if (totalSlots == 0L) 0 else ((translatedSlots * 100.0) / totalSlots).toInt()
        val untranslated = totalSlots - allTr.count {
            it.status != TranslationStatus.UNTRANSLATED && it.value != null
        }
        val newTerms = projTerms.count { it.isNew }.toLong()

        return ProjectSummary(
            id = p.id,
            name = p.name,
            code = p.code,
            sourceLang = p.sourceLang,
            mark = p.mark,
            terms = projTerms.size.toLong(),
            langs = langs.size,
            progress = progress,
            untranslated = untranslated.coerceAtLeast(0),
            newTerms = newTerms,
            updated = p.updatedLabel,
        )
    }
}
