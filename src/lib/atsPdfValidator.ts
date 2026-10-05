/**
 * Lokalny przegląd wyekstrahowanego tekstu według konfigurowalnych profili reguł.
 *
 * Porównuje wyekstrahowany tekst z oczekiwaną treścią z MasterVault.
 * Nazwy profili ATS służą do grupowania aliasów i wzorców. Moduł nie uruchamia
 * parserów dostawców ani nie prognozuje zgodności z ich wdrożeniami.
 *
 * Nie wylicza wyniku parsowalności ani nie stwierdza, co faktycznie wyekstrahuje ATS.
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
  /** Wykryte problemy */
  issues: AtsIssue[];
  /** Zalecenia naprawcze */
  recommendations: string[];
  /** Pola dopasowane w tekście przez lokalne reguły profilu */
  extractedFields: ExtractedFields;
  /** Pola profilu, których nie znaleziono w wyekstrahowanym tekście */
  notFoundFields: string[];
  /** Czy konfiguracja tego profilu reguł uwzględnia /ActualText? */
  profileReadsActualText: boolean;
}

export interface AtsIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  /** Sugestia naprawy */
  fix?: string;
}

export interface ExtractedFields {
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  sectionHeadersFound: string[];
  totalTextLength: number;
}

// ---------------------------------------------------------------------------
// Silnik walidacji
// ---------------------------------------------------------------------------

/**
 * Sprawdza wyekstrahowany tekst zestawem jawnych lokalnych reguł.
 *
 * Profil regułowy dopasowuje tekst do oczekiwanych danych i aliasów sekcji.
 * Sam tekst po ekstrakcji nie zawiera geometrii kolumn ani tabel, więc ten
 * moduł nie symuluje ich obsługi przez poszczególnych vendorów.
 */
