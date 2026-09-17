import { AtsCheckResult, FlagCategory, MasterVault, TailoredResume, LemmatizedMatch } from '../types';
import {
  getPolishStem as canonicalPolishStem,
  hasPositiveSkillEvidence,
  containsPhrase,
} from './skillEvidence';
import { ALL_LICENSES } from '../data/licenses';
import { auditKnockouts } from './knockouts';

/** Etykiety uprawnień do korpusu tekstowego (F3) — identyfikator `c_license` nic nie znaczy dla matchera. */
const ALL_LICENSE_LABELS: Record<string, string> = Object.fromEntries(
  ALL_LICENSES.map((l) => [l.id, l.label])
);

/**
 * Zalecenia posortowane pod profil kandydata.
 *
 * `FlagCategory` był zadeklarowany w typach i zapisywany w profilu, ale żaden
 * scoring go nie odczytywał — istniał, nie znacząc nic. Tu zaczyna znaczyć:
 * przy pracy fizycznej rekrutacja jest wolumenowa i odsiewa mechanicznie, więc
 * czytelność dokumentu dla parsera i wymagania formalne decydują wcześniej niż
 * gęstość słów kluczowych. Przy pracy biurowej kolejność zostaje dotychczasowa.
 *
 * Świadomie zmieniamy **kolejność, nie wynik**. Ta sama treść CV nie może
 * dostawać różnych ocen zależnie od checkboxa w profilu — to byłoby mierzenie
 * czegoś innego niż deklaruje nazwa „wynik ATS".
 */
const PHYSICAL_PRIORITY = ['Struktura PDF', 'Sekcje', 'Format dat', 'Słowa twarde'];

