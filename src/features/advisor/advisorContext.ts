import type { AtsCheckResult, JobOffer, MasterVault } from '../../types';
import { buildAtsTelemetryReport } from '../../lib/atsScorer';
import { measureVaultCompleteness, VAULT_SECTIONS } from '../../lib/vaultCompleteness';

export type AdvisorSuggestionTarget = 'profil' | 'aplikuj' | 'ats-lab';

export interface AdvisorSuggestion {
  id: string;
  label: string;
  description: string;
  target: AdvisorSuggestionTarget;
}

export interface AdvisorContext {
  offerTitle: string;
  score: number;
  missingHardSkills: string[];
  matchedKeywords: string[];
  structuralWarnings: string[];
  formattingWarnings: string[];
  missingProfileSections: string[];
  hasLanguages: boolean;
  lexicon: Array<{ term: string; source: 'oferta' | 'profil' | 'luka' }>;
  suggestions: AdvisorSuggestion[];
}

const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

/**
 * Prywatny, przejściowy kontekst dla Doradcy. Nie zawiera kontaktu, treści CV
 * ani pełnego Vaultu; przechowuje tylko sygnały już wyliczone przez aplikację.
 */
export function buildAdvisorContext(
  vault: MasterVault,
  offer: JobOffer,
  ats: AtsCheckResult,
): AdvisorContext {
  const completeness = measureVaultCompleteness(vault);
  // Raport śledczy nie jest drugim „wynikiem ATS”. Używamy go wyłącznie do
  // nazwania mierzalnych problemów technicznych dokumentu, których symulator
  // dopasowania oferty nie opisuje (np. tabele lub kolejność odczytu).
  const telemetry = buildAtsTelemetryReport({
    vault,
    jobDescription: offer.rawDescription || offer.description || offer.requirements?.join('\n') || '',
  });
  const profileTerms = unique([
    ...vault.skillsMatrix.hardSkills,
    ...vault.skillsMatrix.toolsAndTech,
    ...vault.history.map((item) => item.role),
  ]).slice(0, 24);
  const offerTerms = unique([...(offer.requirements ?? []), ...(offer.techStack ?? [])]).slice(0, 24);
  const missing = unique(ats.missingHardSkills).slice(0, 8);

  const structuralWarnings = unique([
    ...ats.layer1Structure.missingStandardSections.map((section) => `Brak standardowej sekcji: ${section}.`),
    ...ats.layer1Structure.unparsableElementsWarnings,
    ...ats.ocrWarnings,
    ...ats.badDateFormats,
    ...(telemetry.structuralTelemetry.readingOrderIntegrity === 'CORRUPTED'
      ? ['Wykryto niestabilną kolejność odczytu dokumentu.']
      : []),
    ...(telemetry.structuralTelemetry.tableCount > 0
      ? [`Wykryto ${telemetry.structuralTelemetry.tableCount} ${telemetry.structuralTelemetry.tableCount === 1 ? 'tabelę' : 'tabele'} w analizowanym dokumencie.`]
      : []),
    ...(telemetry.structuralTelemetry.unsupportedCharactersCount > 0
      ? [`Wykryto ${telemetry.structuralTelemetry.unsupportedCharactersCount} nietypowych znaków do sprawdzenia.`]
      : []),
  ]).slice(0, 8);
  const missingProfileSections = completeness.missing.map((id) =>
    VAULT_SECTIONS.find((section) => section.id === id)?.label ?? id
  );
  const suggestions: AdvisorSuggestion[] = [];

  if (structuralWarnings.length > 0) {
    suggestions.push({
      id: 'audit-structure',
      label: 'Sprawdź strukturę CV',
      description: 'W Audycie ATS zobaczysz kolejność odczytu, nagłówki, tabele i znaki do poprawy.',
      target: 'ats-lab',
    });
  }
  if (missingProfileSections.length > 0 || !vault.profiler.languages.length) {
    suggestions.push({
      id: 'complete-profile',
      label: 'Uzupełnij Master Vault',
      description: 'W Profilu dopiszesz brakujące fakty, języki i dowody doświadczenia — bez zgadywania.',
      target: 'profil',
    });
  }
  if (missing.length > 0 || ats.overallScore < 75) {
    suggestions.push({
      id: 'review-match',
      label: 'Wróć do dopasowania',
      description: 'W „Sprawdź dopasowanie” porównasz wymagania oferty z prawdziwymi dowodami w CV.',
      target: 'aplikuj',
    });
  }

  return {
    offerTitle: offer.title || 'aktualna oferta',
    score: ats.overallScore,
    missingHardSkills: missing,
    matchedKeywords: unique(ats.matchedKeywords).slice(0, 12),
    structuralWarnings,
    formattingWarnings: unique(ats.badDateFormats),
    missingProfileSections,
    hasLanguages: vault.profiler.languages.length > 0,
    lexicon: [
      ...offerTerms.map((term) => ({ term, source: 'oferta' as const })),
      ...profileTerms.map((term) => ({ term, source: 'profil' as const })),
      ...missing.map((term) => ({ term, source: 'luka' as const })),
    ],
    suggestions: suggestions.slice(0, 3),
  };
}