function inspectTextWithRuleProfile(
  extracted: ExtractedPdfText,
  profile: AtsVendorProfile,
  expected: ReturnType<typeof buildExpectedText>
): ExtractedFields {
  const lines = [...extracted.lines];
  const filteredLines = lines;

  const fullText = filteredLines.join('\n').toLowerCase();
  const sectionText = filteredLines.map((line) => {
    const parts = line.toLowerCase().trim().split(/\s+/);
    return parts.length >= 3 && parts.every((part) => part.length === 1 && /^\p{L}$/u.test(part))
      ? parts.join('')
      : line.toLowerCase();
  }).join('\n');

  // Ekstrakcja sekcji na podstawie aliasów vendora
  const sectionsFound: string[] = [];
  for (const [key, aliases] of Object.entries(profile.sectionDetection.headerAliases)) {
    const found = aliases.some(
      (alias) => sectionText.includes(alias.toLowerCase())
    );
    if (found) sectionsFound.push(key);
  }

  // Ekstrakcja danych kontaktowych
  const emailCandidates = [...fullText.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map(([value]) => value);
  const expectedEmail = expected.contactInfo.emails.find((value) =>
    emailCandidates.includes(value.toLowerCase())
  );
  const phoneCandidates = [...fullText.matchAll(/(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{2,4}/g)]
    .map(([value]) => value);
  const matchedPhone = expected.contactInfo.phones.flatMap((expectedValue) => {
    const digits = expectedValue.replace(/\D/g, '');
    return digits ? phoneCandidates.find((candidate) => candidate.replace(/\D/g, '') === digits) ?? [] : [];
  })[0];
  const normalizeName = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const expectedName = normalizeName(expected.contactInfo.name);
  // PDF-extractors may put a document label or another header before the name;
  // without layout geometry, the first extracted line is not reliable evidence
  // that the candidate's name is missing.
  const normalizedText = ` ${normalizeName(filteredLines.join(' '))} `;
  const extractedName = expectedName && normalizedText.includes(` ${expectedName} `)
    ? expected.contactInfo.name
    : null;

  // To analiza tokenów z dostarczonego ekstraktu, nie wynik parsera ATS.
  const skills = tokenize(filteredLines.join(' ')).filter((token) => token.length > 2);

  return {
    name: extractedName,
    email: expectedEmail ?? null,
    phone: matchedPhone ?? null,
    skills: [...new Set(skills)],
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
  extractedText: ExtractedPdfText,
  actualTextMetadataProvided: boolean
): { issues: AtsIssue[]; notFoundFields: string[] } {
  const issues: AtsIssue[] = [];
  const notFoundFields: string[] = [];

  // 1. Sprawdź dane kontaktowe
  if (expected.contactInfo.name && !extracted.name) {
    issues.push({
      id: 'MISSING_NAME',
      severity: 'critical',
      message: 'W wyekstrahowanym tekście nie znaleziono imienia i nazwiska z profilu.',
      fix: 'Sprawdź, czy imię i nazwisko z profilu jest czytelne i obecne w wyekstrahowanym tekście CV.',
    });
    notFoundFields.push('Imię i nazwisko');
  }

  if (expected.contactInfo.emails.length > 0 && !extracted.email) {
    issues.push({
      id: 'MISSING_EMAIL',
      severity: 'critical',
      message: 'W wyekstrahowanym tekście nie znaleziono adresu e-mail z profilu.',
      fix: 'Umieść e-mail w sekcji "Kontakt" lub u góry dokumentu.',
    });
    notFoundFields.push('E-mail');
  }

  if (expected.contactInfo.phones.length > 0 && !extracted.phone) {
    issues.push({
      id: 'MISSING_PHONE',
      severity: 'warning',
      message: 'W wyekstrahowanym tekście nie znaleziono numeru telefonu z profilu.',
      fix: 'Dodaj numer telefonu w standardowym formacie.',
    });
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
        message: `W wyekstrahowanym tekście nie znaleziono rozpoznanego nagłówka sekcji "${section}" dla tego profilu reguł.`,
        fix: `Użyj standardowego nagłówka sekcji: ${profile.sectionDetection.headerAliases[section]?.join(', ')}`,
      });
      notFoundFields.push(`Sekcja: ${section}`);
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
        fix: 'Zamień element graficzny na tekst.',
      });
    }
  }

  // 5. Widzialność Tagged PDF
  if (actualTextMetadataProvided && profile.keywordMatching.readsActualText && !extractedText.hasActualText) {
    issues.push({
      id: 'NO_ACTUALTEXT_SIGNAL',
      severity: 'info',
      message: `Konfiguracja profilu ${profile.name} uwzględnia /ActualText, ale ekstrakcja nie zawiera sygnału o jego obecności.`,
    });
  }

  return { issues, notFoundFields };
}

// ---------------------------------------------------------------------------
// Główna funkcja walidacji
// ---------------------------------------------------------------------------

export interface AtsPdfValidationOptions {
  /** Surowy tekst ekstrahowany z PDF */
  extractedText?: string;
  /** Czy Tagged PDF zawiera /ActualText? (z verify.py) */
  hasActualText?: boolean | null;
  /** Czy wykryto niewidoczny tekst (Tr 3)? (z verify.py) */
  hasInvisibleText?: boolean | null;
  /** Których ATS-ów dotyczy walidacja (domyślnie wszystkie) */
  vendorIds?: string[];
}

export interface AtsPdfValidationReport {
  /** Wyniki per-vendor */
  vendors: AtsPdfValidationResult[];
  /** Czy Tagged PDF jest obecny? */
  taggedPdfPresent: boolean | null;
  /** Czy wykryto niewidoczny tekst? */
  invisibleTextDetected: boolean | null;
  /** Zalecenia ogólne */
  generalRecommendations: string[];
  /** Timestamp walidacji */
  validatedAt: string;
}

