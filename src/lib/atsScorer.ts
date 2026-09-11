import { MasterVault } from '../types';
import {
  getPolishStem,
  HR_AND_COMMON_STOP_WORDS,
  extractDynamicJdPhrases,
} from './atsSimulator';
import { auditKnockouts } from './knockouts';
import {
  renderCvFromClaims,
  calculateYearsDifference,
} from './consistencyGuard/consistencyEngine';

/**
 * Silnik telemetrii ATS — raport śledczy zamiast heurystyki.
 *
 * Poprzednia wersja tego modułu mnożyła wynik ogólny przez stałe współczynniki
 * (taleo = overall razy 1.05), czyli udawała pomiar tam, gdzie go nie było.
 * Tutaj każdy wskaźnik da się wywieść z danych wejściowych i wskazać palcem,
 * skąd pochodzi: pokrycie lematów z ekstrakcji ogłoszenia
 * (`extractDynamicJdPhrases`), dopasowanie po rdzeniach polskich
 * (`getPolishStem` — ta sama funkcja co w symulatorze, jedno źródło prawdy
 * morfologii), kryteria zerojedynkowe z `knockouts.ts`, struktura dokumentu
 * z kanonicznego renderu CV (`renderCvFromClaims`).
 *
 * Prawdziwość mechanizmów per system (Taleo czyta liniowo i dosłownie,
 * Greenhouse/Lever żyją na booleanach i gęstości, eRecruiter/Traffit pracują
 * na polskiej fleksji) jest zakodowana jako wagi kar na mierzalnych cechach —
 * tabela wag stoi przy `buildSystemVulnerabilities` i każdy jej wiersz ma
 * uzasadnienie w komentarzu.
 */

// ---------------------------------------------------------------------------
// Interfejs telemetryczny
// ---------------------------------------------------------------------------

export interface MatchedLemma {
  term: string;
  lemma: string;
  /**
   * Pochodzenie reguły dopasowującej. Dziś wszędzie Custom: rdzeniowanie
   * i słowniki są lokalne. ESCO i PoliMorf są zarezerwowane dla podłączenia
   * grafu wiedzy (semantic-work-graph) po stronie serwera — wpisanie ich dziś
   * fałszowałoby proweniencję (reguła 1).
   */
  source: 'ESCO' | 'PoliMorf' | 'Custom';
  countInCv: number;
  countInJd: number;
  /** (trafienia w CV / tokens CV) podzielone przez (trafienia w JD / tokens JD). Powyżej 3 — upychanie. */
  densityRatio: number;
}

export interface AtsTelemetryReport {
  overallScore: number;
  formulaBreakdown: {
    /** Waga 40%: ważone pokrycie twardych lematów ogłoszenia. */
    hardSkillsScore: number;
    /** Waga 25%: staż, gęstość metryk STAR, liczba punktorów na rolę. */
    experienceScore: number;
    /** Waga 20%: kolejność czytania, hierarchia nagłówków, tabele, znaki. */
    structureScore: number;
    /** Waga 15%: udział zdań z czasownikiem dokonanym. */
    actionVerbsScore: number;
    /** 0–100 pkt odjęte za niespełnione twarde wymagania (knockouts). */
    knockoutPenalties: number;
  };
  linguisticTelemetry: {
    totalExtractedTokens: number;
    matchedLemmas: MatchedLemma[];
    missingCriticalLemmas: string[];
    /** 0–1: odsetek zdań dokumentu z czasownikiem dokonanym. */
    actionVerbRatio: number;
  };
  structuralTelemetry: {
    readingOrderIntegrity: 'STABLE' | 'CORRUPTED';
    headingHierarchyValid: boolean;
    tableCount: number;
    unsupportedCharactersCount: number;
  };
  systemVulnerabilities: Array<{
    systemId: 'Taleo_Workday' | 'Greenhouse_Lever' | 'eRecruiter_Traffit';
    systemCategory: 'Enterprise Legacy' | 'Modern ATS / Boolean' | 'Polish Market (MŚP)';
    /** Nazwa rzeczywiście mierzonej cechy / wymiaru podatności dokumentu. */
    featureName: string;
    passProbability: number;
    criticalRisks: string[];
    complianceReasons: string[];
  }>;
}

