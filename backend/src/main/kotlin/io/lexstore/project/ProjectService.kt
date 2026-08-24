package io.lexstore.project

import io.lexstore.common.ProjectAccess
import io.lexstore.common.RelativeTime
import io.lexstore.common.TranslationStatus
import io.lexstore.language.LanguageRepository
import io.lexstore.term.TermRepository
import io.lexstore.translation.TranslationRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

class ProjectNotFoundException(idOrCode: String) :
    RuntimeException("No project found for '$idOrCode'.")

class DuplicateProjectCodeException(code: String) :
    RuntimeException("A project with slug '$code' already exists. Slugs must be unique.")

private const val MAX_IMAGE_CHARS = 700_000

@Service
@Transactional(readOnly = true)
class ProjectService(
    private val projects: ProjectRepository,
    private val languages: LanguageRepository,
    private val terms: TermRepository,
    private val translations: TranslationRepository,
    private val access: ProjectAccess,
    private val orgAccess: io.lexstore.org.OrgAccess,
) {
    private val log = org.slf4j.LoggerFactory.getLogger(javaClass)

    /**
     * Counts come from three grouped queries rather than loading every term and
     * translation of every project: the dashboard only shows the numbers.
     */
    fun list(): List<ProjectSummary> {
        val visible = access.visibleProjectIds()
        val termCounts = terms.countsByProject().associateBy { it.projectId }
        val trCounts = translations.countsByProject().associateBy { it.projectId }
        val langCounts = languages.countsByProject().associateBy { it.projectId }
        return projects.findAll()
            .filter { visible == null || it.id in visible }
            .map { p ->
                val t = termCounts[p.id]
                val tr = trCounts[p.id]
                val termTotal = t?.total ?: 0
                val langTotal = langCounts[p.id]?.total ?: 0
                val slots = termTotal * langTotal
                ProjectSummary(
                    id = p.id,
                    name = p.name,
                    code = p.code,
                    sourceLang = p.sourceLang,
                    mark = p.mark,
                    imageUrl = p.image?.let { "/api/projects/${'$'}{p.id}/image" },
                    terms = termTotal,
                    langs = langTotal.toInt(),
                    progress = if (slots == 0L) 0 else (((tr?.done ?: 0) * 100.0) / slots).toInt(),
                    untranslated = (slots - (tr?.filled ?: 0)).coerceAtLeast(0),
                    newTerms = t?.newTerms ?: 0,
                    needsReview = tr?.fuzzy ?: 0,
                    updated = RelativeTime.format(p.updatedAt),
                )
            }
    }

    fun get(id: UUID): Project = projects.findById(id)
        .orElseThrow { ProjectNotFoundException(id.toString()) }

    fun getByCode(code: String): Project = projects.findByCode(code)
        ?: throw ProjectNotFoundException(code)

    fun detail(id: UUID): ProjectDetail {
        val p = get(id)
        return detailOf(p)
    }

    @Transactional
    fun create(req: CreateProjectRequest): ProjectDetail {
        if (projects.existsByCode(req.code)) throw DuplicateProjectCodeException(req.code)
        val saved = projects.save(
            Project(
                orgId = orgAccess.currentOrgId(),
                name = req.name,
                code = req.code,
                sourceLang = req.sourceLang ?: "en",
                mark = req.mark ?: "#3a5bff",
                updatedLabel = null,
            ),
        )
        return detailOf(saved)
    }

    /**
     * Removes a project and everything under it.
     *
     * Terms, translations, languages, contributors, features, glossary entries
     * and API keys all reference the project with ON DELETE CASCADE, so the
     * database does the work; the AI request log keeps its rows with a null
     * project so past spend stays accountable.
     */
    @Transactional
    fun delete(id: UUID) {
        val project = get(id)
        projects.delete(project)
        log.info("Deleted project {} ({})", project.name, project.code)
    }

    @Transactional
    fun update(id: UUID, req: UpdateProjectRequest): ProjectDetail {
        val p = get(id)
        req.name?.let { p.name = it }
        req.mark?.let { p.mark = it }
        req.sourceLang?.let { p.sourceLang = it }
        req.image?.let { p.image = validatedImage(it) }
        req.translationContext?.let { p.translationContext = it.ifBlank { null } }
        return detailOf(p)
    }

    /**
     * The browser also checks this, but a client is not a boundary: an image is
     * stored as a data URI, so an unchecked one is unbounded text in a column.
     */
    private fun validatedImage(raw: String): String? {
        val value = raw.trim()
        if (value.isEmpty()) return null
        require(value.startsWith("data:image/")) { "A project image must be an image data URI." }
        require(value.length <= MAX_IMAGE_CHARS) { "That image is larger than 512 KB." }
        return value
    }

    private fun detailOf(p: Project) = ProjectDetail(
        id = p.id,
        name = p.name,
        code = p.code,
        sourceLang = p.sourceLang,
        mark = p.mark,
        image = p.image,
        translationContext = p.translationContext,
        terms = terms.countByProjectId(p.id),
    )

}