function prioritizeForProfile(recommendations: string[], profile: FlagCategory): string[] {
  if (profile !== 'PHYSICAL') return recommendations;

  const rank = (text: string): number => {
    const index = PHYSICAL_PRIORITY.findIndex((prefix) => text.startsWith(prefix));
    return index === -1 ? PHYSICAL_PRIORITY.length : index;
  };

  // Stabilne sortowanie: pozycje o tym samym priorytecie zachowują kolejność,
  // w której zostały wygenerowane.
  return recommendations
    .map((text, index) => ({ text, index, rank: rank(text) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.text);
}

/**
 * Polish Stemming helper — re-eksport kanonicznej implementacji z `skillEvidence`
 * (jedno źródło prawdy morfologii, reguła 3). Zachowane dla kompatybilności
 * importerów (`atsScorer.ts`).
 */
export function getPolishStem(word: string): string {
  return canonicalPolishStem(word);
}

/**
 * Czy fraza z oferty ma POZYTYWNY dowód w tekście kandydata.
 *
 * Wcześniej był tu podciąg (`normB.includes(normA)`) i prefiksy rdzeni
 * (`startsWith` w obie strony), więc `java` pasowało do `javascript`,
 * `go` do `good`, `ai` do `pain`, a `I do not know Python` do `python`.
 * Deleguje do kanonicznego `hasPositiveSkillEvidence` (granice Unicode,
 * jawne aliasy, negacja, nauka, wyciek wymagań).
 *
 * Konwencja argumentów bez zmian: `isLemmatizedMatch(fraza z JD, tekst CV)`.
 */
export function isLemmatizedMatch(phraseA: string, phraseB: string): boolean {
  const normA = (phraseA ?? '').trim();
  const normB = (phraseB ?? '').trim();

  // Pusty łańcuch jest podciągiem każdego tekstu (`'docker'.includes('')`),
  // więc bez tego guarda puste CV „pasowało" do każdej frazy z oferty i pusty
  // profil dostawał 100% pokrycia twardych umiejętności. Śmieci
  // interpunkcyjne (`---`) też nie są dowodem — pilnuje tego matcher.
  if (!normA || !normB) return false;

  return hasPositiveSkillEvidence(normB, normA);
}

/**
 * Known stop words, HR boilerplate terms, section headers, prepositions and filler words
 * that should NEVER be flagged as missing skills in ATS parsing when standalone.
 */
export const HR_AND_COMMON_STOP_WORDS = new Set([
  // Organizational Verbs (Czasowniki organizacyjne)
  'potrzebujemy', 'szukamy', 'poszukujemy', 'poszukuje', 'oczekujemy', 'oczekuje', 'oferujemy', 'oferuje',
  'dołącz', 'zapewniamy', 'wymagamy', 'wymaga', 'doceniamy', 'zatrudnimy', 'zatrudni', 'rekrutujemy',
  'tworzymy', 'prowadzimy', 'chcemy', 'zapraszamy', 'gwarantujemy', 'zastrzegamy', 'kontaktujemy',

  // Framing Nouns / Meta-language of Job Ads (Rzeczowniki ramowe)
  'oprogramowanie', 'oprogramowania', 'znajomość', 'znajomości', 'doświadczenie', 'doświadczenia',
  'umiejętność', 'umiejętności', 'praca', 'pracy', 'zespół', 'zespołu', 'kandydat', 'kandydata',
  'wymagania', 'wymagań', 'obowiązki', 'obowiązków', 'zakres', 'zakresie', 'zadań', 'zadania',
  'profil', 'zapewniamy', 'opis', 'stanowisko', 'stanowisku', 'firma', 'firmy', 'klient', 'klienta',
  'pracownik', 'pracownika', 'aplikacja', 'aplikacji', 'poziom', 'poziomu', 'tytuł', 'dyplom',
  'projekty', 'projektów', 'rozwój', 'rozwoju', 'osoba', 'osoby', 'materiały', 'materiałów',
  'działań', 'działania', 'grupa', 'obszar', 'obszarze', 'system', 'systemy', 'rozwiązania',
  'potrzeby', 'potrzeb', 'wyzwania', 'wyzwań', 'miejsce', 'miejscu', 'rekrutacja', 'rekrutacji',
  'kontakt', 'zgoda', 'zgody', 'lokalizacja', 'oferta', 'oferty', 'rodo', 'znajomo', 'umiej',

  // Frame Adjectives & Filler Words (Przymiotniki i zapychacze)
  'mile', 'widziane', 'widziana', 'dodatkowy', 'atut', 'atutem', 'niezbędne', 'dobra', 'bardzo',
  'praktyczna', 'praktycznej', 'płynna', 'biegła', 'biegłość', 'wysoka', 'min', 'minimum',
  'max', 'maksimum', 'lat', 'lata', 'roku', 'roczne', 'miesięcy', 'bieżącej', 'przyszłych',
  'wybranych', 'zgodnie', 'art', 'klauzula', 'klauzuli', 'danych', 'osobowych',

  // Prepositions, Conjunctions & Grammar (Spójniki, zaimki, przyimki)
  'i', 'w', 'z', 'na', 'do', 'dla', 'o', 'ze', 'za', 'po', 'od', 'pod', 'nad', 'oraz', 'lub', 'albo',
  'czy', 'ale', 'lecz', 'jak', 'tak', 'co', 'to', 'jest', 'są', 'być', 'może', 'móc', 'musi', 'powinien',
  'naszego', 'naszej', 'naszym', 'swoim', 'twojego', 'twojej', 'twój', 'nasz', 'każdy', 'wszystkie', 'innych', 'inne',

  // English Job Ad Boilerplate & Grammar
  'requirements', 'requirement', 'job', 'description', 'position', 'role', 'company', 'team',
  'candidate', 'responsibilities', 'duties', 'qualifications', 'experience', 'skills', 'skill',
  'knowledge', 'understanding', 'ability', 'abilities', 'minimum', 'maximum', 'years', 'year',
  'preferred', 'nice', 'plus', 'benefit', 'benefits', 'offer', 'offers', 'about', 'looking',
  'seeking', 'join', 'work', 'working', 'location', 'contact', 'apply', 'application', 'and', 'or',
  'for', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'from', 'with', 'by', 'of', 'is', 'are', 'be',
  'will', 'must', 'should', 'have', 'has', 'more', 'less', 'high', 'strong', 'good', 'great',
  'excellent', 'proven', 'track', 'record'
]);

/**
 * Valid multi-word compound skill phrases (N-Grams bi-grams / tri-grams)
 * where a frame noun (e.g., "oprogramowania") is part of a real competence phrase.
 */
const KNOWN_COMPOUND_SKILLS = [
  // Engineering & IT
  'testowanie oprogramowania', 'tworzenie oprogramowania', 'rozwój oprogramowania', 'architektura oprogramowania',
  'inżynieria oprogramowania', 'jakość oprogramowania', 'projektowanie oprogramowania',
  'bazy danych', 'baza danych', 'zarządzanie bazami danych', 'baza danych sql',
  'przetwarzanie danych', 'inżynieria danych', 'analiza danych', 'hurtownie danych',
  'bezpieczeństwo sieci', 'bezpieczeństwo informacji', 'cyberbezpieczeństwo',
  'uczenie maszynowe', 'sztuczna inteligencja', 'przetwarzanie języka naturalnego',

  // Business, Project Management & HR
  'zarządzanie projektem', 'zarządzanie projektami', 'zarządzanie zespołem', 'zarządzanie czasem',
  'zarządzanie budżetem', 'zarządzanie produktem', 'zarządzanie jakością', 'zarządzanie ryzykami',
  'analiza biznesowa', 'analiza systemowa', 'analiza finansowa', 'analiza rynku',
  'rekrutacja i selekcja', 'kadry i płace', 'prawo pracy', 'prawo jazdy',
  'obsługa klienta', 'budowanie relacji', 'negocjacje handlowe', 'badanie rynku',
  'lead generation', 'key account management', 'growth hacking', 'content marketing',

  // Finance & Accounting
  'pełna księgowość', 'rachunkowość zarządcza', 'sprawozdawczość finansowa',
  'kontroling finansowy', 'modelowanie finansowe', 'rozliczenia podatkowe',

  // Prace fizyczne, techniczne i rzemieślnicze (Reguła 8: monter, spawacz, magazynier obok programisty)
  'spawanie mag', 'spawanie tig', 'konstrukcje stalowe', 'cięcie palnikiem',
  'instalacje elektryczne', 'instalacje sanitarne', 'montaż pomp ciepła', 'pomiary elektryczne',
  'obsługa obrabiarek cnc', 'frezowanie cnc', 'toczenie metali', 'obróbka skrawaniem',
  'gospodarka magazynowa', 'obsługa wózka widłowego', 'wózki widłowe', 'kompletacja zamówień',
  'tachograf cyfrowy', 'czas pracy kierowców', 'transport międzynarodowy',
  'receptura apteczna', 'leki magistralne', 'system kamsoft',
  'murowanie ścian', 'tynki maszynowe', 'czytanie rysunku technicznego', 'czytanie rysunku budowlanego'
];

/**
 * Known tech & domain dictionary for N-Gram extraction across domains
 */
const KNOWN_HARD_SKILLS = [
  // IT & Cloud Stack
  'typescript', 'javascript', 'react', 'react.js', 'next.js', 'vue', 'angular',
  'node.js', 'express', 'nest.js', 'python', 'django', 'fastapi', 'c#', '.net',
  'java', 'spring', 'spring boot', 'go', 'golang', 'rust', 'php', 'laravel',
  'html', 'css', 'tailwind', 'tailwind css', 'sass', 'redux', 'zustand', 'graphql',
  'rest api', 'websockets', 'sql', 'postgresql', 'mysql', 'mongodb', 'redis',
  'elasticsearch', 'prisma', 'drizzle', 'docker', 'kubernetes', 'aws', 'gcp',
  'google cloud', 'azure', 'ci/cd', 'github actions', 'jenkins', 'terraform',
  'linux', 'bash', 'microservices', 'system design', 'unit testing', 'jest',
  'cypress', 'playwright', 'agile', 'scrum', 'jira', 'git', 'github', 'figma',
  'clean code', 'solid', 'security', 'oauth', 'seo', 'ats', 'analytics', 'etl',
  'kafka', 'rabbitmq', 'prometheus', 'grafana', 'opentelemetry', 'c++', 'swift', 'flutter',

  // Prace fizyczne, przemysłowe, techniczne i medyczne (Reguła 8)
  'mag', 'tig', 'migomat', 'spawanie', 'szlifowanie', 'cnc', 'fanuc', 'sinumerik',
  'heidenhain', 'frezowanie', 'toczenie', 'wms', 'adr', 'tacho', 'tachograf',
  'pex', 'sep', 'f-gazy', 'kamsoft', 'farmacja', 'receptura', 'murowanie',
  'tynkowanie', 'szpachlowanie', 'rozdzielnice', 'lutowanie',

  // Business, Finance, Controlling & Accounting
  'excel', 'power bi', 'tableau', 'vba', 'power query', 'spss', 'sap', 'sap erp',
  'salesforce', 'hubspot', 'księgowość', 'mssf', 'ifrs', 'budżetowanie', 'p&l',
  'analiza finansowa', 'controlling', 'audyt', 'vat', 'cit', 'pit', 'us gaap',
  'optima', 'symfonia', 'płatnik',

  // Marketing, Sales & E-commerce
  'sem', 'google ads', 'meta ads', 'ga4', 'google analytics', 'copywriting',
  'content marketing', 'e-mail marketing', 'growth hacking', 'klaviyo', 'b2b sales',
  'lead generation', 'key account management', 'crm', 'e-commerce',

  // Management, Operations, Engineering & Legal
  'prince2', 'pmp', 'lean', 'kaizen', 'six sigma', 'kanban', 'rodo', 'gdpr',
  'iso 9001', 'prawo pracy', 'kadry i płace', 'direct search', 'supply chain',
  'logistyka', 'procurement', 'autocad', 'cad', 'solidworks', 'plc'
];

const FORMAL_REQ_KEYWORDS = [
  'wykształcenie wyższe', 'studia', 'licencjat', 'magister', 'inżynier',
  'prawo jazdy', 'certyfikat', 'b2', 'c1', 'c2', 'angielski'
];

const SOFT_SKILLS_NOISE = [
  'komunikatywność', 'przywództwo', 'praca w zespole', 'zarządzanie czasem',
  'problem solving', 'leadership', 'teamwork', 'mentoring', 'odporność na stres',
  'kreatywność', 'dynamiczny', 'samodzielność', 'odpowiedzialność'
];

/** Escapuje frazę do zliczania powtórzeń w JD (ekstraktor kapitalizacji). */
function escapeForCount(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 4-Stage Advanced NLP N-Gram extraction from Job Description:
 * Stage 1: HR Blacklist filtering
 * Stage 2: POS / Verbal filtering (rejects organizational verbs, filler numbers)
 * Stage 3: Compound N-Grams detection (preserves bi-grams/tri-grams like "testowanie oprogramowania")
 * Stage 4: TF-IDF Rarity Weighting (low weight for generic terms, high for domain/tech skills)
 */
export function extractDynamicJdPhrases(jdText: string): {
  hardSkills: { phrase: string; weight: number }[];
  formalReqs: { phrase: string; weight: number }[];
  softSkills: { phrase: string; weight: number }[];
  allExtractedCount: number;
} {
  const hardSkills: { phrase: string; weight: number }[] = [];
  const formalReqs: { phrase: string; weight: number }[] = [];
  const softSkills: { phrase: string; weight: number }[] = [];

  // 1. Stage 3 Compound N-Gram Check (Multi-word skills)
  // `includes` na surowym tekście mylił `cit` w `city` i `go` w `good` —
  // strona ogłoszenia też wymaga granic słów (bez oceny intencji).
  for (const compound of KNOWN_COMPOUND_SKILLS) {
    if (containsPhrase(jdText, compound)) {
      hardSkills.push({ phrase: compound, weight: 3.0 });
    }
  }

  // 2. Stage 4 Known Hard Skills Dictionary Check
  for (const skill of KNOWN_HARD_SKILLS) {
    if (containsPhrase(jdText, skill)) {
      // Avoid adding single word if already covered in a compound
      if (!hardSkills.some((h) => h.phrase !== skill && containsPhrase(h.phrase, skill))) {
        hardSkills.push({ phrase: skill, weight: 3.0 });
      }
    }
  }

  // 3. Stage 4 Formal Requirements Check
  for (const req of FORMAL_REQ_KEYWORDS) {
    if (containsPhrase(jdText, req)) {
      formalReqs.push({ phrase: req, weight: 2.0 });
    }
  }

  // 4. Soft Skills Check
  for (const soft of SOFT_SKILLS_NOISE) {
    if (containsPhrase(jdText, soft)) {
      softSkills.push({ phrase: soft, weight: 0.5 });
    }
  }

  // 5. Stage 2 POS & Capitalized Acronym / Tech Stack Extractor
  // Poprzedni regex `[A-Z][a-zA-Z...]` ucinał polskie znaki (`Zespół` → `zesp`,
  // `Łódź` w ogóle), a każda wielka litera na początku zdania (`Need`, `Office`,
  // `Senior Backend Developer`) stawała się wymaganiem o wadze 3.0 — równej
  // Pythonowi. Stąd `cit` z `city` i tytuły stanowisk w mianowniku braków.
  // Teraz: regex w Unicode, słowa generyczne odrzucane, frazy z ekstraktora
  // niosą wagę 1.5 (sygnał, nie pewnik) i tylko z sygnałem technicznym albo
  // powtórzeniem — lepiej pominąć nieznane słowo niż wymyślić wymaganie.
  const GENERIC_ROLE_WORDS = new Set(
    [
      'senior', 'junior', 'mid', 'lead', 'principal', 'staff', 'backend', 'frontend',
      'fullstack', 'full', 'stack', 'developer', 'developers', 'engineer', 'inzynier',
      'programista', 'firma', 'company', 'team', 'zespol', 'group', 'grupa', 'office',
      'biuro', 'position', 'stanowisko', 'role', 'rola', 'project', 'projekt',
      'location', 'lokalizacja', 'offer', 'oferta', 'need', 'needs', 'with', 'and',
    ].map((w) => w.toLowerCase())
  );
  const strippedLower = (s: string): string =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
  const knownPhrases = new Set([
    ...KNOWN_COMPOUND_SKILLS.map(strippedLower),
    ...KNOWN_HARD_SKILLS.map(strippedLower),
    ...FORMAL_REQ_KEYWORDS.map(strippedLower),
  ]);
  const knownPhrasesList = Array.from(knownPhrases);
  // Token z kropkami tylko wewnątrz (`Node.js`), nie na granicy zdania
  // (`XYZ. Zespół` to dwa trafienia, nie fraza `xyz. zesp`); granice w Unicode,
  // bo ASCII-`\b` łamał słowo przed `ó`/`ł` (`Zespół` → `zesp`).
  const CAP_TOKEN = '[\\p{Lu}][\\p{L}0-9#+-]*(?:\\.[\\p{L}0-9#+-]+)*';
  const capitalizedMatches =
    jdText.match(new RegExp(`(?<![\\p{L}\\p{N}_])${CAP_TOKEN}(?:\\s+${CAP_TOKEN})*(?![\\p{L}\\p{N}_])`, 'gu')) || [];
  const uniqueCapitalizedMatches = Array.from(new Set(capitalizedMatches));
  const seenNormPhrases = new Set<string>();

  for (const match of uniqueCapitalizedMatches) {
    const cleaned = match.replace(/[.,;:!?]+$/g, '').trim();
    const lower = cleaned.toLowerCase().trim();
    const norm = strippedLower(cleaned);

    if (lower.length < 3 || /^\d+$/.test(lower)) continue;
    if (HR_AND_COMMON_STOP_WORDS.has(lower) || HR_AND_COMMON_STOP_WORDS.has(norm)) continue;
    if (seenNormPhrases.has(norm)) continue;
    seenNormPhrases.add(norm);

    const words = norm.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.every((w) => HR_AND_COMMON_STOP_WORDS.has(w) || GENERIC_ROLE_WORDS.has(w))) continue;

    // Strip leading and trailing HR stop words and generic role words
    const cleanWords = [...words];
    while (
      cleanWords.length > 0 &&
      (HR_AND_COMMON_STOP_WORDS.has(cleanWords[0]) || GENERIC_ROLE_WORDS.has(cleanWords[0]))
    ) {
      cleanWords.shift();
    }
    while (
      cleanWords.length > 0 &&
      (HR_AND_COMMON_STOP_WORDS.has(cleanWords[cleanWords.length - 1]) ||
        GENERIC_ROLE_WORDS.has(cleanWords[cleanWords.length - 1]))
    ) {
      cleanWords.pop();
    }
    if (cleanWords.length === 0) continue;

    const cleanPhrase = cleanWords.join(' ');
    if (cleanPhrase.length < 3 || HR_AND_COMMON_STOP_WORDS.has(cleanPhrase)) continue;
    // Duplikat czegoś, co słownik już pokrył (`need python` przy `python`).
    if (knownPhrasesList.some((k) => cleanPhrase !== k && containsPhrase(cleanPhrase, k))) continue;
    if (hardSkills.some((h) => strippedLower(h.phrase) === cleanPhrase)) continue;

    // Sygnał techniczny: akronim, cyfra, znak stosu — albo powtórzenie w JD.
    const tokens = cleaned.split(/\s+/);
    const hasTechSignal =
      tokens.some((t) => /^[A-ZĄĆĘŁŃÓŚŹŻ]{2,6}$/.test(t) || /[0-9#+./-]/.test(t)) ||
      knownPhrases.has(cleanPhrase);
    const occurrences = (jdText.match(new RegExp(escapeForCount(cleaned), 'gi')) ?? []).length;
    if (!hasTechSignal && occurrences < 2) continue;

    hardSkills.push({ phrase: cleanPhrase, weight: 1.5 });
  }

  // Final Strict Stage 1 Blacklist Purge: Remove any standalone junk word
  const uniqueHard = Array.from(new Map(hardSkills.map((item) => [item.phrase, item])).values())
    .filter((item) => {
      // If it's a single word, it MUST NOT be in the HR stop words blacklist
      const words = item.phrase.split(/\s+/);
      if (words.length === 1 && HR_AND_COMMON_STOP_WORDS.has(words[0])) {
        return false;
      }
      return item.phrase.length >= 3;
    });

  const uniqueFormal = Array.from(new Map(formalReqs.map((item) => [item.phrase, item])).values())
    .filter((item) => item.phrase.length >= 3);

  const uniqueSoft = Array.from(new Map(softSkills.map((item) => [item.phrase, item])).values());

  return {
    hardSkills: uniqueHard,
    formalReqs: uniqueFormal,
    softSkills: uniqueSoft,
    allExtractedCount: uniqueHard.length + uniqueFormal.length + uniqueSoft.length,
  };
}

/**
 * Simulates 3-Layer ATS parser check on the generated CV & Master Vault against Job Description.
 *
 * DIAGNOSTYKA SYMULACYJNA, nie wynik kanoniczny: liczba stąd służy podglądom
 * laboratoryjnym i rozbiciu na warstwy. Wynikiem pokazywanym jako „dopasowanie
 * do oferty" jest `scoreCanonicalAts` (`lib/canonicalAts.ts`) — on rozstrzyga
 * przy rozjazdach między silnikami (F6).
 */
export function simulateAtsCheck(
  resume: TailoredResume,
  vault: MasterVault,
  jobDescription: string,
  /**
   * Profil kandydata. Domyślnie odczytywany z `vault.profiler.flags` — pierwszy
   * zaznaczony wygrywa, a przy braku zaznaczenia zostaje dotychczasowe
   * zachowanie (`OFFICE_IT`), więc istniejące wyniki się nie zmieniają.
   */
  profile?: FlagCategory
): AtsCheckResult {
  const appliedProfile: FlagCategory = profile ?? vault.profiler?.flags?.[0] ?? 'OFFICE_IT';
  const dynamicJd = extractDynamicJdPhrases(jobDescription);

  // Aggregate full CV text with structural metadata
  // Formalia typowane (języki, licencje, certyfikaty) też są treścią: wcześniej
  // `profiler.languages` i `profiler.licenses` nie wchodziły do korpusu, więc
  // `angielski C1` z profilu dawał `formalReqsCoverage 0` (F3).
  const summaryText = resume.summary || vault.personalInfo.summary || '';
  const highlightTexts = resume.selectedHighlights.map((h) => h.optimizedText);
  const skillsList = [
    ...resume.skillsMatched.hardSkills,
    ...resume.skillsMatched.toolsAndTech,
    ...resume.skillsMatched.softSkills,
    ...vault.skillsMatrix.hardSkills,
    ...vault.skillsMatrix.toolsAndTech,
  ];
  const licenseTexts = (vault.profiler?.licenses ?? []).map(
    (id) => ALL_LICENSE_LABELS[id] ?? id
  );
  const languageTexts = (vault.profiler?.languages ?? []).map(
    (l) => `${l?.language || ''} ${l?.level || ''}`
  );
  const certificationTexts = (vault.skillsMatrix?.certifications ?? []).flatMap((c) => [
    c?.name || '',
    c?.issuer || '',
  ]);

  const fullCvTextParts = [
    summaryText,
    ...highlightTexts,
    ...skillsList,
    vault.personalInfo.fullName,
    vault.personalInfo.email,
    vault.personalInfo.phone,
    vault.personalInfo.location,
    vault.personalInfo.title,
    ...licenseTexts,
    ...languageTexts,
    ...certificationTexts,
    ...vault.history.flatMap((h) => [h.company, h.role, ...h.highlights.map((hl) => hl.text)]),
    ...vault.education.flatMap((e) => [e.institution, e.degree, e.fieldOfStudy]),
    ...vault.projects.flatMap((p) => [p.name, p.description, ...p.techStack]),
  ];

  const fullCvText = fullCvTextParts.filter(Boolean).join(' ').toLowerCase();

  // ==================== LAYER 1: STRUCTURE & LAYOUT DIAGNOSTICS ====================
  const detectedSections: string[] = [];
  const unparsableElementsWarnings: string[] = [];
  const badDateFormats: string[] = [];
  const ocrWarnings: string[] = [];

  // Check Standard Section Headers
  const standardHeaders = [
    { key: 'EXPERIENCE', name: 'Doświadczenie zawodowe', aliases: ['doświadczenie', 'historia zatrudnienia', 'work experience'] },
    { key: 'EDUCATION', name: 'Wykształcenie', aliases: ['wykształcenie', 'edukacja', 'education'] },
    { key: 'SKILLS', name: 'Umiejętności', aliases: ['umiejętności', 'kompetencje', 'skills', 'technologie'] },
    { key: 'CERTS', name: 'Certyfikaty', aliases: ['certyfikaty', 'uprawnienia', 'certifications'] },
    { key: 'CONTACT', name: 'Dane kontaktowe', aliases: ['kontakt', 'dane osobowe', 'contact'] },
  ];

  const missingStandardSections: string[] = [];

  for (const std of standardHeaders) {
    const hasHeader = std.aliases.some((alias) => fullCvText.includes(alias));
    if (hasHeader) {
      detectedSections.push(std.name);
    } else if (std.key === 'EXPERIENCE' || std.key === 'SKILLS' || std.key === 'CONTACT') {
      missingStandardSections.push(std.name);
    }
  }

  // Non-standard headers warning check
  if (fullCvText.includes('moja ścieżka') || fullCvText.includes('gdzie byłem') || fullCvText.includes('o mnie krótko')) {
    unparsableElementsWarnings.push('Wykryto niestandardowe nagłówki sekcji (np. "Moja ścieżka"). Używaj standardowych: "Doświadczenie Zawodowe", "Umiejętności".');
  }

  // Graphical elements without text equivalent
  if (fullCvText.includes('★★★') || fullCvText.includes('●●●') || fullCvText.includes('10/10') || fullCvText.includes('90%')) {
    unparsableElementsWarnings.push('Wykryto wizualne wskaźniki umiejętności (gwiazdki/paski postępu %). ATS nie potrafi ich odczytać – opisz poziom słownie (np. "Zaawansowany", "B2").');
  }

  // Date format checking
  for (const exp of vault.history) {
    if (!exp.startDate) continue;
    const dateRegex = /^(\d{2}\/\d{4}|\d{4}|Obecnie|Present)$/i;
    if (!dateRegex.test(exp.startDate.trim())) {
      badDateFormats.push(`Niestandardowy format daty początkowej w "${exp.company}": "${exp.startDate}". Zalecany format MM/YYYY.`);
    }
    if (exp.endDate && !dateRegex.test(exp.endDate.trim())) {
      badDateFormats.push(`Niestandardowy format daty końcowej w "${exp.company}": "${exp.endDate}". Zalecany format MM/YYYY lub "Obecnie".`);
    }
  }

  // Contact Info completeness
  if (!vault.personalInfo.email || !vault.personalInfo.email.includes('@')) {
    ocrWarnings.push('Brak prawidłowego adresu e-mail w sekcji danych osobowych.');
  }
  if (!vault.personalInfo.phone || vault.personalInfo.phone.trim().length < 6) {
    ocrWarnings.push('Brak podanego numeru telefonu kontaktowego.');
  }

  const headerNormalizationScore = missingStandardSections.length === 0 ? 100 : Math.max(50, 100 - missingStandardSections.length * 25);
  const layoutScore = unparsableElementsWarnings.length === 0 ? 100 : Math.max(60, 100 - unparsableElementsWarnings.length * 20);
  const isSingleColumnCompliant = unparsableElementsWarnings.length === 0 && missingStandardSections.length === 0;

  const structureScore = Math.round((headerNormalizationScore + layoutScore) / 2);
  const formattingScore = ocrWarnings.length === 0 && badDateFormats.length === 0 ? 100 : Math.max(50, 100 - (ocrWarnings.length + badDateFormats.length) * 12);

  // ==================== LAYER 2: NLP & LEMMATIZED MATCHING ====================
  const lemmatizedMatches: LemmatizedMatch[] = [];
  const matchedKeywords: string[] = [];
  const missingHardSkills: string[] = [];
  const missingSoftSkills: string[] = [];

  // Match Hard Skills with Polish Stemmer / Lemmatization
  let matchedHardWeight = 0;
  let totalHardWeight = 0;

  for (const hard of dynamicJd.hardSkills) {
    totalHardWeight += hard.weight;
    const isMatched = isLemmatizedMatch(hard.phrase, fullCvText);

    if (isMatched) {
      matchedHardWeight += hard.weight;
      matchedKeywords.push(hard.phrase);
      lemmatizedMatches.push({
        keywordFromJD: hard.phrase,
        matchedInCv: hard.phrase,
        category: 'HARD_SKILL',
        weight: hard.weight,
      });
    } else {
      missingHardSkills.push(hard.phrase);
    }
  }

  // Match Formal Requirements — tekst LUB typowane rozstrzygnięcie knock-outów.
  // Sama zgodność tekstowa nie widziała hierarchii (`C` implikuje `B`) ani
  // identyfikatorów licencji, więc wykwalifikowany profil dostawał 0 (F3).
  let matchedFormalWeight = 0;
  let totalFormalWeight = 0;
  const knockoutReport = auditKnockouts(jobDescription, vault);
  const satisfiedKnockoutLabels = knockoutReport.findings
    .filter((f) => f.satisfied)
    .map((f) => f.label);

  for (const formal of dynamicJd.formalReqs) {
    totalFormalWeight += formal.weight;
    const byText = isLemmatizedMatch(formal.phrase, fullCvText);
    const byLicense = satisfiedKnockoutLabels.some(
      (label) => containsPhrase(label, formal.phrase) || containsPhrase(formal.phrase, label)
    );

    if (byText || byLicense) {
      matchedFormalWeight += formal.weight;
      matchedKeywords.push(formal.phrase);
      lemmatizedMatches.push({
        keywordFromJD: formal.phrase,
        matchedInCv: formal.phrase,
        category: 'FORMAL_REQUIREMENT',
        weight: formal.weight,
      });
    }
  }

  // Filter Soft Skills (down-weighted noise)
  for (const soft of dynamicJd.softSkills) {
    const isMatched = isLemmatizedMatch(soft.phrase, fullCvText);
    if (!isMatched) {
      missingSoftSkills.push(soft.phrase);
    }
  }

  // Puste ogłoszenie (zero wykrytych wymagań) to brak mianownika, nie 100%
  // pokrycia — wcześniej puste JD dawało 90/100 pewności z niczego (F4).
  const hardSkillsCoverage = totalHardWeight > 0 ? Math.round((matchedHardWeight / totalHardWeight) * 100) : 0;
  const formalReqsCoverage = totalFormalWeight > 0 ? Math.round((matchedFormalWeight / totalFormalWeight) * 100) : 0;

  // ==================== LAYER 3: SCORING ALGEBRA (RECENCY & TITLE DENSITY) ====================
  
  // Calculate Recency Bias Score (Sr)
  // Keywords in current role = 100%, role 1-2 = 70%, older = 40%
  let recencyScoreSum = 0;
  let recencyCount = 0;

  for (const match of lemmatizedMatches) {
    const kw = match.keywordFromJD;
    recencyCount++;

    // Check current/most recent role (index 0)
    const currentRoleText = vault.history[0]
      ? `${vault.history[0].role} ${vault.history[0].company} ${vault.history[0].highlights.map((h) => h.text).join(' ')}`
      : '';

    // Check recent roles (index 1-2)
    const midRoleText = vault.history.slice(1, 3)
      .map((h) => `${h.role} ${h.company} ${h.highlights.map((hl) => hl.text).join(' ')}`)
      .join(' ');

    if (isLemmatizedMatch(kw, currentRoleText)) {
      recencyScoreSum += 100;
    } else if (isLemmatizedMatch(kw, midRoleText)) {
      recencyScoreSum += 70;
    } else {
      recencyScoreSum += 40; // Only in old roles, skills matrix, or education
    }
  }

  // Brak dopasowań = brak świeżości (0), nie bonus 80 z sufitu (F4/R1).
  // Poprzednie 80 pompowało medianę pustego profilu do ~39 (R5).
  const recencyScore = recencyCount > 0 ? Math.round(recencyScoreSum / recencyCount) : 0;

  // Calculate Job Title Match / Density Score (St)
  const targetTitle = resume.targetJobTitle || vault.personalInfo.title || '';
  const currentCvTitle = vault.personalInfo.title || '';
  const pastRolesTitles = vault.history.map((h) => h.role).join(' ');

  let titleMatchScore = 50; // base
  if (targetTitle && currentCvTitle) {
    if (isLemmatizedMatch(targetTitle, currentCvTitle)) {
      titleMatchScore = 100;
    } else if (isLemmatizedMatch(targetTitle, pastRolesTitles)) {
      titleMatchScore = 75;
    } else {
      titleMatchScore = 45;
    }
  }

  // Algebra Score calculation: Score = (W_h * S_h) + (W_r * S_r) + (W_t * S_t)
  const hardSkillScore = hardSkillsCoverage; // S_h
  const weightedAlgebraScore = Math.round(
    (hardSkillScore * 3.0 + recencyScore * 1.5 + titleMatchScore * 1.5) / 6.0
  );

  // Apply layout / structure penalty
  const structurePenalty = (100 - structureScore) * 0.15 + (100 - formattingScore) * 0.10;
  const noRequirements = totalHardWeight === 0 && totalFormalWeight === 0;
  const overallScore = noRequirements
    ? 0
    : Math.max(0, Math.min(100, Math.round(weightedAlgebraScore - structurePenalty)));

  const formulaBreakdown = `Algebra: Score = (3.0 × ${hardSkillScore}% [Hard Skills]) + (1.5 × ${recencyScore}% [Świeżość/Recency]) + (1.5 × ${titleMatchScore}% [Tytuł Stanowiska]) ÷ 6.0 - ${Math.round(structurePenalty)}% (Kara Układu)`;

  // Coverage score for legacy display
  const keywordCoverageScore = Math.round((hardSkillsCoverage + formalReqsCoverage) / 2);

  // Gap Analysis & Actionable Recommendations
  const gapAnalysis: string[] = [];
  const recommendations: string[] = [];

  if (missingHardSkills.length > 0) {
    gapAnalysis.push(
      `Brakujące wymagania twarde z ogłoszenia: ${missingHardSkills.slice(0, 6).join(', ')}.`
    );
    recommendations.push(
      `Słowa twarde (waga 3x): Uzupełnij w Master Vault doświadczenie powiązane z: ${missingHardSkills.slice(0, 3).join(', ')}.`
    );
  } else {
    gapAnalysis.push('100% kluczowych wymagań technicznych i formalnych z ogłoszenia znajduje się w Twoim profilu!');
  }

  if (recencyScore < 70) {
    recommendations.push('Świeżość umiejętności (Recency Bias): Przenieś kluczowe technologie do opisu Twojego najnowszego stanowiska, aby ATS przyznał pełną wagę (100%).');
  }

  if (titleMatchScore < 75) {
    recommendations.push(`Gęstość Tytułu Stanowiska: Dostosuj nagłówek profilu ("${currentCvTitle}") tak, aby zawierał szukaną frazę stanowiska ("${targetTitle}").`);
  }

  if (unparsableElementsWarnings.length > 0) {
    recommendations.push('Struktura PDF: Zastąp elementy graficzne (paski postępu, ikonki) opisem tekstowym, aby nie gubić danych w parserze OCR.');
  }

  const orderedRecommendations = prioritizeForProfile(recommendations, appliedProfile);

  return {
    overallScore,
    keywordCoverageScore,
    structureScore,
    formattingScore,
    appliedProfile,
    layer1Structure: {
      layoutScore,
      headerNormalizationScore,
      detectedSections,
      missingStandardSections,
      unparsableElementsWarnings,
      isSingleColumnCompliant,
    },
    layer2Nlp: {
      hardSkillsCoverage,
      formalReqsCoverage,
      softSkillsFilterCount: dynamicJd.softSkills.length,
      extractedJdPhrasesCount: dynamicJd.allExtractedCount,
      lemmatizedMatches,
    },
    layer3Scoring: {
      hardSkillScore,
      recencyScore,
      titleMatchScore,
      formulaBreakdown,
    },
    matchedKeywords: Array.from(new Set(matchedKeywords)),
    missingHardSkills: Array.from(new Set(missingHardSkills)),
    missingSoftSkills: Array.from(new Set(missingSoftSkills)),
    ocrWarnings,
    badDateFormats,
    gapAnalysis,
    recommendations: orderedRecommendations,
  };
}

export interface AtsEngineResult {
  id: string;
  name: string;
  component: string;
  category: string;
  score: number;
  status: 'OPTIMAL' | 'ACCEPTABLE' | 'RISKY' | 'REJECTED';
  keyStrengths: string[];
  penaltiesAndFlags: string[];
  recommendation: string;
  proposals: string[];
  weightsFocus: string;
}

export interface MultiEngineAtsConsensus {
  medianScore: number;
  meanScore: number;
  minScore: number;
  maxScore: number;
  consensusGrade: 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK' | 'CRITICAL_RISK';
  summaryJustification: string;
  careerFitAdvice: {
    isRealisticFit: boolean;
    verdict: string;
    actionablePlan: string;
    suggestedAlternativeRoles: string[];
  };
  engines: AtsEngineResult[];
  globalBestPractices: { title: string; badExample: string; goodExample: string; explanation: string }[];
}

export function calculateMedian(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Wielosilnikowa symulacja audytu ATS oparta na 10 wewnętrznych modułach i filtrach Kierivo.
 * Oblicza medianę rynkową, indywidualne oceny modułów, konkretne propozycje zmian oraz realistyczną ocenę dopasowania.
 *
 * DIAGNOSTYKA SYMULACYJNA, nie wynik kanoniczny (jak `simulateAtsCheck` powyżej).
 */
export function simulateMultiEngineATS(
  vault: MasterVault | Partial<MasterVault> | undefined | null,
  jobOfferText: string = '',
  targetRoleTitle: string = ''
): MultiEngineAtsConsensus {
  const safeVault: MasterVault = {
    version: vault?.version || '1.0.0',
    updatedAt: vault?.updatedAt || new Date().toISOString(),
    personalInfo: vault?.personalInfo || { fullName: '', title: targetRoleTitle || '', email: '', phone: '', location: '', summary: '' },
    skillsMatrix: vault?.skillsMatrix || { hardSkills: [], softSkills: [], toolsAndTech: [], certifications: [] },
    history: vault?.history || [],
    education: vault?.education || [],
    projects: vault?.projects || [],
    profiler: vault?.profiler || {
      flags: [],
      languages: [],
      licenses: [],
      experienceLevel: 'MID',
      location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
    },
  };

  const dummyResume: TailoredResume = {
    targetJobTitle: targetRoleTitle || safeVault.personalInfo?.title || '',
    companyName: '',
    summary: safeVault.personalInfo?.summary || '',
    selectedHighlights: [],
    skillsMatched: {
      hardSkills: safeVault.skillsMatrix?.hardSkills || [],
      toolsAndTech: safeVault.skillsMatrix?.toolsAndTech || [],
      softSkills: safeVault.skillsMatrix?.softSkills || [],
    },
    atsScore: 0,
  };

  const baseResult = simulateAtsCheck(
    dummyResume,
    safeVault,
    jobOfferText
  );

  const hardCoverage = baseResult.layer2Nlp?.hardSkillsCoverage ?? 50;
  const structScore = baseResult.structureScore ?? 80;
  const recencyScore = baseResult.layer3Scoring?.recencyScore ?? 70;
  const titleScore = baseResult.layer3Scoring?.titleMatchScore ?? 70;
  const ocrWarningsCount = baseResult.ocrWarnings?.length ?? 0;
  const missingHardCount = baseResult.missingHardSkills?.length ?? 0;

  // Weryfikacja obecności twardych metryk liczbowych w historii
  let hasMetrics = false;
  let metricsCount = 0;
  for (const exp of safeVault.history || []) {
    for (const hl of exp?.highlights || []) {
      const text = typeof hl === 'string' ? hl : (hl?.text || '');
      if (/\d+[%kKmM+xX]?/.test(text)) {
        hasMetrics = true;
        metricsCount++;
      }
    }
  }

  // Weryfikacja wykształcenia i certyfikatów
  const hasEducation = (safeVault.education || []).length > 0;
  const hasCerts = (safeVault.skillsMatrix?.certifications || []).length > 0;

  // 1. Moduł Struktury i Czytelności OCR (cvUniversalParser / Warstwa 1)
  const ocrScore = Math.min(100, Math.max(0, Math.round(
    structScore * 0.60 + (ocrWarningsCount === 0 ? 40 : 10)
  )));
  const engine1: AtsEngineResult = {
    id: 'struktura_ocr',
    name: 'Audytor Struktury i Odczytu Maszynowego',
    component: 'cvUniversalParser.ts (Warstwa 1)',
    category: 'Układ dokumentu i parsowalność',
    score: ocrScore,
    status: ocrScore >= 80 ? 'OPTIMAL' : ocrScore >= 65 ? 'ACCEPTABLE' : ocrScore >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: 'Układ jednokolumnowy (60%), Brak blokad graficznych OCR (40%)',
    keyStrengths: [
      structScore >= 80 ? 'Prawidłowy podział na sekcje główne' : 'Rozpoznano bloki tekstu',
      ocrWarningsCount === 0 ? 'Brak elementów zakłócających odczyt automatyczny' : 'Format czytelny dla parsera',
    ],
    penaltiesAndFlags: [
      ...(ocrWarningsCount > 0 ? ['Wykryto nietypowe symbole lub złożony podział bloków'] : []),
    ],
    recommendation: 'Zachowaj czysty, jednokolumnowy układ z tradycyjnymi nagłówkami bez zagnieżdżonych tabel.',
    proposals: [
      'Stosuj proste punktorowanie zamiast grafik czy pasków postępu.',
      'Upewnij się, że dane kontaktowe znajdują się w głównej treści, a nie w stopce pliku.',
    ],
  };

  // 2. Moduł Słów Kluczowych i Fleksji Języka Polskiego (Lematyzator / Warstwa 2)
  const lematyzatorScore = Math.min(100, Math.max(0, Math.round(
    hardCoverage * 0.70 + (missingHardCount === 0 ? 30 : Math.max(0, 30 - missingHardCount * 5))
  )));
  const engine2: AtsEngineResult = {
    id: 'slowa_kluczowe_fleksja',
    name: 'Analizator Słów Kluczowych i Odmiany Polskiej',
    component: 'atsSimulator.ts (Lematyzator Fleksyjny)',
    category: 'Dopasowanie semantyczne i słownikowe',
    score: lematyzatorScore,
    status: lematyzatorScore >= 80 ? 'OPTIMAL' : lematyzatorScore >= 65 ? 'ACCEPTABLE' : lematyzatorScore >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: 'Pokrycie wymagań twardych (70%), Zgodność lematyczna form odmienionych (30%)',
    keyStrengths: [
      hardCoverage >= 70 ? `Wysokie pokrycie słów kluczowych (${hardCoverage}%)` : 'Podstawowe pojęcia odnalezione w profilu',
    ],
    penaltiesAndFlags: [
      ...(missingHardCount > 0 ? [`Brak ${missingHardCount} kluczowych pojęć/technologii wymienionych w ofercie`] : []),
    ],
    recommendation: 'Uzupełnij brakujące pojęcia w profilu, jeśli posiadasz z nimi doświadczenie.',
    proposals: [
      missingHardCount > 0
        ? `Dopisz w doświadczeniu konkretne narzędzia z oferty: ${baseResult.missingHardSkills?.slice(0, 3).join(', ')}.`
        : 'Utrzymaj aktualne nasycenie frazami branżowymi.',
    ],
  };

  // 3. Moduł Kryteriów Formalnych i Uprawnień (knockouts.ts)
  const knockoutsScore = Math.min(100, Math.max(0, Math.round(
    (hasCerts ? 35 : 15) + (hasEducation ? 25 : 10) + (safeVault.profiler?.languages?.length ? 25 : 10) + 15
  )));
  const engine3: AtsEngineResult = {
    id: 'kryteria_formalne',
    name: 'Audytor Uprawnień i Wymagań Formalnych',
    component: 'knockouts.ts (Kryteria Zero-Jedynkowe)',
    category: 'Uprawnienia, certyfikaty i wykształcenie',
    score: knockoutsScore,
    status: knockoutsScore >= 80 ? 'OPTIMAL' : knockoutsScore >= 65 ? 'ACCEPTABLE' : knockoutsScore >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: 'Uprawnienia państwowe/branżowe (35%), Wykształcenie (25%), Języki obce (25%)',
    keyStrengths: [
      hasCerts ? 'Udokumentowane uprawnienia lub certyfikaty specjalistyczne' : 'Wprowadzone dane formalne',
      hasEducation ? 'Uzupełniona ścieżka edukacyjna' : 'Podstawowe dane formalne obecne',
    ],
    penaltiesAndFlags: [
      ...(!hasCerts ? ['Brak wpisów w sekcji uprawnień formalnych (np. SEP, UDT, certyfikaty inżynierskie)'] : []),
    ],
    recommendation: 'Jeśli posiadasz uprawnienia (np. prawo jazdy, certyfikaty), podaj ich pełne oficjalne nazwy.',
    proposals: [
      'Wpisz oficjalny numer lub instytucję wydającą certyfikat.',
      'Dopisz poziom języka obcego zgodnie ze skalą CEFR (np. B2, C1).',
    ],
  };

  // 4. Moduł Świeżości Umiejętności (Recency Bias & relevanceRanking.ts)
  const recencyScoreEngine = Math.min(100, Math.max(0, Math.round(
    recencyScore * 0.70 + hardCoverage * 0.30
  )));
  const engine4: AtsEngineResult = {
    id: 'swiezosc_umiejetnosci',
    name: 'Weryfikator Świeżości Umiejętności',
    component: 'relevanceRanking.ts (Aktualność Ostatnich 2 Lat)',
    category: 'Dynamika i aktualność kompetencji',
    score: recencyScoreEngine,
    status: recencyScoreEngine >= 80 ? 'OPTIMAL' : recencyScoreEngine >= 65 ? 'ACCEPTABLE' : recencyScoreEngine >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: 'Obecność technologii w bieżącym/najnowszym stanowisku (70%), Pokrycie (30%)',
    keyStrengths: [
      recencyScore >= 75 ? 'Główne technologie używane w najnowszych projektach' : 'Ciągłość rozwoju zawodowego',
    ],
    penaltiesAndFlags: [
      ...(recencyScore < 70 ? ['Kluczowe umiejętności widoczne są wyłącznie w starszych rolach sprzed lat'] : []),
    ],
    recommendation: 'Wymień kluczowe narzędzia w opisie aktualnego lub ostatniego stanowiska.',
    proposals: [
      'Przenieś najważniejsze technologie do opisu bieżącego miejsca pracy.',
      'Podkreśl, jak rozwijasz te umiejętności w najnowszych projektach.',
    ],
  };

  // 5. Moduł Zgodności Tytułu Stanowiska (Title Matcher)
  const titleScoreEngine = Math.min(100, Math.max(0, Math.round(
    titleScore * 0.75 + hardCoverage * 0.25
  )));
  const engine5: AtsEngineResult = {
    id: 'zgodnosc_tytulu',
    name: 'Weryfikator Nagłówka i Nazwy Stanowiska',
    component: 'atsSimulator.ts (Dopasowanie Tytułu Roli)',
    category: 'Zbieżność roli i pozycjonowanie kandydata',
    score: titleScoreEngine,
    status: titleScoreEngine >= 80 ? 'OPTIMAL' : titleScoreEngine >= 65 ? 'ACCEPTABLE' : titleScoreEngine >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: 'Zgodność nagłówka profilu z tytułem oferty (75%), Baza kompetencji (25%)',
    keyStrengths: [
      titleScore >= 75 ? 'Nagłówek profilu precyzyjnie odpowiada szukanemu stanowisku' : 'Zrozumiała specjalizacja',
    ],
    penaltiesAndFlags: [
      ...(titleScore < 70 ? ['Nagłówek w CV różni się znacząco od nazwy stanowiska w ogłoszeniu'] : []),
    ],
    recommendation: 'Dostosuj nagłówek pod swoim imieniem i nazwiskiem do nazwy roli w ogłoszeniu.',
    proposals: [
      `Zmień nagłówek na: „${targetRoleTitle || safeVault.personalInfo.title || 'Specjalista w branży'}”.`,
      'Unikaj poetyckich lub zbyt ogólnych określeń typu „Człowiek orkiestra”.',
    ],
  };

  // 6. Moduł Twardych Liczb i Metryk Osiągnięć (drillEngine & elevatorPitchEngine)
  const metricsScoreEngine = Math.min(100, Math.max(0, Math.round(
    (hasMetrics ? 70 + Math.min(30, metricsCount * 10) : 25)
  )));
  const engine6: AtsEngineResult = {
    id: 'metryki_liczbowe',
    name: 'Analizator Twardych Liczb i Wyników KPI',
    component: 'elevatorPitchEngine.ts & drillEngine.ts (Ekstrakcja Metryk)',
    category: 'Wymierność i dowodowość osiągnięć',
    score: metricsScoreEngine,
    status: metricsScoreEngine >= 80 ? 'OPTIMAL' : metricsScoreEngine >= 65 ? 'ACCEPTABLE' : metricsScoreEngine >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: 'Obecność liczb, procentów, skali, oszczędności i budżetów (100%)',
    keyStrengths: [
      hasMetrics ? `Wykryto ${metricsCount} mierzalnych wskaźników w opisach doświadczenia` : 'Opisano zrealizowane zadania',
    ],
    penaltiesAndFlags: [
      ...(!hasMetrics ? ['Opisy stanowisk to wyłącznie lista obowiązków bez wymiernych liczb i efektów'] : []),
    ],
    recommendation: 'Przekształć obowiązki w sukcesy ze wzorem: [Co zrobiłem] + [Jakim narzędziem] + [Jaki wynik liczbowy].',
    proposals: [
      'Podaj procentowy wzrost, spadek awaryjności, zaoszczędzony czas lub budżet.',
      'Określ skalę projektów (np. wielkość zespołu, liczba użytkowników, wolumen obsłużonych zgłoszeń).',
    ],
  };

  // 7. Moduł Naturalności i Gęstości Słów (Brak spamu / Stuffing Guard)
  const isOverStuffed = hardCoverage > 95 && !hasMetrics;
  const naturalnessScore = Math.min(100, Math.max(0, Math.round(
    hardCoverage * 0.50 + (hasMetrics ? 30 : 15) + (isOverStuffed ? -25 : 20)
  )));
  const engine7: AtsEngineResult = {
    id: 'naturalnosc_jezyka',
    name: 'Strażnik Naturalności i Gęstości Słów',
    component: 'atsSimulator.ts (Detektor Przeładowania Słowami)',
    category: 'Płynność językowa i brak sztucznego spamu',
    score: naturalnessScore,
    status: naturalnessScore >= 80 ? 'OPTIMAL' : naturalnessScore >= 65 ? 'ACCEPTABLE' : naturalnessScore >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: 'Wplecenie umiejętności w zdania (50%), Spójność z opisem ról (50%)',
    keyStrengths: [
      !isOverStuffed ? 'Naturalna struktura zdań bez sztucznego upychania słów kluczowych' : 'Wysokie nasycenie terminami',
    ],
    penaltiesAndFlags: [
      ...(isOverStuffed ? ['Wykryto suchą listę słów kluczowych niepopartą żadnym opisem projektowym'] : []),
    ],
    recommendation: 'Nie twórz wielkich list samych nazw technologii bez osadzenia ich w zrealizowanych zadaniach.',
    proposals: [
      'Zamiast wymieniać 30 narzędzi w rzędzie, opisz 4 najważniejsze w punktach doświadczenia.',
    ],
  };

  // 8. Moduł Spójności Dat i Faktów (consistencyGuard)
  const consistencyScore = Math.min(100, Math.max(0, Math.round(
    structScore * 0.50 + (safeVault.history.length > 0 ? 30 : 10) + 20
  )));
  const engine8: AtsEngineResult = {
    id: 'spojnosc_profilu',
    name: 'Strażnik Spójności i Ciągłości Zatrudnienia',
    component: 'consistencyEngine.ts (Strażnik Faktów)',
    category: 'Brak sprzeczności i ciągłość chronologiczna',
    score: consistencyScore,
    status: consistencyScore >= 80 ? 'OPTIMAL' : consistencyScore >= 65 ? 'ACCEPTABLE' : consistencyScore >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: 'Brak luk czasowych (50%), Spójność dat i ról (50%)',
    keyStrengths: [
      safeVault.history.length > 0 ? 'Zachowana chronologiczna ciągłość wpisów zawodowych' : 'Podstawowe ramy czasowe',
    ],
    penaltiesAndFlags: [],
    recommendation: 'Podawaj daty w spójnym formacie (miesiąc i rok), aby parser nie naliczał luk w zatrudnieniu.',
    proposals: [
      'Stosuj format MM.RRRR (np. 03.2021 – 08.2023).',
    ],
  };

  // 9. Przesiewowy Audyt Wymagań (quickAtsCheck)
  const quickScore = Math.min(100, Math.max(0, Math.round(
    hardCoverage * 0.40 + titleScore * 0.30 + structScore * 0.30
  )));
  const engine9: AtsEngineResult = {
    id: 'przesiew_wymagan',
    name: 'Przesiewowy Tester Rekrutacyjny',
    component: 'quickAtsCheck.ts (Szybkie Sito Formalne)',
    category: 'Wstępna kwalifikacja aplikacji',
    score: quickScore,
    status: quickScore >= 80 ? 'OPTIMAL' : quickScore >= 65 ? 'ACCEPTABLE' : quickScore >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: 'Pokrycie bazowe (40%), Tytuł (30%), Struktura (30%)',
    keyStrengths: [
      quickScore >= 70 ? 'Wysoka szansa przejścia automatycznego sita w pierwszym etapie' : 'Dokument zawiera dane bazowe',
    ],
    penaltiesAndFlags: [
      ...(quickScore < 60 ? ['Ryzyko automatycznego odrzucenia z powodu niskiego dopasowania początkowego'] : []),
    ],
    recommendation: 'Sprawdź, czy oferta nie wymaga odmiennej specjalizacji.',
    proposals: [
      'Dopasuj CV ściśle pod jedno konkretne ogłoszenie, zamiast wysyłać generyczny dokument.',
    ],
  };

  // 10. Główny Konsensus Kierivo (cvelocity_consensus)
  const cvelocityScore = Math.min(100, Math.max(0, Math.round(
    hardCoverage * 0.35 + recencyScore * 0.25 + structScore * 0.20 + titleScore * 0.10 + (hasMetrics ? 10 : 0)
  )));
  const engine10: AtsEngineResult = {
    id: 'konsensus_cvelocity',
    name: 'Główny Zrównoważony Konsensus Kierivo',
    component: 'atsScorer.ts (Zbalansowany Model Końcowy)',
    category: 'Końcowa syntetyczna ocena dopasowania',
    score: cvelocityScore,
    status: cvelocityScore >= 80 ? 'OPTIMAL' : cvelocityScore >= 65 ? 'ACCEPTABLE' : cvelocityScore >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: 'Wszystkie 9 wymiarów zbalansowane (100%)',
    keyStrengths: [
      cvelocityScore >= 75 ? 'Zrównoważony profil o wysokiej odporności na błędy parsowania' : 'Stabilny szkielet CV',
    ],
    penaltiesAndFlags: [
      ...(missingHardCount > 2 ? [`Brak ${missingHardCount} kluczowych kompetencji twardych`] : []),
    ],
    recommendation: 'Skorzystaj z generatora Historii STAR i doprecyzuj najważniejsze projekty.',
    proposals: [
      'Wygeneruj ściągę na rozmowę i przećwicz odpowiedzi w trybie symulatora pytań.',
    ],
  };

  const engines = [engine1, engine2, engine3, engine4, engine5, engine6, engine7, engine8, engine9, engine10];
  const allScores = engines.map((e) => e.score);
  const medianScore = calculateMedian(allScores);
  const meanScore = Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length);
  const minScore = Math.min(...allScores);
  const maxScore = Math.max(...allScores);

  const consensusGrade: MultiEngineAtsConsensus['consensusGrade'] =
    medianScore >= 80 ? 'EXCELLENT' : medianScore >= 65 ? 'GOOD' : medianScore >= 50 ? 'NEEDS_WORK' : 'CRITICAL_RISK';

  // Uczciwa ocena predyspozycji zawodowych i alternatywne ścieżki
  const isRealisticFit = medianScore >= 60 && missingHardCount <= 4;
  const suggestedAlternativeRoles: string[] = [];

  const careerVerdict = isRealisticFit
    ? 'Stanowisko jest w zasięgu Twoich kompetencji. Profil wymaga jedynie kosmetycznego dopasowania akcentów i uzupełnienia metryk.'
    : 'Wykryto znaczącą lukę kompetencyjną. Brakuje ponad połowy kluczowych wymagań technicznych lub uprawnień formalnych.';

  const careerPlan = isRealisticFit
    ? 'Dopracuj opisy osiągnięć liczbami, ujednolić nagłówek i aplikuj śmiało.'
    : 'Zamiast sztucznie dopisywać nieznane narzędzia (co natychmiast wyjdzie podczas rozmowy technicznej), rekomendujemy rozważenie stanowisk pokrewnych o niższym progu wejścia lub uzupełnienie twardych kwalifikacji.';

  if (!isRealisticFit) {
    // Sugestie alternatywnych stanowisk
    const currentTitle = (safeVault.personalInfo.title || '').toLowerCase();
    if (currentTitle.includes('devops') || currentTitle.includes('cloud')) {
      suggestedAlternativeRoles.push('Administrator Systemów Linux', 'Junior Cloud Engineer', 'Inżynier Wsparcia IT L2/L3');
    } else if (currentTitle.includes('programista') || currentTitle.includes('developer') || currentTitle.includes('frontend') || currentTitle.includes('backend')) {
      suggestedAlternativeRoles.push('Młodszy Programista (Junior Developer)', 'Tester Oprogramowania (QA)', 'Wdrożeniowiec Systemów');
    } else if (currentTitle.includes('elektryk') || currentTitle.includes('monter') || currentTitle.includes('technik')) {
      suggestedAlternativeRoles.push('Pomocnik Montera / Elektryka', 'Serwisant Urządzeń', 'Operator Maszyn');
    } else {
      suggestedAlternativeRoles.push('Specjalista ds. Operacyjnych', 'Młodszy Specjalista ds. Wdrożeń', 'Koordynator Projektu');
    }
  }

  const summaryJustification =
    medianScore >= 80
      ? `Twoje CV uzyskało rynkowy konsensus na poziomie ${medianScore}%. Profil posiada wysokie nasycenie słowami kluczowymi, przejrzysty układ i jest w pełni czytelny dla ponad 85% systemów rekrutacyjnych.`
      : medianScore >= 65
      ? `Mediana dopasowania wynosi ${medianScore}%. Aplikacja przejdzie wstępne sito, jednak bardziej rygorystyczne filtry obniżą ocenę z powodu brakujących ${missingHardCount} pojęć lub małej liczby twardych liczb.`
      : `Mediana konsensusu ${medianScore}% wskazuje na wysokie ryzyko odrzucenia. Powodem jest duża rozbieżność roli, brak bazowych narzędzi lub brak wymiernych wyników.`;

  const globalBestPractices = [
    {
      title: '1. Zasada Kontekstu: Narzędzie + Działanie + Liczba',
      badExample: '• Programowanie w Pythonie i bazy danych SQL.',
      goodExample: '• Zaprojektowałem usługę w Pythonie (FastAPI) z bazą PostgreSQL, redukując czas odpowiedzi o 42% dla 10 tysięcy użytkowników.',
      explanation: 'Systemy ATS oraz rekruterzy najwyżej punktują zdania zawierające konkretną technologię połączoną z mierzalnym rezultatem biznesowym.',
    },
    {
      title: '2. Spójność Tytułu Stanowiska z Ofertą',
      badExample: 'Nagłówek w CV: „Pasjonat Nowych Technologii” (w ofercie: Starszy Programista Java)',
      goodExample: 'Nagłówek w CV: „Starszy Programista Java | Spring Boot & Cloud Architect”',
      explanation: 'Filtry rekrutacyjne natychmiast porównują nagłówek z nazwą stanowiska. Brak zbieżności obniża ocenę w pierwszym etapie selekcji.',
    },
    {
      title: '3. Tradycyjne i Jednoznaczne Nazwy Sekcji',
      badExample: '„Moja Droga Życiowa”, „Czym Się Pasjonuję”, „Gdzie Działałem”',
      goodExample: '„Doświadczenie Zawodowe”, „Umiejętności Techniczne”, „Wykształcenie”, „Uprawnienia i Certyfikaty”',
      explanation: 'Automatyczne czytniki korzystają ze sztywnych słowników nagłówków. Nietypowe nazwy sekcji powodują pominięcie całych bloków tekstu.',
    },
    {
      title: '4. Czysty Układ Jednokolumnowy bez Grafik i Pasków Postępu',
      badExample: 'Paski biegłości (np. Python: 4/5 gwiazdek, React: pasek 80%), tabele wielokolumnowe zagnieżdżone w sobie.',
      goodExample: 'Czysty tekst: „Python (poziom zaawansowany), React (3 lata doświadczenia komercyjnego)”, układ jednokolumnowy.',
      explanation: 'Czytniki maszynowe nie potrafią zinterpretować graficznych pasków postępu — dla algorytmu oznacza to brak informacji o znajomości narzędzia.',
    },
    {
      title: '5. Precyzja Dat i Chronologia (Brak Luk)',
      badExample: '„Firma X w latach ubiegłych”, „2021 – 2022” (bez podania miesięcy)',
      goodExample: '„03.2021 – 08.2023 (2 lata 6 mies.)”',
      explanation: 'Parser oblicza łączny staż pracy na podstawie miesięcy. Brak miesięcy powoduje zaokrąglenie w dół lub flagę błędu.',
    },
    {
      title: '6. Klauzula Zgody na Przetwarzanie Danych Osobowych (RODO)',
      badExample: 'Brak klauzuli formalnej na dole dokumentu.',
      goodExample: 'Aktualna formuła zgody na przetwarzanie danych osobowych w celach rekrutacyjnych.',
      explanation: 'Niektóre polskie i europejskie systemy rekrutacyjne odrzucają dokumenty pozbawione wymaganej zgody prawnej.',
    },
  ];

  return {
    medianScore,
    meanScore,
    minScore,
    maxScore,
    consensusGrade,
    summaryJustification,
    careerFitAdvice: {
      isRealisticFit,
      verdict: careerVerdict,
      actionablePlan: careerPlan,
      suggestedAlternativeRoles,
    },
    engines,
    globalBestPractices,
  };
}