function normalize(value: string): string {
  return value.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function buildContextualAdvice(query: string, context: AdvisorContext): string | null {
  const q = normalize(query);
  const asksForAssessment = /czy.*(dobre|dobr|ok)|ocen|jak.*cv|dopasowan|wynik|ats/.test(q);
  const termsMentioned = context.lexicon
    .filter((entry) => normalize(entry.term).length > 2 && q.includes(normalize(entry.term)))
    .slice(0, 3);

  const facts: string[] = [];
  if (asksForAssessment) {
    const scoreMessage = context.score < 55
      ? `W ostatnim dopasowaniu do „${context.offerTitle}” własna analiza Kierivo wyniosła ${context.score}/100. To słaby punkt wyjścia do tej konkretnej oferty, nie werdykt o Twojej wartości ani wynik zewnętrznego ATS.`
      : context.score < 75
        ? `W ostatnim dopasowaniu do „${context.offerTitle}” własna analiza Kierivo wyniosła ${context.score}/100. Jest materiał do aplikacji, ale przed wysłaniem warto usunąć najważniejsze luki.`
        : `W ostatnim dopasowaniu do „${context.offerTitle}” własna analiza Kierivo wyniosła ${context.score}/100. Dopasowanie wygląda solidnie, ale nadal sprawdź fakty i szczegóły dokumentu przed wysłaniem.`;
    facts.push(scoreMessage);
  }

  if (termsMentioned.length > 0) {
    const missing = termsMentioned.filter((entry) => entry.source === 'luka').map((entry) => entry.term);
    const confirmed = termsMentioned.filter((entry) => entry.source === 'profil').map((entry) => entry.term);
    if (missing.length) facts.push(`W tej analizie brakuje potwierdzenia dla: ${missing.join(', ')}. Dodaj je wyłącznie wtedy, gdy masz realny przykład w doświadczeniu, projekcie albo uprawnieniu.`);
    if (confirmed.length) facts.push(`W profilu są już sygnały związane z: ${confirmed.join(', ')}. Warto umieścić je w konkretnym punkcie doświadczenia, a nie tylko na liście umiejętności.`);
  }

  if (context.missingHardSkills.length > 0 && (asksForAssessment || /brak|luka|czego/.test(q))) {
    facts.push(`Najważniejsze niepokryte wymagania oferty: ${context.missingHardSkills.slice(0, 3).join(', ')}. Najpierw sprawdź, czy dowód tych kompetencji istnieje w Master Vault; jeśli nie, to luka względem oferty, a nie tekst do dopisania na siłę.`);
  }
  if (context.structuralWarnings.length > 0 && (asksForAssessment || /format|tabel|uklad|data|sekcj/.test(q))) {
    facts.push(`Do poprawy technicznej: ${context.structuralWarnings.slice(0, 2).join(' ')}`);
  }
  if (!context.hasLanguages && (asksForAssessment || /jezyk|profil|brak/.test(q))) {
    facts.push('W profilu nie ma jeszcze wpisanego języka. Uzupełnij go tylko z poziomem, który potrafisz potwierdzić w praktyce.');
  }
  if (context.missingProfileSections.length > 0 && (asksForAssessment || /vault|profil|brak/.test(q))) {
    facts.push(`Master Vault wciąż nie zawiera: ${context.missingProfileSections.slice(0, 2).join(', ')}. To ogranicza jakość kolejnych dokumentów i analiz.`);
  }

  return facts.length ? facts.slice(0, 5).join('\n\n') : null;
}
