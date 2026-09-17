import { MasterVault } from '../types';
import { getPolishStem, extractDynamicJdPhrases } from './atsSimulator';
import { auditKnockouts } from './knockouts';
import { renderCvFromClaims } from './consistencyGuard/consistencyEngine';
import {
  hasPositiveSkillEvidence,
  containsPhrase,
  countPhraseOccurrences,
} from './skillEvidence';
import { unionExperienceYears } from './experience';

/**
 * Silnik telemetrii ATS — raport śledczy oparty na mierzalnych cechach.
 *
 * Każdy wskaźnik da się wywieść z danych wejściowych i wskazać jego źródło:
 * pokrycie lematów z ekstrakcji ogłoszenia (`extractDynamicJdPhrases`),
 * dopasowanie po rdzeniach polskich (`getPolishStem`), kryteria zerojedynkowe
 * z `knockouts.ts` oraz struktura dokumentu z kanonicznego renderu CV
 * (`renderCvFromClaims`).
 *
 * Trzy profile poniżej nie reprezentują produktów ani wyników zewnętrznych
 * systemów rekrutacyjnych. Są wariantami tej samej lokalnej heurystyki,
 * akcentującymi kolejno strukturę, frazy oraz język/formularz. Ich nazwy mówią
 * wyłącznie o mierzonej cesze, dzięki czemu nie sugerują benchmarku vendora.
 *
 * DIAGNOSTYKA ŚLEDCZA, nie wynik kanoniczny: wynikiem do wyświetlania jako
 * dopasowanie jest `scoreCanonicalAts` (`lib/canonicalAts.ts`).
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
    systemId: 'Struktura_Odczyt' | 'Frazy_Gestosc' | 'Jezyk_Formularz';
    systemCategory: 'Układ i parsowalność' | 'Frazy i sygnały tekstowe' | 'Polska fleksja i formularze';
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
 *
 * Utrzymuj w synchronizacji ze słownikiem grafu (`ACTION_VERBS` w
 * `semantic-work-graph/src/seed/lexicon/PolishMorphology.ts`): każda forma
 * stąd ma mieć tam swój lemat, inaczej licznik sprawczości i lematyzator
 * rozjadą się na tym samym CV.
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

/**
 * Angielskie odpowiedniki sprawczości — bez nich identyczne CV po angielsku
 * dostawało 0 w składniku 15% (F8: PL 23 vs EN 0 przy tych samych faktach).
 * Lista jawna jak polska; heurystyka sufiksowa zostaje tylko dla polszczyzny.
 */
const EN_ACTION_VERBS: ReadonlySet<string> = new Set([
  'implemented', 'delivered', 'built', 'designed', 'optimized', 'automated',
  'migrated', 'reduced', 'increased', 'launched', 'led', 'achieved', 'developed',
  'deployed', 'created', 'improved', 'cut', 'saved', 'shipped', 'drove',
  'owned', 'mentored', 'migrated', 'refactored', 'scaled',
]);

