import {
  MasterVault,
  InterviewCheatSheet,
  GlossaryTerm,
  StarTalkingPoint,
  InterviewQaItem,
  RedFlagConceptItem,
  EmergencyPhrase,
  QuestionToAsk,
} from '../types';
import { ParsedJobDescription } from './jdParser';
import { rankExperienceByRelevance } from './relevanceRanking';
import { lookupGlossaryDefinition, hasGlossaryDefinition } from '../data/interviewGlossaryDictionary';
import { api, ApiError } from './apiClient';
import { StorageKeys, cheatSheetCacheKeyFor, readJson, removeRaw, writeJson } from './storage';
import { consumeAiLocally } from '../store/useEntitlements';

/**
 * 0-Token local "skeleton" builder for the Interview Cheat Sheet — mirrors the
 * app's existing local slot-filling/ranking philosophy. Everything here is a pure,
 * deterministic function of (parsedJD, vault): same input -> same output, no
 * Math.random()/Date.now() in the content itself (see slot_filling_determinism.test.ts
 * for why that discipline matters — a prior local engine broke it once already).
 *
 * Only the parts that genuinely need personalization (STAR points grounded in the
 * candidate's real history, "why this company" framing, tone-matched emergency
 * phrases) go through generateCheatSheetEnrichmentWithAI() -> POST /api/generate-cheat-sheet.
 */

