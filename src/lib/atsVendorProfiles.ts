/**
 * Profile parserów poszczególnych ATS-ów — na podstawie researchu empirycznego.
 *
 * Każdy profil opisuje, jak dany ATS:
 * 1. Ekstrahuje tekst z PDF (co pomija, co traktuje jako nagłówek)
 * 2. Dopasowuje słowa kluczowe (exact match, stemming, semantyka)
 * 3. Klasyfikuje sekcje (Experience, Education, Skills)
 * 4. Interpretuje daty i formatowanie
 *
 * Źródła:
 * - resume-parse-harness (AlanRoybal) — live replay na Workday/Greenhouse/Lever/iCIMS
 * - ats-screener (sunnypatell) — badanie profili 6 ATS-ów
 * - hireflow.net/blog/workday-vs-greenhouse-vs-lever
 * - Greenhouse Candidate Help Center
 * - Workday CXS documentation
 * - Lever parseResume endpoint behavior
 * - iCIMS Textkernel (ex-Sovren) integration docs
 *
 * UWAGA: To NIE jest emulacja prawdziwych parserów. To profile opisujące
 * znane zachowania na podstawie publicznych danych i testów empircznych.
 * Wynik symulacji nie jest gwarantowanym wynikiem prawdziwego ATS-a.
 */

export interface AtsVendorProfile {
  id: string;
  name: string;
  vendor: string;
  /** Krótki opis podejścia do parsowania */
  parsingStrategy: string;
  /** Jak traktuje nagłówki sekcji */
  sectionDetection: SectionDetectionProfile;
  /** Jak dopasowuje słowa kluczowe */
  keywordMatching: KeywordMatchingProfile;
  /** Jak interpretuje daty */
  dateFormatting: DateFormatProfile;
  /** Co pomija lub traktuje specjalnie */
  ignores: string[];
  /** Dodatkowe kary za formatowanie */
  formattingPenalties: FormattingPenalty[];
  /** Czy obsługuje Tagged PDF /ActualText? */
  supportsTaggedPdf: boolean;
  /** Czy czyta JSON-LD metadata? */
  readsJsonLd: boolean;
  /** Priorytet: 1 = najsurowszy, 5 = najbardziej wyrozumiały */
  strictness: 1 | 2 | 3 | 4 | 5;
}

export interface SectionDetectionProfile {
  /** Aliasy nagłówków sekcji, które rozpoznaje (case-insensitive) */
  headerAliases: Record<string, string[]>;
  /** Czy wymaga standardowych nagłówków? */
  requiresStandardHeaders: boolean;
  /** Czy obsługuje dwie kolumny? */
  handlesMultiColumn: boolean;
  /** Co traktuje jako nieparsowalne */
  unparsablePatterns: string[];
}

export interface KeywordMatchingProfile {
  /** exact match, stemming, semantic (LLM-based), taxonomy */
  strategy: 'exact' | 'stemming' | 'semantic' | 'taxonomy' | 'hybrid';
  /** Czy normalizuje akronimy (AWS = Amazon Web Services)? */
  normalizesAcronyms: boolean;
  /** Czy obsługuje alternatywne nazwy (React.js = React)? */
  handlesAliases: boolean;
  /** Czy Penalizuje duplikaty? */
  penalizesDuplicates: boolean;
  /** Czy czyta /ActualText z Tagged PDF? */
  readsActualText: boolean;
}

export interface DateFormatProfile {
  /** Obsługiwane formaty dat */
  supportedFormats: string[];
  /** Co robi z niepoprawnymi datami */
  invalidDateBehavior: 'ignore' | 'flag' | 'reject';
  /** Czy wymaga zakresu dat (start-end)? */
  requiresDateRange: boolean;
}