/**
 * Przegląda tekst PDF według wybranych lokalnych profili reguł.
 *
 * Przyjmuje surowy tekst ekstrahowany z PDF (przez pdfminer.six w Pythonie).
 * Bufor binarny bez tekstu ekstrakcji zwraca pustą listę wyników i wyjaśnienie,
 * bo ten moduł nie zawiera własnego parsera PDF.
 *
 * @example
 * ```ts
 * const report = await validatePdfForAts(extractedPdfText, vault);
 * report.vendors.forEach(v => console.log(`${v.vendorName}: ${v.issues.length} reguł do sprawdzenia`));
 * ```
 */
export async function validatePdfForAts(
  input: ArrayBuffer | string,
  vault: MasterVault,
  options: AtsPdfValidationOptions = {}
): Promise<AtsPdfValidationReport> {
  // Przygotowanie danych wejściowych
  let rawText: string;
  const binaryInputNotExtracted = typeof input !== 'string' && options.extractedText === undefined;
  const hasActualText = binaryInputNotExtracted ? null : options.hasActualText ?? null;
  const hasInvisibleText = binaryInputNotExtracted ? null : options.hasInvisibleText ?? null;

  if (typeof input === 'string') {
    rawText = input;
  } else {
    rawText = options.extractedText ?? '';
  }

  const extracted = processExtractedText(rawText, hasActualText === true, hasInvisibleText === true);
  const expected = buildExpectedText(vault);

  // Walidacja per-vendor
  const vendorIds = options.vendorIds ?? ALL_ATS_PROFILES.map((p) => p.id);
  const vendors: AtsPdfValidationResult[] = [];

  for (const profile of ALL_ATS_PROFILES) {
    if (binaryInputNotExtracted) break;
    if (!vendorIds.includes(profile.id)) continue;

    const extractedFields = inspectTextWithRuleProfile(extracted, profile, expected);
    const { issues, notFoundFields } = compareFields(
      extractedFields,
      expected,
      profile,
      extracted,
      hasActualText !== null
    );

    // Buduj zalecenia
    const recommendations: string[] = [];
    if (issues.some((i) => i.id === 'MISSING_SECTION_EXPERIENCE')) {
      recommendations.push('Dodaj sekcję "Doświadczenie" z czytelnym nagłówkiem.');
    }
    if (issues.some((i) => i.id === 'LOW_SKILL_COVERAGE')) {
      recommendations.push('Umieść umiejętności w dedykowanej sekcji tekstowej.');
    }
    vendors.push({
      vendorId: profile.id,
      vendorName: profile.name,
      issues,
      recommendations,
      extractedFields,
      notFoundFields,
      profileReadsActualText: profile.keywordMatching.readsActualText,
    });
  }

  // Zalecenia ogólne
  const generalRecommendations: string[] = [];
  if (binaryInputNotExtracted) {
    generalRecommendations.push('Walidacji nie wykonano: przekazano bufor PDF bez tekstu wyekstrahowanego przez parser PDF.');
  } else if (vendors.length === 0) {
    generalRecommendations.push('Nie wybrano rozpoznanego profilu regułowego, więc walidacja nie została wykonana.');
  }
  if (hasInvisibleText) {
    generalRecommendations.push(
      'Wykryto niewidoczny tekst (Tr 3). Sprawdź, czy odpowiada widocznej treści CV; ten raport nie ustala jego przeznaczenia ani reakcji konkretnego ATS.'
    );
  }
  if (!binaryInputNotExtracted) {
    generalRecommendations.push('Analiza dotyczy wyekstrahowanego tekstu; nie ocenia geometrii kolumn, tabel, nagłówków ani kolejności czytania w układzie PDF.');
  }
  return {
    vendors,
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
  options: Pick<AtsPdfValidationOptions, 'hasActualText' | 'hasInvisibleText' | 'vendorIds'> = {}
): Promise<AtsPdfValidationReport> {
  return validatePdfForAts(extractedText, vault, options);
}