function dedupeCaseInsensitive(terms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const term of terms) {
    const trimmed = (term || '').trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function buildGlossary(parsedJD: ParsedJobDescription): GlossaryTerm[] {
  const jobTitle = parsedJD.jobTitle || '';

  const entries: Array<{ term: string; category: GlossaryTerm['category']; source: GlossaryTerm['source'] }> = [
    ...dedupeCaseInsensitive(parsedJD.requiredHardSkills || []).map((term) => ({
      term,
      category: 'HARD_SKILL' as const,
      source: 'JD_HARD_SKILL' as const,
    })),
    ...dedupeCaseInsensitive(parsedJD.toolsAndTech || []).map((term) => ({
      term,
      category: 'TOOL' as const,
      source: 'JD_TOOL' as const,
    })),
    // keyKeywords is every word in the ad, so it carries street names, city names and
    // boilerplate alongside real terms. Only keywords the dictionary can actually
    // define earn a place here — "Ujastek — make sure you can explain this term" is
    // worse than no entry at all.
    ...dedupeCaseInsensitive(parsedJD.keyKeywords || [])
      .filter((term) => hasGlossaryDefinition(term))
      .slice(0, 10)
      .map((term) => ({ term, category: 'DOMAIN_CONCEPT' as const, source: 'JD_KEYWORD' as const })),
  ];

  const seen = new Set<string>();
  const glossary: GlossaryTerm[] = [];
  for (const entry of entries) {
    const key = entry.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    glossary.push({
      id: `glossary-${glossary.length}`,
      term: entry.term,
      definition: lookupGlossaryDefinition(entry.term, jobTitle),
      category: /^[A-Z]{2,6}$/.test(entry.term) ? 'ACRONYM' : entry.category,
      source: entry.source,
    });
    if (glossary.length >= 14) break;
  }
  return glossary;
}

export function buildRedFlagsChecklist(parsedJD: ParsedJobDescription): RedFlagConceptItem[] {
  const items: RedFlagConceptItem[] = [];

  (parsedJD.mandatoryRequirements || []).forEach((req, idx) => {
    items.push({
      id: `redflag-mandatory-${idx}`,
      label: req,
      detail: 'Wymóg konieczny z oferty — przygotuj konkretny dowód spełnienia (dokument, certyfikat, przykład z doświadczenia).',
      severity: 'MUST_KNOW',
      source: 'MANDATORY_REQUIREMENT',
    });
  });

  (parsedJD.coreResponsibilities || []).slice(0, 5).forEach((resp, idx) => {
    items.push({
      id: `redflag-responsibility-${idx}`,
      label: resp,
      detail: 'Bądź gotów podać konkretny przykład z własnego doświadczenia pokazujący realizację tego obowiązku.',
      severity: 'GOOD_TO_KNOW',
      source: 'CORE_RESPONSIBILITY',
    });
  });

  if (['SENIOR', 'LEAD', 'EXECUTIVE'].includes(parsedJD.seniorityLevel)) {
    items.push({
      id: 'redflag-seniority',
      label: 'Zarządzanie zespołem / mentoring',
      detail: 'Stanowisko na poziomie seniorskim — przygotuj konkretne przykłady zarządzania zespołem, mentoringu lub podejmowania decyzji technicznych.',
      severity: 'GOOD_TO_KNOW',
      source: 'SENIORITY_IMPLICATION',
    });
  }

  return items;
}

/** Mechanical STAR remap of the candidate's existing highlight fields — no NLP, just field mapping. */
export function buildLocalStarSeeds(parsedJD: ParsedJobDescription, vault: MasterVault): StarTalkingPoint[] {
  if (!vault?.history || vault.history.length === 0) return [];

  const jdKeywords = [
    ...(parsedJD.requiredHardSkills || []),
    ...(parsedJD.coreResponsibilities || []),
    ...(parsedJD.keyKeywords || []),
  ].map((k) => k.toLowerCase());

  const topRequirement =
    parsedJD.requiredHardSkills?.[0] || parsedJD.coreResponsibilities?.[0] || parsedJD.jobTitle || 'kluczowe wymaganie oferty';

  const ranked = rankExperienceByRelevance(vault.history, jdKeywords, parsedJD.jobTitle || '');

  const seeds: StarTalkingPoint[] = [];
  ranked.slice(0, 2).forEach(({ experience }) => {
    const highlight = (experience.highlights || [])[0];
    if (!highlight) return;

    const hlText = typeof highlight === 'string' ? highlight : (highlight.text || '');
    const hlTarget = typeof highlight === 'object' && highlight !== null ? highlight.target : undefined;
    const hlAction = typeof highlight === 'object' && highlight !== null ? highlight.action : undefined;
    const hlTool = typeof highlight === 'object' && highlight !== null ? highlight.tool : undefined;
    const hlMetric = typeof highlight === 'object' && highlight !== null ? highlight.metric : undefined;

    const relatedRequirement =
      experience.role && jdKeywords.some((k) => k && experience.role.toLowerCase().includes(k))
        ? experience.role
        : topRequirement;

    seeds.push({
      id: `star-local-${seeds.length}`,
      relatedRequirement,
      situation: `Praca na stanowisku ${experience.role || 'specjalisty'} w ${experience.company || 'firmie'}.`,
      task: hlTarget
        ? `Zadanie związane z: ${hlTarget}.`
        : `Realizacja obowiązków związanych z rolą ${experience.role || 'specjalisty'}.`,
      action: hlAction
        ? `${hlAction}${hlTool ? ` przy użyciu ${hlTool}` : ''}.`
        : hlText || 'Brak szczegółowego opisu działania w Master Vault.',
      result: hlMetric
        ? `Efekt: ${hlMetric}.`
        : 'Efekt: dodaj konkretną liczbę/wynik do tego wpisu w Master Vault, żeby wzmocnić odpowiedź.',
      sourceExperienceId: experience.id,
    });
  });

  return seeds;
}

const QA_TEMPLATES: Array<{ category: InterviewQaItem['category']; build: (jd: ParsedJobDescription) => { question: string; modelAnswer: string } }> = [
  {
    category: 'MOTIVATION',
    build: (jd) => ({
      question: 'Opowiedz o sobie.',
      modelAnswer: `Krótko: kim jesteś zawodowo, 1-2 najważniejsze doświadczenia pasujące do roli ${jd.jobTitle || 'na którą aplikujesz'}, i dlaczego szukasz teraz tej zmiany. Maks. 60-90 sekund.`,
    }),
  },
  {
    category: 'MOTIVATION',
    build: (jd) => ({
      question: `Dlaczego chcesz pracować w ${jd.companyName || 'tej firmie'}?`,
      modelAnswer: 'Połącz coś konkretnego o firmie/ofercie z tym, co realnie umiesz zaoferować — unikaj ogólników typu "lubię wyzwania".',
    }),
  },
  {
    category: 'SITUATIONAL',
    build: (jd) => ({
      question: `Jak podszedłbyś do zadania związanego z: ${jd.coreResponsibilities?.[0] || 'codziennymi obowiązkami na tym stanowisku'}?`,
      modelAnswer: 'Opisz krok po kroku swój proces myślowy — najpierw zrozumienie kontekstu, potem plan działania, na końcu weryfikacja efektu.',
    }),
  },
  {
    category: 'TECHNICAL',
    build: (jd) => ({
      question: `Jakie masz doświadczenie z: ${jd.requiredHardSkills?.[0] || 'kluczowymi umiejętnościami z oferty'}?`,
      modelAnswer: 'Podaj konkretny przykład użycia tej umiejętności w realnym projekcie/pracy, najlepiej z liczbowym efektem.',
    }),
  },
  {
    category: 'BEHAVIORAL',
    build: () => ({
      question: 'Opowiedz o sytuacji, w której popełniłeś błąd. Co zrobiłeś?',
      modelAnswer: 'Krótko opisz błąd, skup się na tym, jak go naprawiłeś i czego się nauczyłeś — nie na obwinianiu się.',
    }),
  },
  {
    category: 'BEHAVIORAL',
    build: () => ({
      question: "Jak radzisz sobie z presją czasu / deadline'ami?",
      modelAnswer: 'Konkretny przykład: jak priorytetyzujesz zadania, komunikujesz ryzyko i dowozisz efekt mimo presji.',
    }),
  },
  {
    category: 'BEHAVIORAL',
    build: () => ({
      question: 'Opisz sytuację konfliktu w zespole i jak go rozwiązałeś.',
      modelAnswer: 'Skup się na konstruktywnym podejściu: wysłuchanie drugiej strony, szukanie wspólnego rozwiązania, efekt końcowy.',
    }),
  },
  {
    category: 'MOTIVATION',
    build: () => ({
      question: 'Gdzie widzisz siebie za 2-3 lata?',
      modelAnswer: 'Pokaż realistyczną ścieżkę rozwoju spójną z rolą, na którą aplikujesz — nie musisz mieć idealnego planu, ale pokaż kierunek.',
    }),
  },
];

export function buildQaBankLocal(parsedJD: ParsedJobDescription): InterviewQaItem[] {
  return QA_TEMPLATES.map((tpl, idx) => {
    const { question, modelAnswer } = tpl.build(parsedJD);
    return {
      id: `qa-local-${idx}`,
      question,
      modelAnswer,
      category: tpl.category,
      source: 'LOCAL_TEMPLATE' as const,
    };
  });
}

const EMERGENCY_PHRASE_TEMPLATES: Array<{ scenario: string; phrasePL: string }> = [
  { scenario: 'Potrzebujesz chwili do namysłu', phrasePL: 'To dobre pytanie — pozwól, że zastanowię się nad nim przez chwilę.' },
  { scenario: 'Nie znasz odpowiedzi wprost', phrasePL: 'Nie miałem jeszcze bezpośredniej styczności z tym konkretnie, ale oto jak bym do tego podszedł...' },
  { scenario: 'Chcesz upewnić się, że dobrze zrozumiałeś pytanie', phrasePL: 'Czy dobrze rozumiem, że pytasz o...?' },
  { scenario: 'Musisz poprosić o powtórzenie pytania', phrasePL: 'Czy mógłby Pan/Pani powtórzyć ostatnią część pytania?' },
  { scenario: 'Chcesz uporządkować odpowiedź na trudne pytanie', phrasePL: 'Podejdę do tego krok po kroku.' },
  { scenario: 'Nie masz jeszcze doświadczenia w danym temacie', phrasePL: 'Nie pracowałem z tym bezpośrednio, ale znam ogólną zasadę działania i szybko się uczę.' },
];

export function buildEmergencyPhrasesLocal(): EmergencyPhrase[] {
  return EMERGENCY_PHRASE_TEMPLATES.map((p, idx) => ({
    id: `emergency-local-${idx}`,
    scenario: p.scenario,
    phrasePL: p.phrasePL,
  }));
}

export function buildQuestionsToAskLocal(parsedJD: ParsedJobDescription): QuestionToAsk[] {
  const questions: QuestionToAsk[] = [
    {
      id: 'ask-role-1',
      question: 'Jak wygląda typowy dzień/tydzień pracy na tym stanowisku?',
      rationale: 'Pokazuje realne zaangażowanie i pomaga ocenić dopasowanie do roli.',
      category: 'ROLE_SCOPE',
    },
    {
      id: 'ask-team-1',
      question: 'Jak wygląda struktura zespołu, do którego dołączę?',
      rationale: 'Ważne dla oceny kultury pracy i stylu współpracy.',
      category: 'TEAM_CULTURE',
    },
    {
      id: 'ask-growth-1',
      question: 'Jak wygląda ścieżka rozwoju / awansu na tym stanowisku?',
      rationale: 'Sygnalizuje długoterminowe zaangażowanie w rolę.',
      category: 'GROWTH',
    },
    {
      id: 'ask-business-1',
      question: 'Jakie są największe wyzwania, przed którymi stoi teraz ten zespół/dział?',
      rationale: 'Daje kontekst biznesowy i pokazuje, że myślisz o realnym wpływie.',
      category: 'BUSINESS_CONTEXT',
    },
  ];

  if (parsedJD.workModel === 'REMOTE' || parsedJD.workModel === 'HYBRID') {
    questions.push({
      id: 'ask-remote-tools',
      question: 'Jakich narzędzi używa zespół do komunikacji i pracy zdalnej/hybrydowej?',
      rationale: 'Istotne przy pracy zdalnej/hybrydowej — pokazuje przygotowanie do trybu pracy z oferty.',
      category: 'TEAM_CULTURE',
    });
  }

  return questions;
}

export function buildLocalInterviewCheatSheet(
  parsedJD: ParsedJobDescription,
  vault: MasterVault,
  jobTitle: string,
  companyName: string
): InterviewCheatSheet {
  return {
    targetJobTitle: jobTitle || parsedJD.jobTitle || 'Stanowisko',
    companyName: companyName || parsedJD.companyName || 'Firma',
    generatedAt: new Date().toISOString(),
    glossary: buildGlossary(parsedJD),
    starTalkingPoints: buildLocalStarSeeds(parsedJD, vault),
    qaBank: buildQaBankLocal(parsedJD),
    redFlagsChecklist: buildRedFlagsChecklist(parsedJD),
    emergencyPhrases: buildEmergencyPhrasesLocal(),
    questionsToAsk: buildQuestionsToAskLocal(parsedJD),
    generationMode: 'LOCAL_SKELETON',
  };
}

export interface CheatSheetEnrichment {
  starTalkingPoints: StarTalkingPoint[];
  personalizedFraming: string;
  emergencyPhrases?: EmergencyPhrase[];
}

/** Pure overlay: replaces only the AI-personalized fields, leaves the rest of the local skeleton untouched. */
export function mergeGeminiCheatSheetEnrichment(
  local: InterviewCheatSheet,
  enrichment: CheatSheetEnrichment
): InterviewCheatSheet {
  return {
    ...local,
    starTalkingPoints: enrichment.starTalkingPoints,
    personalizedFraming: enrichment.personalizedFraming,
    emergencyPhrases:
      enrichment.emergencyPhrases && enrichment.emergencyPhrases.length > 0
        ? enrichment.emergencyPhrases
        : local.emergencyPhrases,
    generationMode: 'GEMINI_ENRICHED',
  };
}

/** Cheap, non-cryptographic string hash — good enough to key an exact-match cache entry. */
export function hashCheatSheetInput(
  vault: MasterVault,
  jobTitle: string,
  companyName: string,
  jobDescription: string
): string {
  const raw = `${jobTitle}|${companyName}|${jobDescription}|${JSON.stringify(vault?.history || [])}|${JSON.stringify(vault?.projects || [])}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `h${hash}`;
}

interface CachedEnrichmentEntry {
  hash: string;
  enrichment: CheatSheetEnrichment;
  cachedAt: string;
}

export function readCachedEnrichment(hash: string): CheatSheetEnrichment | null {
  const entry = readJson<CachedEnrichmentEntry | null>(cheatSheetCacheKeyFor(hash), null);
  return entry?.enrichment ?? null;
}

/**
 * Cache ma twardy limit, bo klucz powstaje dla każdej nowej pary oferta+vault
 * i bez sprzątania rósłby w nieskończoność — schowek przeglądarki ma wspólny
 * limit z całą domeną, a wpisy z punktami STAR potrafią ważyć kilokrotność
 * jednego rekordu. Po przekroczeniu limitu wypadają najstarsze wpisy: cache
 * służy temu, kto wraca do świeżo przygotowywanej rozmowy, nie archiwum.
 */
const CHEATSHEET_CACHE_LIMIT = 20;

function pruneCheatSheetCache(): void {
  const prefix = `${StorageKeys.cheatSheetCache}:`;

  const zbierz = (): Array<{ key: string; cachedAt: string }> => {
    const wpis: Array<{ key: string; cachedAt: string }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const entry = readJson<CachedEnrichmentEntry | null>(key, null);
      if (entry) wpis.push({ key, cachedAt: entry.cachedAt ?? '' });
    }
    return wpis;
  };

  let entries = zbierz();
  while (entries.length > CHEATSHEET_CACHE_LIMIT) {
    // Najstarszy według cachedAt. Remisy rozstrzyga klucz: kilka wpisów może
    // powstać w tej samej milisekundzie, a bez rozstrzygnięcia remisu wybór
    // zależałby od kolejności iteracji schowka i potrafił wyrzucić wpis
    // zapisany przed chwilą zamiast naprawdę najstarszego.
    let najstarszy = entries[0];
    for (const entry of entries.slice(1)) {
      const starszy =
        entry.cachedAt < najstarszy.cachedAt ||
        (entry.cachedAt === najstarszy.cachedAt && entry.key < najstarszy.key);
      if (starszy) najstarszy = entry;
    }
    removeRaw(najstarszy.key);
    entries = entries.filter((entry) => entry !== najstarszy);
  }
}

export function writeCachedEnrichment(hash: string, enrichment: CheatSheetEnrichment): void {
  const entry: CachedEnrichmentEntry = { hash, enrichment, cachedAt: new Date().toISOString() };
  writeJson(cheatSheetCacheKeyFor(hash), entry);
  pruneCheatSheetCache();
}

/**
 * Generates the Gemini-personalized part of the cheat sheet (POST /api/generate-cheat-sheet).
 * Checks an exact-match cache entry first so re-opening the same offer+vault
 * combination doesn't burn another Gemini call from the shared per-IP rate limit.
 */
export async function generateCheatSheetEnrichmentWithAI(
  targetRole: string,
  companyName: string,
  jobDescription: string,
  vault: MasterVault,
  topRequirements: string[]
): Promise<{ enrichment: CheatSheetEnrichment; fromCache: boolean }> {
  const hash = hashCheatSheetInput(vault, targetRole, companyName, jobDescription);
  const cached = readCachedEnrichment(hash);
  if (cached) {
    return { enrichment: cached, fromCache: true };
  }

  // Podpowiedź licznika przed strzałem: gdy interfejs wie, że darmowy dobowy
  // limit stoi na zerze, wysyłka skazana na 402 tylko marnowałaby czas.
  // Ostateczną decyzję i tak podejmuje serwer — ten komunikat obsługuje wyłącznie
  // przypadek, w którym podpowiedź i prawda się zgadzają.
  if (!consumeAiLocally()) {
    throw new Error(
      'Dzisiejszy limit darmowych wywołań AI jest wyczerpany. Limit odnowi się automatycznie o północy.'
    );
  }

  let data: { enrichment: CheatSheetEnrichment };
  try {
    data = await api.post<{ enrichment: CheatSheetEnrichment }>('/api/generate-cheat-sheet', {
      vault,
      targetRole,
      companyName,
      jobDescription,
      topRequirements,
    });
  } catch (err) {
    // `api` niesie już komunikat z serwera (limit zapytań, wyczerpana kwota).
    // Podmiana go na własny tekst zabrałaby użytkownikowi jedyną informację
    // o tym, czy ma poczekać, czy zmienić plan.
    if (err instanceof ApiError) throw err;
    throw new Error('Nie udało się wygenerować spersonalizowanej ściągi przez Gemini Flash.', {
      cause: err,
    });
  }

  const enrichment = data.enrichment;
  writeCachedEnrichment(hash, enrichment);
  return { enrichment, fromCache: false };
}
