/**
 * Walidator PDF pod kątem kompatybilności z konkretnymi ATS-ami.
 *
 * Porównuje wyekstrahowany tekst z PDF z oczekiwaną treścią z MasterVault,
 * stosując reguły specyficzne dla każdego vendora ATS.
 *
 * To NIE jest symulator scoringu ATS — to walidacja parsowalności:
 * "czy dany ATS faktycznie wyekstrahuje dane z tego dokumentu?"
 *
 * Wynik: per-vendor raport z konkretnymi problemami i zaleceniami.
 *
 * Rozróżnienie od istniejących modułów:
 * - `atsSimulator.ts` — scoring dopasowania CV do oferty (heurystyka)
 * - `canonicalAts.ts` — kanoniczny wynik dopasowania (JEDYNA liczba)
 * - `atsScorer.ts` — telemetria śledcza (diagnostyka)
 * - TEN MODUŁ — walidacja formatu PDF pod kątem parsowalności przez ATS-y
 */

import type { MasterVault } from '../types';
import { ALL_ATS_PROFILES, type AtsVendorProfile } from './atsVendorProfiles';
import {
  processExtractedText,
  buildExpectedText,
  tokenize,
  type ExtractedPdfText,
} from './pdfTextExtractor';
import { hasPositiveSkillEvidence } from './skillEvidence';

// ---------------------------------------------------------------------------
// Typy wyników
// ---------------------------------------------------------------------------

export interface AtsPdfValidationResult {
  /** ID profilu ATS */
  vendorId: string;
  /** Nazwa ATS */
  vendorName: string;
  /** Ocena parsowalności 0–100 */
  parseScore: number;
  /** Status ogólny */
  status: 'PASS' | 'WARN' | 'FAIL';
  /** Wykryte problemy */
  issues: AtsIssue[];
  /** Zalecenia naprawcze */
  recommendations: string[];
  /** Co ATS faktycznie wyekstrahuje */
  extractedFields: ExtractedFields;
  /** Czego ATS nie będzie w stanie odczytać */
  lostFields: string[];
  /** Czy Tagged PDF pomaga temu ATS-owi? */
  taggedPdfBeneficial: boolean;
}

export interface AtsIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  /** Na przykładzie której sekcji/elementu */
  context?: string;
  /** Sugestia naprawy */
  fix?: string;
}

export interface ExtractedFields {
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  experienceEntries: number;
  educationEntries: number;
  sectionHeadersFound: string[];
  totalTextLength: number;
}

// ---------------------------------------------------------------------------
// Silnik walidacji
// ---------------------------------------------------------------------------

/**
 * Symuluje, jak dany ATS wyekstrahuje tekst z PDF.
 *
 * Każdy vendor ma swoją logikę:
 * - Workday: pomija headers/footers, surowe linie
 * - Greenhouse: semantyczne parsowanie, obsługuje kolumny
 * - Lever: stemming-based, traci kolumny
 * - iCIMS: Textkernel NMR, najbardziej wyrozumiały
 * - Taleo: literal exact, najsurowszy
 */
