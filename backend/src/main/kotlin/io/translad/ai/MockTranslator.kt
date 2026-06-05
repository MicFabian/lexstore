package io.translad.ai

import org.springframework.stereotype.Component

/**
 * Deterministic offline translator. Produces plausible, stable output without any
 * network call — same input always yields the same result, so the cache behaves
 * realistically in demos and tests. Real providers (Claude/DeepL) implement the
 * same [Translator] interface and can be selected via settings.
 */
@Component
class MockTranslator : Translator {
    override val provider = "mock"

    // A small phrase dictionary covering the seed strings; everything else gets a
    // language-tagged transformation so output is deterministic and readable.
    private val dict: Map<String, Map<String, String>> = mapOf(
        "Dashboard" to mapOf("fr" to "Tableau de bord", "de" to "Übersicht", "es-ES" to "Panel de control", "ja" to "ダッシュボード", "pt-BR" to "Painel", "nl" to "Dashboard", "it" to "Pannello", "ko" to "대시보드"),
        "Projects" to mapOf("fr" to "Projets", "de" to "Projekte", "es-ES" to "Proyectos", "ja" to "プロジェクト", "pt-BR" to "Projetos", "nl" to "Projecten", "it" to "Progetti", "ko" to "프로젝트"),
        "Pay now" to mapOf("fr" to "Payer maintenant", "de" to "Jetzt bezahlen", "es-ES" to "Pagar ahora", "ja" to "今すぐ支払う", "nl" to "Nu betalen", "it" to "Paga ora"),
        "Welcome back" to mapOf("fr" to "Bon retour", "de" to "Willkommen zurück", "es-ES" to "Bienvenido de nuevo", "ja" to "おかえりなさい", "nl" to "Welkom terug"),
        "Pro plan — billed annually" to mapOf("fr" to "Forfait Pro — facturé annuellement", "de" to "Pro-Tarif — jährlich abgerechnet", "es-ES" to "Plan Pro — facturado anualmente"),
        "No invoices yet" to mapOf("fr" to "Aucune facture pour le moment", "de" to "Noch keine Rechnungen", "es-ES" to "Aún no hay facturas"),
        "Invite your team" to mapOf("fr" to "Invitez votre équipe", "de" to "Laden Sie Ihr Team ein", "es-ES" to "Invita a tu equipo"),
    )

    private val greeting = mapOf(
        "fr" to "fr", "de" to "de", "es-ES" to "es", "ja" to "ja",
        "pt-BR" to "pt", "nl" to "nl", "it" to "it", "ko" to "ko",
    )

    override fun translate(input: TranslateInput): TranslateOutput {
        val exact = dict[input.sourceText]?.get(input.targetLang)
        val text = exact ?: synthesize(input)
        // Token accounting: ~1 token per 4 chars, deterministic.
        val inTok = (input.sourceText.length / 4).coerceAtLeast(1) + 24 // + prompt overhead
        val outTok = (text.length / 4).coerceAtLeast(1)
        return TranslateOutput(text = text, model = input.model, inputTokens = inTok, outputTokens = outTok)
    }

    /** Stable pseudo-translation for strings not in the dictionary. */
    private fun synthesize(input: TranslateInput): String {
        val tag = greeting[input.targetLang] ?: input.targetLang
        val formalitySuffix = when (input.formality) {
            "formal" -> "" // formal is the default tone
            "informal" -> ""
            else -> ""
        }
        return "[$tag] ${input.sourceText}$formalitySuffix"
    }
}