/** Wagi wzoru — suma wynosi 1.00, pilnowana testem. */
export const FORMULA_WEIGHTS = {
  hardSkills: 0.4,
  experience: 0.25,
  structure: 0.2,
  actionVerbs: 0.15,
} as const;

/** Powyżej tej gęstości fraza wygląda jak upychanie słów kluczowych. */
export const STUFFING_DENSITY_THRESHOLD = 3;

/**
 * Czasowniki dokonane 1. os. l.poj. — trzon sprawczości w CV po polsku.
 * Lista autorska, celowo szeroka branżowo (reguła 8): monter i spawacz obok
 * programisty. Dokonaność potwierdza prefiks (z-, wy-, za-, na-, po-, prze-),
 * którego czasowniki niedokonane zwykle nie mają; heurystyka w
 * `hasPerfectiveVerb` łapie formy spoza listy.
 */
export const PERFECTIVE_VERBS: ReadonlySet<string> = new Set([
  'wdrożyłem', 'wdrożyłam', 'zbudowałem', 'zbudowałam',
  'zaprojektowałem', 'zaprojektowała', 'zoptymalizowałem', 'zoptymalizowałam',
  'zaimplementowałem', 'zaimplementowała', 'zautomatyzowałem', 'zautomatyzowała',
  'skonfigurowałem', 'skonfigurowałam', 'zintegrowałem', 'zintegrowałam',
  'zmigrowałem', 'zmigrowałam', 'zredukowałem', 'zredukowała',
  'skróciłem', 'skróciła', 'zwiększyłem', 'zwiększyła',
  'obniżyłem', 'obniżyła', 'podniosłem', 'podniosła',
  'uruchomiłem', 'uruchomiła', 'wystawiłem', 'wystawiła',
  'oddałem', 'oddała', 'przeprowadziłem', 'przeprowadziła',
  'przeszkoliłem', 'przeszkoliła', 'zdiagnozowałem', 'zdiagnozowała',
  'naprawiłem', 'naprawiła', 'wymieniłem', 'wymieniła',
  'zamontowałem', 'zamontowała', 'wykonałem', 'wykonała',
  'wyregulowałem', 'wyregulowała', 'skontrolowałem', 'skontrolowała',
  'przyspawałem', 'przyspawała', 'zweldowałem', 'zweldowała',
  'ustawiłem', 'ustawiła', 'sprawdziłem', 'sprawdziła',
  'odpaliłem', 'odpaliła', 'dostarczyłem', 'dostarczyła',
  'zakończyłem', 'zakończyła', 'poprowadziłem', 'poprowadziła',
  'osiągnąłem', 'osiągnęła', 'zdobyłem', 'zdobyła',
  'ukończyłem', 'ukończyła', 'uzyskałem', 'uzyskała',
  'opracowałem', 'opracowała', 'zsynchronizowałem', 'zsynchronizowała',
  'zabezpieczyłem', 'zabezpieczyła', 'odtworzyłem', 'odtworzyła',
  'zrefaktoryzowałem', 'zrefaktoryzowała',
]);