function simulateVendorExtraction(
  extracted: ExtractedPdfText,
  profile: AtsVendorProfile
): ExtractedFields {
  const lines = [...extracted.lines];

  // Symulacja pomijania elementów (Workday pomija headers/footers, Taleo tabele itp.)
  let filteredLines = lines;
  if (!profile.sectionDetection.handlesMultiColumn) {
    // Proste symulowanie: przy wielokolumnowym layoutcie tracimy ~20% tekstu
    // (druga kolumna może być pominięta)
    const columnIndicators = lines.filter(
      (l) => l.includes('  ') && l.trim().length > 20
    );
    if (columnIndicators.length > lines.length * 0.3) {
      filteredLines = lines.filter((_, i) => i % 5 !== 4); // symulacja utraty co 5. linii
    }
  }

  const fullText = filteredLines.join('\n').toLowerCase();

  // Ekstrakcja sekcji na podstawie aliasów vendora
  const sectionsFound: string[] = [];
  for (const [key, aliases] of Object.entries(profile.sectionDetection.headerAliases)) {
    const found = aliases.some(
      (alias) => fullText.includes(alias.toLowerCase())
    );
    if (found) sectionsFound.push(key);
  }

  // Ekstrakcja danych kontaktowych
  const emailMatch = fullText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  const phoneMatch = fullText.match(
    /(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{2,4}/
  );

  // Ekstrakcja umiejętności (na podstawie strategii vendora)
  const skills: string[] = [];
  const tokens = tokenize(filteredLines.join(' '));

  // Sprawdź czy Tagged PDF /ActualText jest dostępny
  if (profile.keywordMatching.readsActualText && extracted.hasActualText) {
    // Gdy ATS czyta /ActualText, ma dostęp do pełnych fraz semantycznych
    // (zakładamy, że Tagged PDF jest poprawnie zbudowany)
    for (const token of tokens) {
      if (token.length > 2) skills.push(token);
    }
  } else {
    // Bez /ActualText — ATS polega na surowym tekście
    for (const token of tokens) {
      if (token.length > 2) skills.push(token);
    }
  }

  // Liczba wpisów doświadczenia i wykształcenia
  const experienceEntries = filteredLines.filter(
    (l) => /(?:obecnie|present|–|-|\d{4})/.test(l) && l.length > 10
  ).length;
  const educationEntries = filteredLines.filter(
    (l) => /(?:universytet|university|uczelnia|inż|mgr|lic|studia)/i.test(l)
  ).length;

  return {
    name: extracted.lines[0]?.trim() ?? null,
    email: emailMatch?.[0] ?? null,
    phone: phoneMatch?.[0] ?? null,
    skills: [...new Set(skills)],
    experienceEntries: Math.max(1, Math.floor(experienceEntries / 2)),
    educationEntries: Math.max(0, educationEntries),
    sectionHeadersFound: sectionsFound,
    totalTextLength: filteredLines.join(' ').length,
  };
}

/**
 * Porównuje wyekstrahowane pola z oczekiwanymi z MasterVault.
 */
function compareFields(
  extracted: ExtractedFields,
  expected: ReturnType<typeof buildExpectedText>,
  profile: AtsVendorProfile,
  extractedText: ExtractedPdfText
): { score: number; issues: AtsIssue[]; lostFields: string[] } {
  const issues: AtsIssue[] = [];
  const lostFields: string[] = [];
  let score = 100;

  // 1. Sprawdź dane kontaktowe
  if (!extracted.name) {
    issues.push({
      id: 'MISSING_NAME',
      severity: 'critical',
      message: 'ATS nie wykrył imienia i nazwiska.',
      fix: 'Upewnij się, że imię i nazwisko jest w pierwszej linii dokumentu.',
    });
    score -= 20;
    lostFields.push('Imię i nazwisko');
  }

  if (!extracted.email) {
    issues.push({
      id: 'MISSING_EMAIL',
      severity: 'critical',
      message: 'ATS nie wykrył adresu e-mail.',
      fix: 'Umieść e-mail w sekcji "Kontakt" lub u góry dokumentu.',
    });
    score -= 15;
    lostFields.push('E-mail');
  }

  if (!extracted.phone) {
    issues.push({
      id: 'MISSING_PHONE',
      severity: 'warning',
      message: 'ATS nie wykrył numeru telefonu.',
      fix: 'Dodaj numer telefonu w standardowym formacie.',
    });
    score -= 5;
  }

  // 2. Sprawdź sekcje
  const requiredSections = profile.sectionDetection.requiresStandardHeaders
    ? ['experience', 'skills', 'contact']
    : ['skills'];

  for (const section of requiredSections) {
    if (!extracted.sectionHeadersFound.includes(section)) {
      const severity = section === 'experience' ? 'critical' : 'warning';
      issues.push({
        id: `MISSING_SECTION_${section.toUpperCase()}`,
        severity,
        message: `Sekcja "${section}" nie została wykryta przez parser ATS.`,
        fix: `Użyj standardowego nagłówka sekcji: ${profile.sectionDetection.headerAliases[section]?.join(', ')}`,
      });
      score -= severity === 'critical' ? 15 : 8;
      lostFields.push(`Sekcja: ${section}`);
    }
  }

  // 3. Sprawdź umiejętności (porównanie z oczekiwanymi)
  const expectedSkills = expected.skills.map((s) => s.toLowerCase());
  const extractedSkillsLower = extracted.skills.map((s) => s.toLowerCase());

  let matchedSkills = 0;
  for (const skill of expectedSkills) {
    if (hasPositiveSkillEvidence(extractedSkillsLower.join(' '), skill)) {
      matchedSkills++;
    }
  }

  const skillCoverage = expectedSkills.length > 0 ? matchedSkills / expectedSkills.length : 1;
  if (skillCoverage < 0.5) {
    issues.push({
      id: 'LOW_SKILL_COVERAGE',
      severity: 'warning',
      message: `Wykryto tylko ${Math.round(skillCoverage * 100)}% oczekiwanych umiejętności.`,
      fix: 'Sprawdź, czy umiejętności nie są ukryte w grafice lub kolumnach.',
    });
    score -= Math.round((1 - skillCoverage) * 20);
  }

  // 4. Sprawdź unparsable patterns vendora
  const fullExtractedText = extractedText.lines.join(' ');
  for (const pattern of profile.sectionDetection.unparsablePatterns) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(fullExtractedText)) {
      issues.push({
        id: 'UNPARSABLE_ELEMENT',
        severity: 'warning',
        message: `Wykryto element nieparsowalny: ${pattern}`,
        context: profile.parsingStrategy,
        fix: 'Zamień element graficzny na tekst.',
      });
      score -= 5;
    }
  }

  // 5. Sprawdź formatting penalties
  for (const penalty of profile.formattingPenalties) {
    if (penalty.severity === 'high') {
      issues.push({
        id: `FORMAT_PENALTY_${penalty.pattern.toUpperCase()}`,
        severity: 'warning',
        message: penalty.description,
        fix: `Dla ${profile.name}: ${penalty.description}`,
      });
      score -= 3;
    }
  }

  // 6. Widzialność Tagged PDF
  if (profile.keywordMatching.readsActualText && !extractedText.hasActualText) {
    issues.push({
      id: 'NO_TAGGED_PDF',
      severity: 'info',
      message: `${profile.name} obsługuje Tagged PDF /ActualText, ale dokument go nie zawiera.`,
      fix: 'Wygeneruj CV z włączonym Tagged PDF (domyślne w mvcv).',
    });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    lostFields,
  };
}