export interface FormattingPenalty {
  pattern: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

// ---------------------------------------------------------------------------
// Profile vendorów
// ---------------------------------------------------------------------------

export const WORKDAY_PROFILE: AtsVendorProfile = {
  id: 'workday',
  name: 'Workday ATS',
  vendor: 'Workday',
  parsingStrategy: 'Własny NER (CXS). Surowe parsowanie tekstu z pominięciem nagłówków/stopkek. Wymaga standardowych sekcji.',
  sectionDetection: {
    headerAliases: {
      experience: ['doświadczenie', 'work experience', 'historia zatrudnienia', 'employment history'],
      education: ['wykształcenie', 'education', 'edukacja'],
      skills: ['umiejętności', 'skills', 'technologie', 'tools'],
      contact: ['kontakt', 'contact', 'dane osobowe'],
    },
    requiresStandardHeaders: true,
    handlesMultiColumn: false,
    unparsablePatterns: ['\\*\\*\\*', '●●●', '■■■', '▶'],
  },
  keywordMatching: {
    strategy: 'exact',
    normalizesAcronyms: true,
    handlesAliases: false,
    penalizesDuplicates: false,
    readsActualText: true,
  },
  dateFormatting: {
    supportedFormats: ['MM/YYYY', 'YYYY-MM-DD', 'MMMM YYYY', 'MM/DD/YYYY'],
    invalidDateBehavior: 'flag',
    requiresDateRange: true,
  },
  ignores: ['headers/footers', 'text boxes', 'text boxes with opacity < 10%', 'tables with borders'],
  formattingPenalties: [
    { pattern: 'columns', description: ' Układy wielokolumnowe mogą być parsowane liniowo', severity: 'medium' },
    { pattern: 'tables', description: 'Tabele mogą być traktowane jako ciągły tekst', severity: 'low' },
    { pattern: 'headers', description: 'Nagłówki i stopki są pomijane', severity: 'medium' },
  ],
  supportsTaggedPdf: true,
  readsJsonLd: false,
  strictness: 2,
};

export const GREENHOUSE_PROFILE: AtsVendorProfile = {
  id: 'greenhouse',
  name: 'Greenhouse ATS',
  vendor: 'Greenhouse',
  parsingStrategy: 'Natywne parsowanie + NER. Obsługuje semantyczne dopasowanie (LLM-based). Nie automatyzuje scoringu — decyzja ludzka.',
  sectionDetection: {
    headerAliases: {
      experience: ['doświadczenie', 'work experience', 'employment', 'career'],
      education: ['wykształcenie', 'education'],
      skills: ['umiejętności', 'skills', 'technologie', 'tools', 'competencies'],
      contact: ['kontakt', 'contact'],
    },
    requiresStandardHeaders: false,
    handlesMultiColumn: true,
    unparsablePatterns: ['★', '☆', '●', '◐', '◑'],
  },
  keywordMatching: {
    strategy: 'semantic',
    normalizesAcronyms: true,
    handlesAliases: true,
    penalizesDuplicates: false,
    readsActualText: true,
  },
  dateFormatting: {
    supportedFormats: ['MM/YYYY', 'YYYY-MM-DD', 'MMMM YYYY', 'Mon YYYY'],
    invalidDateBehavior: 'ignore',
    requiresDateRange: false,
  },
  ignores: ['decorative elements', 'images without alt text', 'colored text on white background'],
  formattingPenalties: [
    { pattern: 'columns', description: 'Wielokolumnowy layout obsługiwany', severity: 'low' },
    { pattern: 'pdf_tables', description: 'Tabele PDF parsowane jako tekst', severity: 'low' },
  ],
  supportsTaggedPdf: true,
  readsJsonLd: true,
  strictness: 3,
};

export const LEVER_PROFILE: AtsVendorProfile = {
  id: 'lever',
  name: 'Lever ATS',
  vendor: 'Employ (Lever)',
  parsingStrategy: 'Backendowe parsowanie przez /parseResume. Stemming-based. Nie rankuje — search-dependent. Abbreviation-blind.',
  sectionDetection: {
    headerAliases: {
      experience: ['doświadczenie', 'work experience', 'employment', 'history'],
      education: ['wykształcenie', 'education'],
      skills: ['umiejętności', 'skills', 'technologies'],
      contact: ['kontakt', 'contact'],
    },
    requiresStandardHeaders: true,
    handlesMultiColumn: false,
    unparsablePatterns: ['•', '▸', '▪', '●'],
  },
  keywordMatching: {
    strategy: 'stemming',
    normalizesAcronyms: false,
    handlesAliases: false,
    penalizesDuplicates: false,
    readsActualText: true,
  },
  dateFormatting: {
    supportedFormats: ['MM/YYYY', 'YYYY-MM-DD', 'MMM YYYY'],
    invalidDateBehavior: 'flag',
    requiresDateRange: true,
  },
  ignores: ['headers/footers', 'tables', 'text boxes', 'images', 'graphics'],
  formattingPenalties: [
    { pattern: 'columns', description: 'Parsuje liniowo, kolumny traci', severity: 'high' },
    { pattern: 'headers', description: 'Nagłówki/stopki pomijane', severity: 'medium' },
    { pattern: 'pdf_forms', description: 'Formularze PDF nieobsługiwane', severity: 'high' },
  ],
  supportsTaggedPdf: false,
  readsJsonLd: false,
  strictness: 4,
};

export const ICIMS_PROFILE: AtsVendorProfile = {
  id: 'icims',
  name: 'iCIMS ATS',
  vendor: 'iCIMS (Textkernel / ex-Sovren)',
  parsingStrategy: 'Textkernel NER + gramatyczny parser. Najbardziej wyrozumiały. Role Fit AI. Semantic ML-based.',
  sectionDetection: {
    headerAliases: {
      experience: ['doświadczenie', 'work experience', 'employment', 'career history', 'professional experience'],
      education: ['wykształcenie', 'education', 'academic background'],
      skills: ['umiejętności', 'skills', 'technologies', 'competencies', 'core competencies'],
      contact: ['kontakt', 'contact', 'personal information'],
    },
    requiresStandardHeaders: false,
    handlesMultiColumn: true,
    unparsablePatterns: [],
  },
  keywordMatching: {
    strategy: 'semantic',
    normalizesAcronyms: true,
    handlesAliases: true,
    penalizesDuplicates: false,
    readsActualText: true,
  },
  dateFormatting: {
    supportedFormats: ['MM/YYYY', 'YYYY-MM-DD', 'MMMM YYYY', 'Mon YYYY', 'DD.MM.YYYY', 'YYYY/MM/DD'],
    invalidDateBehavior: 'ignore',
    requiresDateRange: false,
  },
  ignores: ['decorative elements'],
  formattingPenalties: [
    { pattern: 'columns', description: 'Wielokolumnowe obsługiwane', severity: 'low' },
    { pattern: 'tables', description: 'Tabele parsowane z NPC', severity: 'low' },
  ],
  supportsTaggedPdf: true,
  readsJsonLd: true,
  strictness: 5,
};

export const TALEO_PROFILE: AtsVendorProfile = {
  id: 'taleo',
  name: 'Taleo ATS',
  vendor: 'Oracle (Taleo)',
  parsingStrategy: 'Literal exact match. Najsurowsze dopasowanie słów kluczowych. Auto-reject via Req Rank.',
  sectionDetection: {
    headerAliases: {
      experience: ['doświadczenie', 'work experience', 'employment history'],
      education: ['wykształcenie', 'education'],
      skills: ['umiejętności', 'skills'],
      contact: ['kontakt', 'contact'],
    },
    requiresStandardHeaders: true,
    handlesMultiColumn: false,
    unparsablePatterns: ['\\*\\*', '●', '■', '◆'],
  },
  keywordMatching: {
    strategy: 'exact',
    normalizesAcronyms: false,
    handlesAliases: false,
    penalizesDuplicates: true,
    readsActualText: true,
  },
  dateFormatting: {
    supportedFormats: ['MM/DD/YYYY', 'YYYY-MM-DD'],
    invalidDateBehavior: 'reject',
    requiresDateRange: true,
  },
  ignores: ['headers/footers', 'text boxes', 'tables', 'columns', 'images', 'graphics', 'anything non-linear'],
  formattingPenalties: [
    { pattern: 'columns', description: 'Wielokolumnowe NIEobsługiwane — odrzuca', severity: 'high' },
    { pattern: 'tables', description: 'Tabele traktowane jako ciągły tekst', severity: 'high' },
    { pattern: 'headers', description: 'Nagłówki/stopki pomijane', severity: 'high' },
    { pattern: 'non_standard_headers', description: 'Niestandardowe nagłówki = brak sekcji', severity: 'high' },
  ],
  supportsTaggedPdf: false,
  readsJsonLd: false,
  strictness: 1,
};

export const ALL_ATS_PROFILES: AtsVendorProfile[] = [
  WORKDAY_PROFILE,
  GREENHOUSE_PROFILE,
  LEVER_PROFILE,
  ICIMS_PROFILE,
  TALEO_PROFILE,
];

export function getAtsProfile(id: string): AtsVendorProfile | undefined {
  return ALL_ATS_PROFILES.find((p) => p.id === id);
}
