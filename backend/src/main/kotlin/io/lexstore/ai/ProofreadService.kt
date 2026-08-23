package io.lexstore.ai

import io.lexstore.glossary.GlossaryService
import io.lexstore.org.CredentialResolver
import io.lexstore.org.CredentialSource
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * Reviews a translation that already exists.
 *
 * Two kinds of check run together. Placeholders and glossary terms are decided
 * in code, because they are exact and a model can be wrong about them. Meaning,
 * grammar and tone go to the model, which is what it is good for. Both sets of
 * findings come back as one list so the reader does not have to know which was
 * which.
 */
@Service
class ProofreadService(
    private val settingsSource: AiTranslationService,
    private val glossary: GlossaryService,
    private val credentials: CredentialResolver,
    private val claude: ClaudeTranslator,
    private val gemini: GeminiTranslator,
    private val openai: OpenAiTranslator,
    private val mapper: ObjectMapper,
) {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun proofread(
        projectId: UUID,
        languageCode: String,
        sourceText: String,
        translation: String,
        sourceLang: String,
        projectContext: String?,
    ): ProofreadResult {
        val mechanical = PlaceholderCheck.issues(sourceText, translation) +
            glossary.issues(projectId, languageCode, sourceText, translation)

        if (translation.isBlank()) {
            return ProofreadResult(
                verdict = "wrong",
                issues = listOf(ProofreadIssue("meaning", "major", "There is no translation to review.")),
                suggestion = null,
                provider = "none",
                model = "none",
            )
        }

        val settings = settingsSource.settings()
        val resolved = credentials.resolve(projectId, settings.provider)
        val reviewer: Translator? = if (resolved == null) null else when (settings.provider) {
            "claude" -> claude
            "gemini" -> gemini
            "openai" -> openai
            else -> null
        }

        // Without a usable provider the mechanical checks still stand on their
        // own; reporting them as a model's opinion would misstate where they
        // came from.
        if (reviewer == null || resolved == null) {
            return ProofreadResult(
                verdict = if (mechanical.any { it.severity == "major" }) "needs_work" else "good",
                issues = mechanical,
                suggestion = null,
                provider = "checks-only",
                model = "none",
            )
        }

        val context = listOfNotNull(projectContext, glossary.promptFor(projectId, languageCode))
            .joinToString(". ")
            .takeIf { it.isNotBlank() }

        val out = reviewer.translate(
            TranslateInput(
                sourceText = ProofreadPrompt.user(sourceText, translation),
                sourceLang = sourceLang,
                targetLang = languageCode,
                model = settings.model,
                temperature = 0.0,
                projectContext = ProofreadPrompt.system(sourceLang, languageCode, context),
                apiKey = resolved.apiKey,
            ),
        )
        if (resolved.source == CredentialSource.PLATFORM_AGENT) {
            resolved.orgId?.let { credentials.chargeAgentUse(it) }
        }

        val parsed = ProofreadParser.parse(out.text, mapper)
        val modelIssues = parsed?.path("issues")?.mapNotNull { node ->
            val message = node.path("message").asText("").trim()
            if (message.isBlank()) null
            else ProofreadIssue(
                kind = node.path("kind").asText("meaning"),
                severity = node.path("severity").asText("minor"),
                message = message,
            )
        }.orEmpty()

        val all = mechanical + modelIssues
        val verdict = when {
            all.any { it.severity == "major" } -> "needs_work"
            all.isNotEmpty() -> "needs_work"
            else -> parsed?.path("verdict")?.asText("good") ?: "good"
        }
        val suggestion = parsed?.path("suggestion")?.takeIf { !it.isNull }?.asText()?.trim()
            ?.takeIf { it.isNotBlank() && it != translation }

        return ProofreadResult(verdict, all, suggestion, reviewer.provider, out.model)
    }
}