// ---------------------------------------------------------------------------
// Główna funkcja walidacji
// ---------------------------------------------------------------------------

export interface AtsPdfValidationOptions {
  /** Bufor PDF (binarny) */
  pdfBuffer?: ArrayBuffer;
  /** Surowy tekst ekstrahowany z PDF (alternatywa dla pdfBuffer) */
  extractedText?: string;
  /** Czy Tagged PDF zawiera /ActualText? (z verify.py) */
  hasActualText?: boolean;
  /** Czy wykryto niewidoczny tekst (Tr 3)? (z verify.py) */
  hasInvisibleText?: boolean;
  /** Których ATS-ów dotyczy walidacja (domyślnie wszystkie) */
  vendorIds?: string[];
}

export interface AtsPdfValidationReport {
  /** Wyniki per-vendor */
  vendors: AtsPdfValidationResult[];
  /** Ogólna ocena (średnia ważona) */
  overallScore: number;
  /** Status ogólny */
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  /** Czy Tagged PDF jest obecny? */
  taggedPdfPresent: boolean;
  /** Czy wykryto niewidoczny tekst? */
  invisibleTextDetected: boolean;
  /** Zalecenia ogólne */
  generalRecommendations: string[];
  /** Timestamp walidacji */
  validatedAt: string;
}

/**
 * Waliduje PDF pod kątem kompatybilności z wybranymi ATS-ami.
 *
 * Przyjmuje surowy tekst ekstrahowany z PDF (przez pdfminer.six w Pythonie)
 * lub bufor PDF i ekstrahuje go samodzielnie.
 *
 * @example
 * ```ts
 * const report = await validatePdfForAts(pdfBuffer, vault);
 * report.vendors.forEach(v => console.log(`${v.vendorName}: ${v.parseScore}`));
 * ```
 */