function hasPerfectiveVerb(sentence: string): boolean {
  const tokens = sentence.toLowerCase().match(/[a-ząćęłńóśźż]+/g) ?? [];
  if (tokens.some((token) => PERFECTIVE_VERBS.has(token))) return true;
  const ascii = sentence.toLowerCase().match(/[a-z]+/g) ?? [];
  if (ascii.some((token) => EN_ACTION_VERBS.has(token))) return true;
  return tokens.some((token) => {
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

/**
 * Cyrylica (ukraińskie/rosyjskie CV) nie jest wadą dokumentu — wcześniejszy
 * zestaw jej nie zawierał, więc każde 5 liter cyrylicy karało strukturę,
 * a pełne CV dostawało −20 tylko za alfabet (F7).
 */
const SUPPORTED_CHARACTERS =
  /^[a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\u0400-\u052F\s.,;:!?"'()[\]{}%€$£+\-–—/\\@#&*_=<>|~^°•·»«…]+$/;

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
  return suspiciousLines / Math.max(1, lines.length) > 0.1 ? 'CORRUPTED' : 'STABLE';
}

function countTables(cvRawText: string | undefined): number {
  if (!cvRawText) return 0;
  const htmlTables = (cvRawText.match(/<table[\s>]/gi) ?? []).length;
  const pipeRows = (cvRawText.match(/^\s*\|.+\|.+\|\s*$/gm) ?? []).length;
  return htmlTables + pipeRows;
}

function auditHeadings(
  documentTitleCount: number,
  sectionTitles: string[],
  cvRawText: string | undefined
): boolean {
  // Surowy tekst z importu: markdown ALBO zwykłe nagłówki sekcji.
  // Wcześniej czysty TXT bez `#` dostawał −25 z automatu (F7), choć parser
  // sekcji (`cvUniversalParser`) te same nagłówki rozumie.
  if (cvRawText) {
    const h1Count = (cvRawText.match(/^#\s+/gm) ?? []).length;
    const hasDeeperHeading = /^#{2,6}\s+/m.test(cvRawText);
    if (h1Count === 1 || (h1Count === 0 && hasDeeperHeading)) return true;
    if (h1Count > 1) return false;
    const plainHeaders = ['doświadczenie', 'umiejętności', 'kontakt', 'edukacja', 'education', 'skills', 'experience', 'certyfikaty', 'podsumowanie', 'summary'];
    const found = plainHeaders.filter((h) => containsPhrase(cvRawText, h)).length;
    return found >= 2;
  }

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

/** (usunięte) Liczniki podciągowe `indexOf`/rdzeniowe zastąpione granicami słów
 * z `skillEvidence` (`countPhraseOccurrences`): `cit` nie liczy się w `city` (F2). */

// ---------------------------------------------------------------------------
// Składnik doświadczenia (waga 25%)
// ---------------------------------------------------------------------------

const MAX_COUNTED_YEARS = 15;

/** Staż do testów regresji (unia, bez metryk/głębi). */
export function computeTenureYears(vault: MasterVault): number {
  return unionExperienceYears(vault.history);
}

function computeExperienceScore(vault: MasterVault): number {
  const history = vault.history ?? [];
  if (history.length === 0) return 0;

  // Staż z unii przedziałów: nakładające się etaty liczą się raz, bieżące
  // kończą się dziś (wcześniej: suma naiwna + `isCurrent → 0 lat`, F5).
  // Nieczytelne/przyszłe/odwrócone daty wypadają w `employmentIntervalForJob`.
  const years = unionExperienceYears(history);
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
// Profile mierzalnych cech — tabela wag z uzasadnieniami
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
   * Profile są lokalnymi perspektywami na te same dane:
   *
   * Struktura / Odczyt: mocniej karze wielokolumnowy tekst, tabele, nietypowe
   * znaki oraz niejasną hierarchię nagłówków.
   *
   * Frazy / Gęstość: mocniej waży pokrycie treści, język sprawczy i wykrywa
   * nadmierną gęstość powtarzanych fraz.
   *
   * Język / Formularz: łączy pokrycie fraz z czytelnością nagłówków,
   * doświadczenia i polskiej fleksji. Żaden profil nie jest emulacją vendora.
   */

  const results: AtsTelemetryReport['systemVulnerabilities'] = [];

  // --- Struktura / Odczyt ---
  {
    const criticalRisks: string[] = [];
    const complianceReasons: string[] = [];

    let penalty = 0;
    if (input.readingOrder === 'CORRUPTED') {
      penalty += 20;
      criticalRisks.push(
        'Kolejność czytania naruszona przez układ wielokolumnowy; ekstrakcja liniowa może połączyć kolumny w złej kolejności.'
      );
    } else {
      complianceReasons.push(
        'Jednokolumnowy porządek dokumentu utrzymuje stabilną kolejność ekstrakcji tekstu.'
      );
    }

    const tablePenalty = Math.min(24, input.tableCount * 8);
    if (tablePenalty > 0) {
      penalty += tablePenalty;
      criticalRisks.push(
        `${input.tableCount} tabel(e) — ekstrakcja wierszowa może mieszać etykiety z wartościami.`
      );
    }

    const glyphPenalty = Math.min(15, Math.floor(input.unsupportedCharactersCount / 4) * 2);
    if (glyphPenalty > 0) {
      penalty += glyphPenalty;
      criticalRisks.push(
        `${input.unsupportedCharactersCount} znaków spoza bezpiecznego zestawu — rośnie ryzyko błędów konwersji tekstu.`
      );
    } else {
      complianceReasons.push('Zestaw znaków mieści się w konserwatywnym zakresie odczytu tekstowego.');
    }

    if (!input.headingValid) {
      penalty += 10;
      criticalRisks.push('Hierarchia nagłówków bez jasnego tytułu głównego utrudnia segmentację sekcji.');
    }

    const probability = clampPercent(
      input.structureScore * 0.45 +
        input.hardSkillsScore * 0.35 +
        (100 - input.knockoutPenalties) * 0.2 -
        penalty
    );

    results.push({
      systemId: 'Struktura_Odczyt',
      systemCategory: 'Układ i parsowalność',
      passProbability: probability,
      criticalRisks,
      complianceReasons,
    });
  }

  // --- Frazy / Gęstość ---
  {
    const criticalRisks: string[] = [];
    const complianceReasons: string[] = [];

    let penalty = 0;
    if (input.medianDensityRatio > STUFFING_DENSITY_THRESHOLD) {
      penalty += 12;
      criticalRisks.push(
        `Gęstość trafionych fraz ${input.medianDensityRatio.toFixed(1)}x względem ogłoszenia — wzorzec wygląda na sztuczne upychanie słów kluczowych.`
      );
    } else {
      complianceReasons.push('Gęstość słów kluczowych pozostaje proporcjonalna do treści ogłoszenia.');
    }

    if (!input.headingValid) {
      penalty += 6;
      criticalRisks.push('Brak wyraźnych nagłówków osłabia kontekst fraz między sekcjami.');
    }

    if (input.knockoutPenalties >= 50) {
      penalty += 10;
      criticalRisks.push('Niespełnione twarde wymagania formalne obniżają ocenę niezależnie od dopasowania fraz.');
    }

    const probability = clampPercent(
      input.hardSkillsScore * 0.4 +
        input.actionVerbsScore * 0.25 +
        input.structureScore * 0.2 +
        (100 - input.knockoutPenalties) * 0.15 -
        penalty
    );

    results.push({
      systemId: 'Frazy_Gestosc',
      systemCategory: 'Frazy i sygnały tekstowe',
      passProbability: probability,
      criticalRisks,
      complianceReasons,
    });
  }

  // --- Język / Formularz ---
  {
    const criticalRisks: string[] = [];
    const complianceReasons: string[] = [];

    let penalty = 0;
    if (!input.headingValid) {
      penalty += 18;
      criticalRisks.push(
        'Płaska hierarchia nagłówków zwiększa ryzyko przypisania treści do niewłaściwej sekcji formularza.'
      );
    } else {
      complianceReasons.push('Nagłówki sekcji są rozpoznawalne i wspierają poprawne mapowanie treści.');
    }

    const glyphPenalty = Math.min(10, Math.floor(input.unsupportedCharactersCount / 5) * 2);
    if (glyphPenalty > 0) {
      penalty += glyphPenalty;
      criticalRisks.push(
        `${input.unsupportedCharactersCount} nietypowych znaków zwiększa ryzyko błędów walidacji tekstu.`
      );
    }

    if (input.experienceScore < 25) {
      penalty += 8;
      criticalRisks.push('Niska czytelność stażu i metryk utrudnia szybkie odczytanie doświadczenia.');
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
      systemId: 'Jezyk_Formularz',
      systemCategory: 'Polska fleksja i formularze',
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

  const corpusTokens = tokenizeLower(analysisCorpus);
  const jdTokenCount = tokenizeLower(jobDescription).length;

  const extraction = extractDynamicJdPhrases(jobDescription);

  const matchedLemmas: MatchedLemma[] = [];
  const missingCriticalLemmas: Array<{ term: string; weight: number }> = [];
  let totalWeighted = 0;
  let matchedWeighted = 0;

  for (const { phrase, weight } of extraction.hardSkills) {
    totalWeighted += weight;
    // Pokrycie = pozytywny dowód (negacje/nauka/wyciek nie liczą się, F1),
    // liczniki = granice słów (wcześniej `indexOf` liczył `cit` w `city`, F2).
    const hasEvidence = hasPositiveSkillEvidence(analysisCorpus, phrase);
    const countInCv = countPhraseOccurrences(analysisCorpus, phrase);
    const countInJd = Math.max(1, countPhraseOccurrences(jobDescription, phrase));

    if (!hasEvidence) {
      // Krytyczne = słownik (waga ≥ 2); sygnały kapitalizacji (1.5) obniżają
      // pokrycie bez etykiety „krytyczny brak" — to poszlaka, nie wymaganie.
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

  // Puste ogłoszenie to brak mianownika (0), nie 100 z próżni (F4).
  // Kanoniczny stan niedostępności raportuje `canonicalAts.ts`; tu liczba
  // spada do zera, żeby nie udawać pewności.
  const hardSkillsScore =
    totalWeighted === 0
      ? 0
      : Math.round((matchedWeighted / totalWeighted) * 100);

  const knockoutReport = auditKnockouts(jobDescription, vault);
  const knockoutPenalties = Math.min(100, knockoutReport.blocking.length * 25);

  const experienceScore = computeExperienceScore(vault);
  const actionVerbsScore = Math.round(actionVerbRatio * 100);

  // Brak wykrytych wymagań = brak mianownika: wynik 0, nie suma stażu
  // i struktury z niczego (F4; symulator robi tak samo).
  const noRequirements =
    totalWeighted === 0 && knockoutReport.requirementCount === 0;
  const overallScore = noRequirements
    ? 0
    : Math.max(
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