/** Zdanie kończy się kropką, pytajnikiem, wykrzyknikiem albo łamaniem linii — punktory CV to osobne linie, nie zawsze z kropką. */
function splitSentences(text: string): string[] {
  return (text ?? '')
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function hasPerfectiveVerb(sentence: string): boolean {
  const tokens = sentence.toLowerCase().match(/[a-ząćęłńóśźż]+/g) ?? [];
  return tokens.some((token) => {
    if (PERFECTIVE_VERBS.has(token)) return true;
    // Heurystyka uzupełniająca: forma …łem/…łam plus przedrostek dokonania.
    const stem = token.replace(/(łem|łam)$/, '');
    if (stem !== token && /^(z|wy|za|na|po|do|prze|roz|u|s|w)/.test(stem) && stem.length >= 3) {
      return true;
    }
    return false;
  });
}

/** Udział zdań z czasownikiem dokonanym; pusty dokument to 0, nie NaN. */
export function computeActionVerbRatio(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 0;
  const withVerb = sentences.filter(hasPerfectiveVerb).length;
  return withVerb / sentences.length;
}

// ---------------------------------------------------------------------------
// Struktura dokumentu
// ---------------------------------------------------------------------------

const SUPPORTED_CHARACTERS =
  /^[a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s.,;:!?"'()[\]{}%€$£+\-–—/\\@#&*_=<>|~^°•·»«…]+$/;

function countUnsupportedCharacters(...texts: string[]): number {
  let count = 0;
  for (const text of texts) {
    for (const char of text ?? '') {
      if (!SUPPORTED_CHARACTERS.test(char)) count++;
    }
  }
  return count;
}

/**
 * Wykrycie układu wielokolumnowego w surowym tekście CV (gdy użytkownik podał
 * tekst z importu). Sygnał: systematyczne szerokie spacje lub tabulatory
 * w środku linii — pozostałość kolumn po ekstrakcji z PDF-a. Dla dokumentu
 * kanonicznego kolejność jest stabilna z konstrukcji: jednokolumnowa sekwencja
 * sekcji, bez absolutnego pozycjonowania.
 */
function detectReadingOrder(cvRawText: string | undefined): 'STABLE' | 'CORRUPTED' {
  if (!cvRawText) return 'STABLE';

  const lines = cvRawText.split(/\r?\n/);
  let suspiciousLines = 0;
  for (const line of lines) {
    if (/\S {3,}\S/.test(line) || /\S\t+\S/.test(line)) suspiciousLines++;
  }
  // Pojedyncze szerokie odstępy zdarzają się w normalnym tekście; układ
  // kolumnowy zostawia je systematycznie — próg jednej dziesiątej linii.
  return suspiciousLines / Math.max(1, lines.length) > 0.1 ? 'CORRUPTED' : 'STABLE';
}

function countTables(cvRawText: string | undefined): number {
  if (!cvRawText) return 0;
  const htmlTables = (cvRawText.match(/<table[\s>]/gi) ?? []).length;
  // Wiersz tabelki markdownowej albo skopiowanej z arkusza: min. 2 separatory |.
  const pipeRows = (cvRawText.match(/^\s*\|.+\|.+\|\s*$/gm) ?? []).length;
  return htmlTables + pipeRows;
}

function auditHeadings(
  documentTitleCount: number,
  sectionTitles: string[],
  cvRawText: string | undefined
): boolean {
  // Surowy tekst z importu: hierarchia markdownowa, jeśli w ogóle istnieje.
  if (cvRawText) {
    const h1Count = (cvRawText.match(/^#\s+/gm) ?? []).length;
    const hasDeeperHeading = /^#{2,6}\s+/m.test(cvRawText);
    if (h1Count === 0 && !hasDeeperHeading) return false;
    if (h1Count > 1) return false;
    return true;
  }

  // Dokument kanoniczny: dokładnie jeden tytuł główny, każda sekcja z nagłówkiem.
  if (documentTitleCount !== 1) return false;
  if (sectionTitles.length === 0) return false;
  return sectionTitles.every((title) => title.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Lematyzacja i pokrycie ogłoszenia
// ---------------------------------------------------------------------------

const TOKEN_PATTERN = /[a-ząćęłńóśźż0-9#+.]{2,}/g;

function tokenizeLower(text: string): string[] {
  return (text ?? '').toLowerCase().match(TOKEN_PATTERN) ?? [];
}

/**
 * Trafienia frazy w korpusie po rdzeniu ostatniego znaczącego wyrazu.
 * Świadome uproszczenie: licznik służy pomiarowi gęstości i pokrycia, pełne
 * dopasowanie fraz robi symulator (`isLemmatizedMatch`).
 */
function countStemOccurrences(corpusTokens: string[], phrase: string): number {
  const words = phrase.split(/\s+/).filter((word) => !HR_AND_COMMON_STOP_WORDS.has(word));
  if (words.length === 0) return 0;
  const keyStem = getPolishStem(words[words.length - 1]);
  if (!keyStem) return 0;
  return corpusTokens.filter((token) => getPolishStem(token) === keyStem).length;
}

function countLiteralOccurrences(haystackLower: string, phrase: string): number {
  if (!phrase) return 0;
  let count = 0;
  let index = haystackLower.indexOf(phrase);
  while (index !== -1) {
    count++;
    index = haystackLower.indexOf(phrase, index + phrase.length);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Składnik doświadczenia (waga 25%)
// ---------------------------------------------------------------------------

const MAX_COUNTED_YEARS = 15;

function computeExperienceScore(vault: MasterVault): number {
  const history = vault.history ?? [];
  if (history.length === 0) return 0;

  // Staż z zakresów dat. „Obecnie" oznacza brak daty końcowej — taki okres
  // liczę od startu do startu (zero lat), zamiast wymyślać mu długość.
  let years = 0;
  for (const job of history) {
    if (!job?.startDate) continue;
    const end = job.isCurrent ? job.startDate : job.endDate || job.startDate;
    try {
      years += Math.max(0, calculateYearsDifference(job.startDate, end));
    } catch {
      // Nieczytelne daty nie wywracają raportu — ten okres po prostu się nie
      // liczy, co jest uczciwsze niż wymyślony staż.
    }
  }
  const tenurePts = (Math.min(MAX_COUNTED_YEARS, years) / MAX_COUNTED_YEARS) * 50;

  const highlights = history.flatMap((job) => job.highlights ?? []);
  const metricsPts =
    highlights.length === 0
      ? 0
      : (highlights.filter((highlight) => (highlight?.metric ?? '').trim().length > 0).length /
          highlights.length) *
        25;

  const bulletsPerRole = highlights.length / history.length;
  const depthPts = Math.min(1, bulletsPerRole / 3) * 25;

  return Math.round(tenurePts + metricsPts + depthPts);
}

// ---------------------------------------------------------------------------
// Werdykty per system — tabela wag z uzasadnieniami
// ---------------------------------------------------------------------------

interface SystemVerdictInput {
  hardSkillsScore: number;
  experienceScore: number;
  structureScore: number;
  actionVerbsScore: number;
  knockoutPenalties: number;
  readingOrder: 'STABLE' | 'CORRUPTED';
  headingValid: boolean;
  tableCount: number;
  unsupportedCharactersCount: number;
  /** Mediana densityRatio trafionych lematów — detektor upychania słów. */
  medianDensityRatio: number;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildSystemVulnerabilities(
  input: SystemVerdictInput
): AtsTelemetryReport['systemVulnerabilities'] {
  /*
   * Uzasadnienia wag (mechanizmy parserów):
   *
   * Taleo / Workday (Enterprise Legacy): parsowanie liniowe — wielokolumnowy
   * PDF po ekstrakcji scali kolumny w losową sekwencję zdań; tabele czytane
   * wierszami mieszają etykiety z wartościami; glify spoza strony kodowej
   * zamieniają się w krzaczki. Dopasowanie niemal dosłowne, więc struktura
   * i znaki ważą tu więcej niż gdziekolwiek indziej.
   *
   * Greenhouse / Lever (Modern ATS / Boolean): odporność układowa wysoka,
   * ale rekruter grepuje booleanami — nadmierna gęstość frazy wobec ogłoszenia
   * wygląda jak upychanie i obniża zaufanie do profilu. Podgląd czyta człowiek,
   * więc język sprawczy waży zauważalnie.
   *
   * eRecruiter / Traffit (Polish Market MŚP): polska fleksja — zgodność
   * rdzeni ratuje pokrycie (duży udział hardSkills mierzonego stemmerem),
   * ale prostsze parsery mapują sekcje formularza po nazwach nagłówków,
   * więc płaska hierarchia karze mocno.
   */

  const results: AtsTelemetryReport['systemVulnerabilities'] = [];

  // --- Taleo / Workday ---
  {
    const criticalRisks: string[] = [];
    const complianceReasons: string[] = [];

    let penalty = 0;
    if (input.readingOrder === 'CORRUPTED') {
      penalty += 20;
      criticalRisks.push(
        'Kolejność czytania naruszona (układ wielokolumnowy) — parser legacy scali kolumny w losową sekwencję zdań.'
      );
    } else {
      complianceReasons.push(
        'Jednokolumnowy porządek dokumentu — ekstrakcja liniowa odtworzy sekcje we właściwej kolejności.'
      );
    }

    const tablePenalty = Math.min(24, input.tableCount * 8);
    if (tablePenalty > 0) {
      penalty += tablePenalty;
      criticalRisks.push(
        `${input.tableCount} tabel(e) — legacy czyta je wiersz po wierszu, mieszając etykiety z wartościami.`
      );
    }

    const glyphPenalty = Math.min(15, Math.floor(input.unsupportedCharactersCount / 4) * 2);
    if (glyphPenalty > 0) {
      penalty += glyphPenalty;
      criticalRisks.push(
        `${input.unsupportedCharactersCount} znaków spoza bezpiecznego zestawu — ryzyko podmiany na glify przy konwersji kodowej.`
      );
    } else {
      complianceReasons.push('Zestaw znaków bezpieczny dla konwersji stron kodowych.');
    }

    if (!input.headingValid) {
      penalty += 10;
      criticalRisks.push('Hierarchia nagłówków bez jasnego tytułu głównego — segmentacja sekcji niedeterministyczna.');
    }

    const probability = clampPercent(
      input.structureScore * 0.45 +
        input.hardSkillsScore * 0.35 +
        (100 - input.knockoutPenalties) * 0.2 -
        penalty
    );

    results.push({
      systemId: 'Taleo_Workday',
      systemCategory: 'Enterprise Legacy',
      featureName: 'Parsowanie liniowe i odporność strukturalna',
      passProbability: probability,
      criticalRisks,
      complianceReasons,
    });
  }

  // --- Greenhouse / Lever ---
  {
    const criticalRisks: string[] = [];
    const complianceReasons: string[] = [];

    let penalty = 0;
    if (input.medianDensityRatio > STUFFING_DENSITY_THRESHOLD) {
      penalty += 12;
      criticalRisks.push(
        `Gęstość trafionych fraz ${input.medianDensityRatio.toFixed(1)}x względem ogłoszenia — wzorzec upychania słów kluczowych obniża zaufanie do profilu.`
      );
    } else {
      complianceReasons.push('Gęstość słów kluczowych w normie wobec treści ogłoszenia.');
    }

    if (!input.headingValid) {
      penalty += 6;
      criticalRisks.push('Brak wyraźnych nagłówków — wyszukiwanie booleanowskie po sekcjach traci kontekst.');
    }

    if (input.knockoutPenalties >= 50) {
      penalty += 10;
      criticalRisks.push('Twarde wymagania formalne niespełnione — filtr Boolean odrzuci profil niezależnie od reszty treści.');
    }

    const probability = clampPercent(
      input.hardSkillsScore * 0.4 +
        input.actionVerbsScore * 0.25 +
        input.structureScore * 0.2 +
        (100 - input.knockoutPenalties) * 0.15 -
        penalty
    );

    results.push({
      systemId: 'Greenhouse_Lever',
      systemCategory: 'Modern ATS / Boolean',
      featureName: 'Filtry słów kluczowych i gęstość fraz',
      passProbability: probability,
      criticalRisks,
      complianceReasons,
    });
  }

  // --- eRecruiter / Traffit ---
  {
    const criticalRisks: string[] = [];
    const complianceReasons: string[] = [];

    let penalty = 0;
    if (!input.headingValid) {
      penalty += 18;
      criticalRisks.push(
        'Płaska hierarchia nagłówków — formularze tych systemów mapują sekcje po ich nazwach i bez nich treść ląduje w złym polu.'
      );
    } else {
      complianceReasons.push('Nagłówki sekcji rozpoznawalne — mapowanie formularza przebiegnie poprawnie.');
    }

    const glyphPenalty = Math.min(10, Math.floor(input.unsupportedCharactersCount / 5) * 2);
    if (glyphPenalty > 0) {
      penalty += glyphPenalty;
      criticalRisks.push(
        `${input.unsupportedCharactersCount} nietypowych znaków — prostsze walidatory MŚP potrafią odrzucić rekord w całości.`
      );
    }

    if (input.experienceScore < 25) {
      penalty += 8;
      criticalRisks.push('Niska czytelność stażu i metryk — małe firmy HR oceniają ręcznie i szybko odpadają niejasne kandydatury.');
    }

    const probability = clampPercent(
      input.hardSkillsScore * 0.35 +
        input.structureScore * 0.3 +
        input.experienceScore * 0.2 +
        input.actionVerbsScore * 0.15 -
        penalty -
        input.knockoutPenalties * 0.3
    );

    results.push({
      systemId: 'eRecruiter_Traffit',
      systemCategory: 'Polish Market (MŚP)',
      featureName: 'Mapowanie formularzy i fleksja polska',
      passProbability: probability,
      criticalRisks,
      complianceReasons,
    });
  }

  return results;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// ---------------------------------------------------------------------------
// Wejście publiczne
// ---------------------------------------------------------------------------

export interface TelemetryInput {
  vault: MasterVault;
  jobDescription: string;
  /**
   * Opcjonalny surowy tekst CV z importu (PDF/TXT). Gdy jest, telemetria
   * strukturalna mierzy **ten** dokument (tabele, wielokolumny, nagłówki).
   * Bez niego mierzony jest dokument kanoniczny renderowany z vaultu — jego
   * jednokolumnowy porządek jest stabilny z konstrukcji.
   */
  cvRawText?: string;
}

export function buildAtsTelemetryReport(input: TelemetryInput): AtsTelemetryReport {
  const cvRawText = input.cvRawText;
  const { vault, jobDescription } = input;

  // --- Korpus językowy: cała realna treść kandydata + dokument kanoniczny ---
  const canonical = renderCvFromClaims(vault);
  const canonicalSectionTitles = canonical.sections.map((section) => section.title);

  const corpusParts: string[] = [
    vault.personalInfo?.summary || '',
    vault.personalInfo?.title || '',
    ...(vault.skillsMatrix?.hardSkills ?? []),
    ...(vault.skillsMatrix?.toolsAndTech ?? []),
    ...(vault.skillsMatrix?.softSkills ?? []),
    ...(vault.history ?? []).flatMap((job) => [
      job?.role || '',
      ...(job?.highlights ?? []).map(
        (highlight) =>
          `${highlight?.text || ''} ${highlight?.action || ''} ${highlight?.target || ''} ${
            highlight?.tool || ''
          } ${highlight?.metric || ''}`
      ),
    ]),
    ...(vault.projects ?? []).map((project) => project?.description || ''),
    canonical.candidateName,
    canonical.title,
    ...canonicalSectionTitles,
    ...canonical.sections.flatMap((section) =>
      section.items.map((item) => `${item.summary} ${item.metric ?? ''}`)
    ),
  ];
  const analysisCorpus = corpusParts.filter(Boolean).join('\n');

  // --- Struktura ---
  const readingOrderIntegrity = detectReadingOrder(cvRawText);
  const tableCount = countTables(cvRawText);
  const headingHierarchyValid = auditHeadings(
    canonical.title.trim() ? 1 : 0,
    canonicalSectionTitles,
    cvRawText
  );
  const unsupportedCharactersCount = countUnsupportedCharacters(analysisCorpus, cvRawText ?? '');

  const structureScore = Math.max(
    0,
    Math.round(
      100 -
        (readingOrderIntegrity === 'CORRUPTED' ? 35 : 0) -
        (headingHierarchyValid ? 0 : 25) -
        Math.min(30, tableCount * 10) -
        Math.min(20, Math.ceil(unsupportedCharactersCount / 5) * 2)
    )
  );

  // --- Język ---
  const corpusTokens = tokenizeLower(analysisCorpus);
  const jdLower = (jobDescription ?? '').toLowerCase();
  const jdTokenCount = tokenizeLower(jobDescription).length;

  const extraction = extractDynamicJdPhrases(jobDescription);

  const matchedLemmas: MatchedLemma[] = [];
  const missingCriticalLemmas: Array<{ term: string; weight: number }> = [];
  let totalWeighted = 0;
  let matchedWeighted = 0;

  for (const { phrase, weight } of extraction.hardSkills) {
    totalWeighted += weight;
    const countInCv = countStemOccurrences(corpusTokens, phrase);
    const countInJd = countLiteralOccurrences(jdLower, phrase);

    if (countInCv === 0) {
      if (weight >= 2) missingCriticalLemmas.push({ term: phrase, weight });
      continue;
    }
    matchedWeighted += weight;

    const cvDensity = corpusTokens.length === 0 ? 0 : countInCv / corpusTokens.length;
    const jdDensity = jdTokenCount === 0 ? 0 : countInJd / jdTokenCount;
    const densityRatio = jdDensity === 0 ? (cvDensity === 0 ? 0 : STUFFING_DENSITY_THRESHOLD * 10) : cvDensity / jdDensity;

    matchedLemmas.push({
      term: phrase,
      lemma: getPolishStem(phrase.split(/\s+/).pop() ?? phrase) || phrase,
      source: 'Custom',
      countInCv,
      countInJd,
      densityRatio: Math.round(densityRatio * 1000) / 1000,
    });
  }

  matchedLemmas.sort(
    (a, b) => b.countInJd - a.countInJd || b.countInCv - a.countInCv || a.term.localeCompare(b.term, 'pl')
  );

  const actionVerbRatio = computeActionVerbRatio(analysisCorpus);

  const hardSkillsScore =
    totalWeighted === 0
      ? 100 // Ogłoszenie bez rozpoznanych wymagań niczego nie wymaga — pokrycie próżne.
      : Math.round((matchedWeighted / totalWeighted) * 100);

  // --- Knockouts ---
  const knockoutReport = auditKnockouts(jobDescription, vault);
  const knockoutPenalties = Math.min(100, knockoutReport.blocking.length * 25);

  const experienceScore = computeExperienceScore(vault);
  const actionVerbsScore = Math.round(actionVerbRatio * 100);

  const overallScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        hardSkillsScore * FORMULA_WEIGHTS.hardSkills +
          experienceScore * FORMULA_WEIGHTS.experience +
          structureScore * FORMULA_WEIGHTS.structure +
          actionVerbsScore * FORMULA_WEIGHTS.actionVerbs -
          knockoutPenalties
      )
    )
  );

  const medianDensityRatio = median(matchedLemmas.map((lemma) => lemma.densityRatio));

  const systemVulnerabilities = buildSystemVulnerabilities({
    hardSkillsScore,
    experienceScore,
    structureScore,
    actionVerbsScore,
    knockoutPenalties,
    readingOrder: readingOrderIntegrity,
    headingValid: headingHierarchyValid,
    tableCount,
    unsupportedCharactersCount,
    medianDensityRatio,
  });

  return {
    overallScore,
    formulaBreakdown: {
      hardSkillsScore,
      experienceScore,
      structureScore,
      actionVerbsScore,
      knockoutPenalties,
    },
    linguisticTelemetry: {
      totalExtractedTokens: corpusTokens.length,
      matchedLemmas: matchedLemmas.slice(0, 12),
      missingCriticalLemmas: missingCriticalLemmas
        .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term, 'pl'))
        .slice(0, 8)
        .map((item) => item.term),
      actionVerbRatio: Math.round(actionVerbRatio * 100) / 100,
    },
    structuralTelemetry: {
      readingOrderIntegrity,
      headingHierarchyValid,
      tableCount,
      unsupportedCharactersCount,
    },
    systemVulnerabilities,
  };
}