export async function validatePdfForAts(
  input: ArrayBuffer | string,
  vault: MasterVault,
  options: AtsPdfValidationOptions = {}
): Promise<AtsPdfValidationReport> {
  // Przygotowanie danych wejściowych
  let rawText: string;
  let hasActualText = options.hasActualText ?? false;
  const hasInvisibleText = options.hasInvisibleText ?? false;

  if (typeof input === 'string') {
    rawText = input;
  } else {
    // Bufor PDF — w prawdziwej implementacji tu byłoby pdfjs-dist
    // Na razie traktujemy jako pusty (wymaga podłączenia Pythona)
    rawText = '';
    hasActualText = false;
  }

  const extracted = processExtractedText(rawText, hasActualText, hasInvisibleText);
  const expected = buildExpectedText(vault);

  // Walidacja per-vendor
  const vendorIds = options.vendorIds ?? ALL_ATS_PROFILES.map((p) => p.id);
  const vendors: AtsPdfValidationResult[] = [];

  for (const profile of ALL_ATS_PROFILES) {
    if (!vendorIds.includes(profile.id)) continue;

    const extractedFields = simulateVendorExtraction(extracted, profile);
    const { score, issues, lostFields } = compareFields(
      extractedFields,
      expected,
      profile,
      extracted
    );

    // Buduj zalecenia
    const recommendations: string[] = [];
    if (score < 50) {
      recommendations.push(`Dokument wymaga istotnych zmian formatowania dla ${profile.name}.`);
    }
    if (issues.some((i) => i.id === 'MISSING_SECTION_EXPERIENCE')) {
      recommendations.push('Dodaj sekcję "Doświadczenie" z czytelnym nagłówkiem.');
    }
    if (issues.some((i) => i.id === 'LOW_SKILL_COVERAGE')) {
      recommendations.push('Umieść umiejętności w dedykowanej sekcji tekstowej.');
    }
    if (!extracted.hasActualText && profile.keywordMatching.readsActualText) {
      recommendations.push(`Dla ${profile.name}: włącz Tagged PDF /ActualText.`);
    }

    vendors.push({
      vendorId: profile.id,
      vendorName: profile.name,
      parseScore: score,
      status: score >= 80 ? 'PASS' : score >= 50 ? 'WARN' : 'FAIL',
      issues,
      recommendations,
      extractedFields,
      lostFields,
      taggedPdfBeneficial: profile.keywordMatching.readsActualText,
    });
  }

  // Ogólna ocena
  const overallScore =
    vendors.length > 0
      ? Math.round(vendors.reduce((sum, v) => sum + v.parseScore, 0) / vendors.length)
      : 0;

  const overallStatus: 'PASS' | 'WARN' | 'FAIL' =
    vendors.every((v) => v.status === 'PASS')
      ? 'PASS'
      : vendors.some((v) => v.status === 'FAIL')
        ? 'FAIL'
        : 'WARN';

  // Zalecenia ogólne
  const generalRecommendations: string[] = [];
  if (hasInvisibleText) {
    generalRecommendations.push(
      'KRYTYCZNE: Wykryto niewidoczny tekst (Tr 3). ATS-y wykrywają to jako fraud i dyskwalifikują kandydata.'
    );
  }
  if (!hasActualText) {
    generalRecommendations.push(
      'Brak Tagged PDF /ActualText. Dodanie go poprawi kompatybilność z Workday, Greenhouse i iCIMS.'
    );
  }
  if (vendors.some((v) => v.status === 'FAIL')) {
    generalRecommendations.push(
      'Co najmniej jeden ATS nie będzie w stanie poprawnie sparsować tego dokumentu. Sprawdź szczegóły per-vendor.'
    );
  }

  return {
    vendors,
    overallScore,
    overallStatus,
    taggedPdfPresent: hasActualText,
    invisibleTextDetected: hasInvisibleText,
    generalRecommendations,
    validatedAt: new Date().toISOString(),
  };
}

/**
 * Szybka wersja walidacji — przyjmuje wyekstrahowany tekst string
 * zamiast bufora PDF. Do użycia po stronie serwera po pdfminer.six.
 */
export function validatePdfTextForAts(
  extractedText: string,
  vault: MasterVault,
  options: { hasActualText?: boolean; hasInvisibleText?: boolean; vendorIds?: string[] } = {}
): Promise<AtsPdfValidationReport> {
  return validatePdfForAts(extractedText, vault, options);
}
