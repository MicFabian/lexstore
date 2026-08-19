package io.translad.feature

import io.translad.common.TranslationStatus
import io.translad.language.LanguageRepository
import io.translad.project.ProjectNotFoundException
import io.translad.project.ProjectRepository
import io.translad.term.Term
import io.translad.term.TermRepository
import io.translad.translation.Translation
import io.translad.translation.TranslationRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
@Transactional(readOnly = true)
class FeatureService(
    private val features: FeatureRepository,
    private val projects: ProjectRepository,
    private val languages: LanguageRepository,
    private val terms: TermRepository,
    private val translations: TranslationRepository,
) {
    fun list(projectId: UUID): List<FeatureView> {
        requireProject(projectId)
        val langs = languages.findByProjectIdOrderByName(projectId)
        return features.findByProjectIdOrderByName(projectId).map { coverage(it, langs) }
    }

    fun detail(projectId: UUID, featureId: UUID): FeatureView {
        val feature = owned(projectId, featureId)
        return coverage(feature, languages.findByProjectIdOrderByName(projectId))
    }

    /**
     * Every translation slot of this feature that still needs work: missing,
     * empty, or flagged for review. One row per term and language.
     */
    fun openTranslations(projectId: UUID, featureId: UUID, languageCode: String?): List<OpenTranslationView> {
        owned(projectId, featureId)
        val langs = languages.findByProjectIdOrderByName(projectId)
            .filter { languageCode == null || it.code == languageCode }
        val featureTerms = terms.findByFeatureId(featureId)
        if (featureTerms.isEmpty() || langs.isEmpty()) return emptyList()

        val byTerm = translationsByTerm(featureTerms)
        return featureTerms.flatMap { term ->
            langs.mapNotNull { lang ->
                val tr = byTerm[term.id]?.get(lang.code)
                val status = tr?.status ?: TranslationStatus.UNTRANSLATED
                val done = tr?.value?.isNotBlank() == true &&
                    (status == TranslationStatus.TRANSLATED || status == TranslationStatus.PROOFREAD)
                if (done) null
                else OpenTranslationView(
                    termId = term.id,
                    key = term.key,
                    sourceText = term.sourceText,
                    languageCode = lang.code,
                    languageName = lang.name,
                    status = status.name.lowercase(),
                    value = tr?.value,
                )
            }
        }
    }

    @Transactional
    fun create(projectId: UUID, req: CreateFeatureRequest): FeatureView {
        requireProject(projectId)
        val key = req.key?.takeIf { it.isNotBlank() } ?: slugFor(projectId, req.name)
        if (features.existsByProjectIdAndKey(projectId, key)) throw DuplicateFeatureKeyException(key)
        val saved = features.save(
            Feature(
                projectId = projectId,
                name = req.name,
                key = key,
                description = req.description?.ifBlank { null },
            ),
        )
        return coverage(saved, languages.findByProjectIdOrderByName(projectId))
    }

    @Transactional
    fun update(projectId: UUID, featureId: UUID, req: UpdateFeatureRequest): FeatureView {
        val feature = owned(projectId, featureId)
        req.name?.takeIf { it.isNotBlank() }?.let { feature.name = it }
        req.description?.let { feature.description = it.ifBlank { null } }
        features.save(feature)
        return coverage(feature, languages.findByProjectIdOrderByName(projectId))
    }

    @Transactional
    fun delete(projectId: UUID, featureId: UUID) {
        val feature = owned(projectId, featureId)
        // Terms outlive their feature; they simply become unassigned.
        terms.findByFeatureId(featureId).forEach { it.featureId = null }
        features.delete(feature)
    }

    /** Put the given terms into this feature. */
    @Transactional
    fun assign(projectId: UUID, featureId: UUID, req: AssignTermsRequest): FeatureView {
        val feature = owned(projectId, featureId)
        assignTo(projectId, req.termIds, featureId)
        return coverage(feature, languages.findByProjectIdOrderByName(projectId))
    }

    /** Take the given terms out of any feature. */
    @Transactional
    fun unassign(projectId: UUID, req: AssignTermsRequest) {
        requireProject(projectId)
        assignTo(projectId, req.termIds, null)
    }

    private fun assignTo(projectId: UUID, termIds: List<UUID>, featureId: UUID?) {
        terms.findAllById(termIds)
            .filter { it.projectId == projectId }
            .forEach { it.featureId = featureId }
    }

    // ---------------- coverage ----------------

    private fun coverage(feature: Feature, langs: List<io.translad.language.Language>): FeatureView {
        val featureTerms = terms.findByFeatureId(feature.id)
        val byTerm = translationsByTerm(featureTerms)

        val perLanguage = langs.map { lang ->
            var translated = 0
            var fuzzy = 0
            for (term in featureTerms) {
                val tr = byTerm[term.id]?.get(lang.code)
                val hasValue = tr?.value?.isNotBlank() == true
                when {
                    hasValue && tr!!.status == TranslationStatus.FUZZY -> fuzzy++
                    hasValue && tr!!.status != TranslationStatus.UNTRANSLATED -> translated++
                }
            }
            val untranslated = featureTerms.size - translated - fuzzy
            FeatureLanguageCoverage(
                code = lang.code,
                name = lang.name,
                translated = translated,
                fuzzy = fuzzy,
                untranslated = untranslated,
                percent = percent(translated, featureTerms.size),
            )
        }

        val translated = perLanguage.sumOf { it.translated }
        val fuzzy = perLanguage.sumOf { it.fuzzy }
        val slots = featureTerms.size * langs.size
        return FeatureView(
            id = feature.id,
            name = feature.name,
            key = feature.key,
            description = feature.description,
            terms = featureTerms.size.toLong(),
            translated = translated,
            fuzzy = fuzzy,
            untranslated = slots - translated - fuzzy,
            percent = percent(translated, slots),
            languages = perLanguage,
        )
    }

    private fun translationsByTerm(featureTerms: List<Term>): Map<UUID, Map<String, Translation>> {
        if (featureTerms.isEmpty()) return emptyMap()
        return translations.findByTermIdIn(featureTerms.map { it.id })
            .groupBy { it.termId }
            .mapValues { (_, list) -> list.associateBy { it.languageCode } }
    }

    private fun percent(done: Int, total: Int): Int =
        if (total == 0) 0 else ((done * 100.0) / total).toInt()

    // ---------------- helpers ----------------

    private fun requireProject(projectId: UUID) {
        if (!projects.existsById(projectId)) throw ProjectNotFoundException(projectId.toString())
    }

    private fun owned(projectId: UUID, featureId: UUID): Feature =
        features.findById(featureId)
            .filter { it.projectId == projectId }
            .orElseThrow { FeatureNotFoundException(featureId.toString()) }

    private fun slugFor(projectId: UUID, name: String): String {
        val base = name.lowercase()
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
            .ifBlank { "feature" }
        if (!features.existsByProjectIdAndKey(projectId, base)) return base
        var n = 2
        while (features.existsByProjectIdAndKey(projectId, "$base-$n")) n++
        return "$base-$n"
    }
}

class FeatureNotFoundException(id: String) : RuntimeException("Feature '$id' is not in this project.")

class DuplicateFeatureKeyException(key: String) : RuntimeException("A feature with key '$key' already exists.")
