import { AtsCheckResult, FlagCategory, MasterVault, TailoredResume, LemmatizedMatch } from '../types';
import {
  getPolishStem as canonicalPolishStem,
  hasPositiveSkillEvidence,
  containsPhrase,
} from './skillEvidence';
import { ALL_LICENSES } from '../data/licenses';
import { auditKnockouts } from './knockouts';
import { hasCareerEvidence } from './careerEvidence';
import { buildCandidateEvidenceCorpora } from './candidateEvidence';
import { hasRequiredRequirementMention, stripPreferredRequirementText } from './jdOptionality';
import { stripInferredPastedOfferHeader } from './jobOfferPreprocessor';
import { hasMeasurableMetric, auditExperienceTimelineAndMetrics, parseYearMonthToNumbers } from './consistencyGuard/timelineAuditor';
import { employmentIntervalForJob } from './experience';
import { parseDateToDecimalYear } from './consistencyGuard/consistencyEngine';
import { hasAtsDiagnosticContent } from './atsDiagnosticReadiness';
import { isPlausibleEmailAddress } from './emailAddress';

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
const PHYSICAL_PRIORITY = ['Czytelno\u015b\u0107 tekstu', 'Sekcje', 'Format dat', 'S\u0142owa twarde'];

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
  'mile', 'widziane', 'widziana', 'wymagane', 'wymagany', 'wymagana', 'wymagani', 'dodatkowy', 'atut', 'atutem', 'niezbędne', 'dobra', 'bardzo',
  'praktyczna', 'praktycznej', 'płynna', 'biegła', 'biegłość', 'wysoka', 'min', 'minimum',
  'max', 'maksimum', 'lat', 'lata', 'roku', 'roczne', 'miesięcy', 'bieżącej', 'przyszłych',
  'wybranych', 'zgodnie', 'art', 'klauzula', 'klauzuli', 'danych', 'osobowych',

  // Prepositions, Conjunctions & Grammar (Spójniki, zaimki, przyimki)
  'i', 'w', 'z', 'na', 'do', 'dla', 'o', 'ze', 'za', 'po', 'od', 'pod', 'nad', 'oraz', 'lub', 'albo',
  'czy', 'ale', 'lecz', 'jak', 'tak', 'co', 'to', 'jest', 'są', 'być', 'może', 'móc', 'musi', 'powinien',
  'naszego', 'naszej', 'naszym', 'swoim', 'twojego', 'twojej', 'twój', 'nasz', 'każdy', 'wszystkie', 'innych', 'inne',

  // English Job Ad Boilerplate & Grammar
  'requirements', 'requirement', 'required', 'job', 'description', 'position', 'role', 'company', 'team',
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
  'incident triage', 'customer-facing support', 'customer-facing technical support', 'customer-facing', 'customer facing',
  // IT & Cloud Stack
  'typescript', 'javascript', 'react', 'react.js', 'next.js', 'vue', 'angular',
  'node.js', 'express', 'nest.js', 'python', 'django', 'fastapi', 'c#', '.net',
  'windows 11', 'microsoft 365', 'exchange online', 'tcp/ip', 'intune', 'entra id', 'powershell', 'servicenow',
  'java', 'spring', 'spring boot', 'go', 'golang', 'rust', 'php', 'laravel',
  'html', 'css', 'tailwind', 'tailwind css', 'sass', 'redux', 'zustand', 'graphql',
  'rest api', 'websockets', 'sql', 'postgresql', 'mysql', 'mongodb', 'redis',
  'elasticsearch', 'prisma', 'drizzle', 'docker', 'kubernetes', 'aws', 'gcp',
  'google cloud', 'azure', 'ci/cd', 'github actions', 'jenkins', 'terraform',
  'linux', 'bash', 'microservices', 'system design', 'unit testing', 'jest',
  'cypress', 'playwright', 'agile', 'scrum', 'git', 'github', 'figma',
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
  // Ten sam filtr optionalności stosuje checklista formalna; rozjazd między
  // silnikami powodował, że „Mile widziane Entra ID.” obniżało pokrycie.
  const requiredText = stripPreferredRequirementText(stripInferredPastedOfferHeader(jdText));
  const hardSkills: { phrase: string; weight: number }[] = [];
  const formalReqs: { phrase: string; weight: number }[] = [];
  const softSkills: { phrase: string; weight: number }[] = [];

  // 1. Stage 3 Compound N-Gram Check (Multi-word skills)
  // `includes` na surowym tekście mylił `cit` w `city` i `go` w `good` —
  // strona ogłoszenia też wymaga granic słów (bez oceny intencji).
  for (const compound of KNOWN_COMPOUND_SKILLS) {
    if (containsPhrase(requiredText, compound)) {
      hardSkills.push({ phrase: compound, weight: 3.0 });
    }
  }

  // „ServiceNow lub Jira” jest jednym wymaganiem alternatywnym, nie listą,
  // której kandydat musi spełnić każdy element. Zostawiamy kanoniczną nazwę
  // ServiceNow w wyniku i zapisujemy tylko ją do licznika.
  const hasServiceNowJiraAlternative = /servicenow\s+(?:or|lub)\s+jira\b/i.test(requiredText);
  if (hasServiceNowJiraAlternative) {
    hardSkills.push({ phrase: 'servicenow', weight: 3.0 });
  }
  if (containsPhrase(requiredText, 'incident triage') && !hardSkills.some((item) => item.phrase === 'incident triage')) {
    hardSkills.push({ phrase: 'incident triage', weight: 3.0 });
  }

  // 2. Stage 4 Known Hard Skills Dictionary Check
  for (const skill of KNOWN_HARD_SKILLS) {
    if (hasServiceNowJiraAlternative && skill === 'jira') continue;
    if (containsPhrase(requiredText, skill)) {
      // Avoid adding single word if already covered in a compound
      if (!hardSkills.some((h) => h.phrase !== skill && containsPhrase(h.phrase, skill))) {
        hardSkills.push({ phrase: skill, weight: 3.0 });
      }
    }
  }

  // 3. Stage 4 Formal Requirements Check
  for (const req of FORMAL_REQ_KEYWORDS) {
    if (containsPhrase(requiredText, req)) {
      formalReqs.push({ phrase: req, weight: 2.0 });
    }
  }

  // 4. Soft Skills Check
  for (const soft of SOFT_SKILLS_NOISE) {
    if (containsPhrase(requiredText, soft)) {
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
      // Nazwy stanowisk występują w ogłoszeniach w przypadkach zależnych
      // (np. „poszukujemy specjalisty”). Bez odmian ekstraktor brał takie
      // słowo za brakującą kompetencję, mimo że jego forma podstawowa była
      // już na liście generycznych nazw ról.
      'specjalista', 'specjalisty', 'specjalistę', 'specjalistą', 'specjaliście',
      'specjalistka', 'specjalistki', 'specjalistkę', 'specjalistką', 'specjalistce',
      // Angielski wariant stanowiska z oferty był wyciągany z tytułu jako
      // brakująca umiejętność (np. "IT Support Specialist").
      'specialist', 'specialists',
      'technician', 'technicians',
      'it', 'support',
      'fullstack', 'full', 'stack', 'developer', 'developers', 'developera', 'developerkę',
      'developerem', 'developerowi', 'engineer', 'inzynier', 'inżynier',
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
    requiredText.match(new RegExp(`(?<![\\p{L}\\p{N}_])${CAP_TOKEN}(?:\\s+${CAP_TOKEN})*(?![\\p{L}\\p{N}_])`, 'gu')) || [];
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
    if (hasServiceNowJiraAlternative && cleanPhrase === 'Jira') continue;
    if (knownPhrasesList.some((k) => cleanPhrase !== k && containsPhrase(cleanPhrase, k))) continue;
    if (hardSkills.some((h) => containsPhrase(h.phrase, cleanPhrase))) continue;
    if (hardSkills.some((h) => strippedLower(h.phrase) === cleanPhrase)) continue;

    // Sygnał techniczny: akronim, cyfra, znak stosu — albo powtórzenie w JD.
    const tokens = cleaned.split(/\s+/);
    const hasTechSignal =
      tokens.some((t) => /^[A-Z\u0104\u0106\u0118\u0141\u0143\u00D3\u015A\u0179\u017B]{2,6}$/.test(t) || /[0-9#+./-]/.test(t)) ||
      knownPhrases.has(cleanPhrase);
    const occurrences = (requiredText.match(new RegExp(escapeForCount(cleaned), 'gi')) ?? []).length;
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
      return item.phrase.length >= 3 && hasRequiredRequirementMention(jdText, item.phrase);
    });

  const uniqueFormal = Array.from(new Map(formalReqs.map((item) => [item.phrase, item])).values())
    .filter((item) => item.phrase.length >= 3 && hasRequiredRequirementMention(jdText, item.phrase));

  const uniqueSoft = Array.from(new Map(softSkills.map((item) => [item.phrase, item])).values())
    .filter((item) => hasRequiredRequirementMention(jdText, item.phrase));

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
  ]);
  const candidateCorpora = buildCandidateEvidenceCorpora(vault);
  // Resume moze byc redagowany pod oferte; tylko twierdzenia z Vaultu potwierdzaja wymaganie.
  const skillEvidenceText = candidateCorpora.skills.toLowerCase();
  const formalEvidenceText = candidateCorpora.formal.toLowerCase();

  const candidateContentParts = [
    summaryText,
    ...highlightTexts,
    ...skillsList,
    ...licenseTexts,
    ...languageTexts,
    ...certificationTexts,
    ...vault.history.flatMap((h) => [h.description || '', ...h.highlights.map((hl) => hl.text)]),
    ...vault.education.flatMap((e) => [e.degree, e.fieldOfStudy]),
    ...vault.projects.flatMap((p) => [p.description, ...p.techStack]),
  ];
  const hasDiagnosticContent = hasAtsDiagnosticContent(candidateContentParts);
  const fullCvTextParts = [
    ...candidateContentParts,
    vault.personalInfo.fullName,
    vault.personalInfo.email,
    vault.personalInfo.phone,
    vault.personalInfo.location,
    vault.personalInfo.title,
    ...vault.history.flatMap((h) => [h.company, h.role]),
    ...vault.education.flatMap((e) => [e.institution]),
    ...vault.projects.flatMap((p) => [p.name]),
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

  // Tekst CV nie ujawnia ukladu PDF. Rozpoznajemy tylko wyrazne sekwencje
  // symboli skali; procenty i wyniki typu 10/10 moga byc prawdziwymi metrykami.
  if (/[★●■▰]{2,}/u.test(fullCvText)) {
    unparsableElementsWarnings.push('Wykryto powtarzane symbole, kt\u00f3re mog\u0105 zast\u0119powa\u0107 opis poziomu umiej\u0119tno\u015bci. Z samego tekstu nie da si\u0119 oceni\u0107 uk\u0142adu PDF ani zachowania konkretnego ATS; je\u015bli to skala poziomu, dopisz potwierdzony opis s\u0142owny.');
  }

  // Ten sam parser obsługuje daty profilu, stażu i walidatora spójności.
  // Własny regex odrzucał kanoniczne YYYY-MM, a jednocześnie akceptował 99/2020.
  for (const exp of vault.history) {
    if (!exp.startDate) continue;
    if (parseDateToDecimalYear(exp.startDate) === null) {
      badDateFormats.push(`Nie rozpoznano daty początkowej w "${exp.company}": "${exp.startDate}". Użyj poprawnego formatu RRRR-MM lub MM.RRRR.`);
    }
    if (exp.endDate && parseDateToDecimalYear(exp.endDate) === null) {
      badDateFormats.push(`Nie rozpoznano daty końcowej w "${exp.company}": "${exp.endDate}". Użyj poprawnego formatu RRRR-MM, MM.RRRR lub "Obecnie".`);
    }
  }

  // Contact Info completeness
  if (!vault.personalInfo.email || !isPlausibleEmailAddress(vault.personalInfo.email)) {
    ocrWarnings.push('Brak prawidłowego adresu e-mail w sekcji danych osobowych.');
  }
  if (!vault.personalInfo.phone || vault.personalInfo.phone.trim().length < 6) {
    ocrWarnings.push('Brak podanego numeru telefonu kontaktowego.');
  }

  const headerNormalizationScore = hasDiagnosticContent
    ? missingStandardSections.length === 0 ? 100 : Math.max(50, 100 - missingStandardSections.length * 25)
    : null;
  const layoutScore = hasDiagnosticContent
    ? unparsableElementsWarnings.length === 0 ? 100 : Math.max(60, 100 - unparsableElementsWarnings.length * 20)
    : null;
  // Sam ekstrakt tekstu nie pozwala wiarygodnie odtworzyc geometrii kolumn PDF.
  const isSingleColumnCompliant: boolean | null = null;

  const structureScore = headerNormalizationScore === null || layoutScore === null
    ? null
    : Math.round((headerNormalizationScore + layoutScore) / 2);
  const formattingScore: number | null = null; // Ekstrakt tekstowy nie zawiera geometrii ani stylow PDF.

  // ==================== LAYER 2: NLP & LEMMATIZED MATCHING ====================
  const lemmatizedMatches: LemmatizedMatch[] = [];
  const matchedKeywords: string[] = [];
  const missingHardSkills: string[] = [];
  const missingFormalRequirements: string[] = [];
  const missingSoftSkills: string[] = [];
  const knockoutReport = auditKnockouts(jobDescription, vault);
  const satisfiedKnockoutLabels = knockoutReport.findings
    .filter((f) => f.satisfied)
    .map((f) => f.label);
  const unconfirmedKnockoutLabels = knockoutReport.unconfirmed.map((finding) => finding.label);

  // Match Hard Skills with Polish Stemmer / Lemmatization
  let matchedHardWeight = 0;
  let totalHardWeight = 0;

  for (const hard of dynamicJd.hardSkills) {
    // Sama nazwa certyfikatu nie potwierdza jego aktualności. Wymóg UNKNOWN
    // pomijamy zamiast pokazywać go jako pełne pokrycie albo jako brak.
    if (unconfirmedKnockoutLabels.some((label) => containsPhrase(label, hard.phrase) || containsPhrase(hard.phrase, label))) {
      continue;
    }
    totalHardWeight += hard.weight;
    const isMatched = isLemmatizedMatch(hard.phrase, skillEvidenceText);

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

  for (const formal of dynamicJd.formalReqs) {
    // Nie naliczamy niezweryfikowanej aktualności jako brakującego dokumentu.
    if (unconfirmedKnockoutLabels.some((label) => containsPhrase(label, formal.phrase) || containsPhrase(formal.phrase, label))) {
      continue;
    }
    totalFormalWeight += formal.weight;
    const byText = isLemmatizedMatch(formal.phrase, formalEvidenceText);
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
    } else {
      missingFormalRequirements.push(formal.phrase);
    }
  }

  // Filter Soft Skills (down-weighted noise)
  for (const soft of dynamicJd.softSkills) {
    const isMatched = isLemmatizedMatch(soft.phrase, skillEvidenceText);
    if (!isMatched) {
      missingSoftSkills.push(soft.phrase);
    }
  }

  // Puste ogłoszenie (zero wykrytych wymagań) to brak mianownika, nie 100%
  // pokrycia — wcześniej puste JD dawało 90/100 pewności z niczego (F4).
  const hardSkillsCoverage = totalHardWeight > 0 ? Math.round((matchedHardWeight / totalHardWeight) * 100) : null;
  const formalReqsCoverage = totalFormalWeight > 0 ? Math.round((matchedFormalWeight / totalFormalWeight) * 100) : null;

  // ==================== LAYER 3: SCORING ALGEBRA (RECENCY & TITLE DENSITY) ====================
  
  // Świeżość opieramy na datowanych wpisach, nie na kolejności tablicy ani nazwie firmy.
  const datedHistory = (vault.history || [])
    .map((experience) => {
      const start = parseYearMonthToNumbers(experience.startDate);
      const end = experience.isCurrent
        ? parseYearMonthToNumbers('obecnie')
        : parseYearMonthToNumbers(experience.endDate);
      if (!start || !end) return null;
      const startMonth = start.year * 12 + start.month;
      const endMonth = end.year * 12 + end.month;
      if (endMonth < startMonth) return null;
      const text = `${experience.description || ''} ${(experience.highlights || []).map((highlight) => highlight.text).join(' ')}`;
      return { text, startMonth, endMonth };
    })
    .filter((entry): entry is { text: string; startMonth: number; endMonth: number } => entry !== null)
    .sort((a, b) => b.endMonth - a.endMonth || b.startMonth - a.startMonth);

  // Dopasowanie do bieżącego, dwóch kolejnych lub starszego datowanego wpisu.
  let recencyScoreSum = 0;
  let recencyCount = 0;

  for (const match of lemmatizedMatches.filter((candidate) => candidate.category === 'HARD_SKILL')) {
    const kw = match.keywordFromJD;
    // Bez żadnego datowanego wpisu nie ma mianownika dla świeżości użycia.
    if (datedHistory.length === 0) continue;
    recencyCount++;
    const evidenceIndex = datedHistory.findIndex((experience) => hasPositiveSkillEvidence(experience.text, kw));
    if (evidenceIndex === 0) {
      recencyScoreSum += 100;
    } else if (evidenceIndex > 0 && evidenceIndex <= 2) {
      recencyScoreSum += 70;
    } else if (evidenceIndex > 2) {
      recencyScoreSum += 40;
    } else {
      // Matryca, szkoła i summary bez dat nie dowodzą, kiedy użyto umiejętności.
      recencyScoreSum += 0;
    }
  }

  // Brak datowanych wpisów daje brak oceny, a nie zerową świeżość ani bonus.
  const recencyScore = recencyCount > 0 ? Math.round(recencyScoreSum / recencyCount) : null;

  // Tytul mozna porownac tylko wtedy, gdy oferta i profil zawieraja role.
  const targetTitle = (resume.targetJobTitle || '').trim();
  const currentCvTitle = (vault.personalInfo.title || '').trim();
  const pastRolesTitles = vault.history.map((history) => history.role || '').join(' ').trim();
  const candidateTitles = [currentCvTitle, pastRolesTitles].filter(Boolean).join(' ');
  let titleMatchScore: number | null = null;
  const hasMeaningfulCandidateTitle = /[\p{L}\p{N}]/u.test(candidateTitles);
  if (targetTitle && hasMeaningfulCandidateTitle) {
    if (currentCvTitle && isLemmatizedMatch(targetTitle, currentCvTitle)) {
      titleMatchScore = 100;
    } else if (pastRolesTitles && isLemmatizedMatch(targetTitle, pastRolesTitles)) {
      titleMatchScore = 75;
    } else {
      titleMatchScore = 45;
    }
  }

  // Pokrycie obejmuje zarowno wymagania twarde, jak i formalne; liczniki sa
  // wazone ich rzeczywistymi wagami, wiec brak jednej kategorii nie staje sie zerem.
  const totalRequirementWeight = totalHardWeight + totalFormalWeight;
  const keywordCoverageScore = totalRequirementWeight > 0
    ? Math.round(((matchedHardWeight + matchedFormalWeight) / totalRequirementWeight) * 100)
    : null;
  const hardSkillScore = hardSkillsCoverage;

  const algebraComponents = [
    ...(keywordCoverageScore !== null ? [{ label: 'pokrycie wymagan', score: keywordCoverageScore, weight: 3.0 }] : []),
    ...(recencyCount > 0 && recencyScore !== null ? [{ label: 'dated skill use', score: recencyScore, weight: 1.5 }] : []),
    ...(titleMatchScore !== null ? [{ label: 'title', score: titleMatchScore, weight: 1.5 }] : []),
  ];
  const algebraWeight = algebraComponents.reduce((sum, component) => sum + component.weight, 0);
  const weightedAlgebraScore = algebraWeight === 0 ? 0 : Math.round(
    algebraComponents.reduce((sum, component) => sum + component.score * component.weight, 0) / algebraWeight
  );

  // Wynik diagnostyczny laczy strukture tekstu z kompletnoscia kontaktu i zapisem dat.
  const structurePenalty = structureScore === null ? 0 : (100 - structureScore) * 0.15;
  const noRequirements = totalHardWeight === 0 && totalFormalWeight === 0;
  const overallScore = noRequirements
    ? null
    : Math.max(0, Math.min(100, Math.round(weightedAlgebraScore - structurePenalty)));

  const formulaBreakdown = noRequirements
    ? 'Wyniku zbiorczego nie obliczono: oferta nie zawiera rozpoznanych wymagan.'
    : algebraWeight === 0
      ? 'Nie oceniono - brak porownywalnych kryteriow.'
      : `Ocenione skladniki: ${algebraComponents.map((component) => `${component.label} ${component.score}% x ${component.weight}`).join(' + ')}; dostepna waga ${algebraWeight}/6; kara diagnostyczna za tekstowa strukture CV ${Math.round(structurePenalty)}%.`;

  // Gap Analysis & Actionable Recommendations
  const gapAnalysis: string[] = [];
  const recommendations: string[] = [];
  const missingKeyRequirements = Array.from(new Set([...missingHardSkills, ...missingFormalRequirements]));

  if (missingKeyRequirements.length > 0) {
    if (missingHardSkills.length > 0) {
      gapAnalysis.push(
        `Brakujące wymagania twarde z ogłoszenia: ${missingHardSkills.slice(0, 6).join(', ')}.`
      );
    }
    if (missingFormalRequirements.length > 0) {
      gapAnalysis.push(
        `Brakujące wymagania formalne z ogłoszenia: ${Array.from(new Set(missingFormalRequirements)).slice(0, 6).join(', ')}.`
      );
    }
    recommendations.push(
      `Brakujące wymagania: ${missingKeyRequirements.slice(0, 3).join(', ')}. Uzupełnij właściwą sekcję profilu tylko wtedy, gdy masz na to potwierdzone fakty; w przeciwnym razie pozostaw je jako luki.`
    );
  } else {
    gapAnalysis.push(unconfirmedKnockoutLabels.length > 0
      ? `Nie można potwierdzić aktualności części wymagań formalnych: ${unconfirmedKnockoutLabels.slice(0, 6).join(', ')}.`
      : 'Wszystkie rozpoznane wymagania techniczne i formalne z ogłoszenia znajdują się w Twoim profilu.');
  }

  if (recencyScore !== null && recencyScore < 70) {
    recommendations.push('Sprawdź daty i role, w których faktycznie używałeś wykrytych umiejętności. Nie przenoś umiejętności do nowszego stanowiska bez potwierdzenia.');
  }

  if (targetTitle && !currentCvTitle) {
    recommendations.push('W profilu nie podano tytułu zawodowego. Dodaj go tylko wtedy, gdy rzetelnie opisuje Twoje doświadczenie; nie wpisuj nazwy oferty jako przebytego stanowiska.');
  } else if (targetTitle && currentCvTitle && titleMatchScore !== null && titleMatchScore < 75) {
    recommendations.push(`Nazwa stanowiska z oferty ("${targetTitle}") różni się od nagłówka profilu ("${currentCvTitle}"). Zachowaj prawdziwe nazwy stanowisk; użyj nazwy docelowej jako nagłówka CV tylko wtedy, gdy trafnie opisuje Twoje kwalifikacje.`);
  }

  if (unparsableElementsWarnings.length > 0) {
    recommendations.push('Czytelno\u015b\u0107 tekstu: sprawd\u017a, czy powtarzane symbole rzeczywi\u015bcie oznaczaj\u0105 poziom umiej\u0119tno\u015bci; dopisz potwierdzony opis s\u0142owny. Uk\u0142ad PDF i OCR nie zosta\u0142y tu sprawdzone.');
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
  score: number | null;
  status: 'OPTIMAL' | 'ACCEPTABLE' | 'RISKY' | 'REJECTED' | 'NOT_ASSESSED' | 'REVIEW_REQUIRED' | 'NO_SIGNALS';
  keyStrengths: string[];
  penaltiesAndFlags: string[];
  recommendation: string;
  proposals: string[];
  weightsFocus: string;
}

export interface MultiEngineAtsConsensus {
  medianScore: number | null;
  assessedEngineCount: number;
  meanScore: number | null;
  minScore: number | null;
  maxScore: number | null;
  consensusGrade: 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK' | 'CRITICAL_RISK' | 'INSUFFICIENT_DATA';
  summaryJustification: string;
  careerFitAdvice: {
    assessment: 'PLAUSIBLE_FIT' | 'SIGNIFICANT_GAPS' | 'INSUFFICIENT_EVIDENCE';
    isRealisticFit: boolean;
    verdict: string;
    actionablePlan: string;
    suggestedAlternativeRoles: string[];
  };
  engines: AtsEngineResult[];
  globalBestPractices: { title: string; badExample: string; goodExample: string; explanation: string }[];
}

export function calculateMedian(scores: number[]): number | null {
  if (scores.length === 0) return null;
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
    atsScore: null,
  };

  const baseResult = simulateAtsCheck(
    dummyResume,
    safeVault,
    jobOfferText
  );

  const hardCoverage = baseResult.layer2Nlp.hardSkillsCoverage;
  const recencyScore = baseResult.layer3Scoring.recencyScore;
  const titleScore = baseResult.layer3Scoring.titleMatchScore;
  const hasCandidateTitleEvidence = /[\p{L}\p{N}]/u.test([safeVault.personalInfo.title, ...(safeVault.history || []).map((experience) => experience.role || '')].join(' '));
  const hasCareerEvidenceInProfile = hasCareerEvidence(safeVault);
  const missingHardCount = baseResult.missingHardSkills.length;
  const datedExperiences = (safeVault.history || []).filter(experience => employmentIntervalForJob(experience) !== null);
  const hasRecencyEvidence = datedExperiences.length > 0
    && baseResult.layer2Nlp.lemmatizedMatches.some((match) => match.category === 'HARD_SKILL');

  // Weryfikacja obecności twardych metryk liczbowych w historii
  // Wykształcenie i certyfikaty nie są zgodnością z ofertą, dopóki nie ma
  // konkretnego wymogu formalnego do sprawdzenia.

  // 1. Moduł Struktury i Czytelności OCR (cvUniversalParser / Warstwa 1)
  const engine1: AtsEngineResult = {
    id: 'struktura_ocr',
    name: 'Audytor Struktury i Odczytu Maszynowego',
    component: 'cvUniversalParser.ts (Warstwa 1)',
    category: 'Uklad dokumentu i parsowalnosc',
    // Ten modul nie dostaje pliku CV, wiec profil nie jest dowodem ukladu ani OCR.
    score: null,
    status: 'NOT_ASSESSED',
    weightsFocus: 'Nie oceniono - do audytu ukladu i OCR potrzebny jest rzeczywisty plik CV.',
    keyStrengths: ['Brak pliku CV do sprawdzenia ukladu i warstwy tekstowej.'],
    penaltiesAndFlags: [],
    recommendation: 'Dodaj dokument CV, aby sprawdzic jego tekst i uklad.',
    proposals: [],
  };

  // Moduly 2: pomiar dotyczy pokrycia rozpoznanych wymagan, nie jakosci lematyzacji.
  const hasHardRequirementEvidence = missingHardCount > 0
    || baseResult.layer2Nlp.lemmatizedMatches.some((match) => match.category === 'HARD_SKILL');
  const lematyzatorScore = hasHardRequirementEvidence && hardCoverage !== null ? hardCoverage : null;
  const engine2: AtsEngineResult = {
    id: 'slowa_kluczowe_fleksja',
    name: 'Analizator Slow Kluczowych i Odmiany Polskiej',
    component: 'atsSimulator.ts (Lematyzator Fleksyjny)',
    category: 'Dopasowanie semantyczne i slownikowe',
    score: lematyzatorScore,
    status: lematyzatorScore === null ? 'NOT_ASSESSED' : lematyzatorScore >= 80 ? 'OPTIMAL' : lematyzatorScore >= 65 ? 'ACCEPTABLE' : lematyzatorScore >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: lematyzatorScore === null
      ? 'Nie oceniono - oferta nie zawiera rozpoznanych wymagan twardych.'
      : 'Odsetek wymagan twardych z potwierdzeniem w profilu (100%); poprawnosci lematyzacji nie mierzono osobno.',
    keyStrengths: [
      lematyzatorScore === null ? 'Brak wymagan twardych do sprawdzenia' : `Pokrycie rozpoznanych wymagan twardych: ${hardCoverage}%`,
    ],
    penaltiesAndFlags: [
      ...(missingHardCount > 0 ? [`Brak ${missingHardCount} kluczowych pojec/technologii wymienionych w ofercie`] : []),
    ],
    recommendation: lematyzatorScore === null
      ? 'Wklej oferte zawierajaca wymagania twarde, aby porownac je z profilem.'
      : 'Uzupelniaj profil tylko informacjami, ktore mozesz potwierdzic.',
    proposals: lematyzatorScore !== null && missingHardCount > 0
      ? [`Sprawdz, czy masz potwierdzenie dla: ${baseResult.missingHardSkills?.slice(0, 3).join(', ')}.`]
      : [],
  };

  // 3. Moduł Kryteriów Formalnych i Uprawnień (knockouts.ts)
  const formalRequirements = auditKnockouts(jobOfferText, safeVault);
  const hasAssessableFitRequirements = hasHardRequirementEvidence || formalRequirements.requirementCount > 0;
  const knockoutsScore = formalRequirements.requirementCount > 0
    ? Math.round((formalRequirements.satisfiedCount / formalRequirements.requirementCount) * 100)
    : null;
  const formalRequirementsSummary = formalRequirements.requirementCount === 0
    ? 'Oferta nie zawiera wykrytych wymagań formalnych obsługiwanych przez tę regułę.'
    : `Spełniono ${formalRequirements.satisfiedCount} z ${formalRequirements.requirementCount} wykrytych wymagań formalnych.`;
  const engine3: AtsEngineResult = {
    id: 'kryteria_formalne',
    name: 'Audytor Wykrytych Wymagań Formalnych',
    component: 'knockouts.ts (Kryteria Zero-Jedynkowe)',
    category: 'Uprawnienia i kwalifikacje wymagane w ofercie',
    score: knockoutsScore,
    status: knockoutsScore === null ? 'NOT_ASSESSED' : knockoutsScore >= 80 ? 'OPTIMAL' : knockoutsScore >= 65 ? 'ACCEPTABLE' : knockoutsScore >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: formalRequirements.requirementCount > 0
      ? 'Spełnione wykryte wymagania formalne / wszystkie wykryte wymagania formalne (100%)'
      : 'Nie oceniono — oferta nie zawiera wykrytych wymagań formalnych',
    keyStrengths: [formalRequirementsSummary],
    penaltiesAndFlags: formalRequirements.blocking.map((finding) => `Brak potwierdzenia wymogu: ${finding.label}`),
    recommendation: formalRequirements.requirementCount === 0
      ? 'Ten moduł ocenia tylko rozpoznane wymagania formalne. Nie wyciągaj wniosków o wykształceniu ani uprawnieniach, których oferta nie wymaga.'
      : formalRequirements.blocking.length > 0
        ? 'Sprawdź brakujące wymagania formalne. Dodaj je do profilu tylko wtedy, gdy faktycznie je posiadasz.'
        : 'Wymagania formalne rozpoznane w ofercie mają potwierdzenie w profilu.',
    proposals: formalRequirements.requirementCount === 0
      ? []
      : formalRequirements.blocking.length > 0
        ? [`Zweryfikuj w dokumentach: ${formalRequirements.blocking.map((finding) => finding.label).join(', ')}.`]
        : ['Porównaj nazwy potwierdzonych kwalifikacji z dokumentami, które je poświadczają.'],
  };

  // 4. Moduł Świeżości Umiejętności (Recency Bias & relevanceRanking.ts)
  const recencyScoreEngine = hasRecencyEvidence && recencyScore !== null && hardCoverage !== null
    ? Math.min(100, Math.max(0, Math.round(recencyScore * 0.70 + hardCoverage * 0.30)))
    : null;
  const engine4: AtsEngineResult = {
    id: 'swiezosc_umiejetnosci',
    name: 'Weryfikator Świeżości Umiejętności',
    component: 'relevanceRanking.ts (Aktualność Ostatnich 2 Lat)',
    category: 'Dynamika i aktualność kompetencji',
    score: recencyScoreEngine,
    status: recencyScoreEngine === null ? 'NOT_ASSESSED' : recencyScoreEngine >= 80 ? 'OPTIMAL' : recencyScoreEngine >= 65 ? 'ACCEPTABLE' : recencyScoreEngine >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: recencyScoreEngine === null
      ? 'Nie oceniono — brak dopasowanych umiejętności i datowanego doświadczenia'
      : 'Wystąpienie dopasowanych umiejętności w datowanych wpisach (70%), pokrycie (30%)',
    keyStrengths: [
      recencyScoreEngine === null
        ? 'Za malo danych o datowanym uzyciu dopasowanych umiejetnosci'
        : recencyScore !== null && recencyScore >= 75 ? 'Dopasowane umiejetnosci wystepuja w najnowszych wpisach' : 'Dopasowane umiejetnosci nie wystepuja w najnowszych wpisach',
    ],
    penaltiesAndFlags: [
      ...(recencyScoreEngine !== null && recencyScore !== null && recencyScore < 70
        ? ['Czesc dopasowanych umiejetnosci nie wystepuje w najnowszych datowanych wpisach']
        : []),
    ],
    recommendation: recencyScoreEngine === null
      ? 'Dodaj rzeczywiste datowane doswiadczenie, jesli chcesz ocenic swiezosc uzycia umiejetnosci.'
      : 'Opisuj umiejetnosci w tych rolach, w ktorych faktycznie byly uzywane; nie przenos ich miedzy stanowiskami.',
    proposals: recencyScoreEngine !== null && recencyScore !== null && recencyScore < 70
      ? ['Sprawdz, czy masz nowsze datowane doswiadczenie potwierdzajace dopasowane umiejetnosci.']
      : [],
  };

  // 5. Moduł Zgodności Tytułu Stanowiska (Title Matcher)
  const hasHardCoverageForTitle = hasHardRequirementEvidence && hardCoverage !== null;
  const titleScoreEngine = targetRoleTitle.trim() && hasCandidateTitleEvidence && titleScore !== null
    ? Math.min(100, Math.max(0, Math.round(
      hasHardCoverageForTitle
        ? titleScore * 0.75 + hardCoverage * 0.25
        : titleScore
    )))
    : null;
  const engine5: AtsEngineResult = {
    id: 'zgodnosc_tytulu',
    name: 'Weryfikator Naglowka i Nazwy Stanowiska',
    component: 'atsSimulator.ts (Dopasowanie Tytulu Roli)',
    category: 'Zbieznosc roli i pozycjonowanie kandydata',
    score: titleScoreEngine,
    status: titleScoreEngine === null ? 'NOT_ASSESSED' : titleScoreEngine >= 80 ? 'OPTIMAL' : titleScoreEngine >= 65 ? 'ACCEPTABLE' : titleScoreEngine >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: titleScoreEngine === null
      ? 'Nie oceniono - potrzebny tytul stanowiska w ofercie i tytul kandydata w profilu lub historii.'
      : hasHardCoverageForTitle
        ? 'Zgodnosc tytulu (75%) i pokrycie rozpoznanych wymagan twardych (25%).'
        : 'Zgodnosc tytulu; nie znaleziono wymagan twardych do dolaczenia do wyniku.',
    keyStrengths: [
      titleScoreEngine === null || titleScore === null ? 'Brak danych do porownania tytulow' : titleScore >= 75 ? 'Naglowek profilu odpowiada szukanemu stanowisku' : 'Tytuly stanowisk czesciowo sie roznia',
    ],
    penaltiesAndFlags: [
      ...(titleScoreEngine !== null && titleScore !== null && titleScore < 70 ? ['Naglowek profilu rozni sie od nazwy stanowiska w ogloszeniu'] : []),
    ],
    recommendation: titleScoreEngine === null
      ? 'Dodaj tytul stanowiska z oferty oraz faktyczny tytul kandydata, aby je porownac.'
      : 'Sprawdz, czy naglowek CV zgodnie opisuje doswiadczenie kandydata.',
    proposals: titleScoreEngine === null ? [] : [
      `Rozwaz naglowek: "${targetRoleTitle}" - tylko jesli odpowiada udokumentowanemu doswiadczeniu.`,
    ],
  };

  // 6. Moduł Twardych Liczb i Metryk Osiągnięć (drillEngine & elevatorPitchEngine)
  // Mierz udzial opisow z metryka; bez opisow nie ma mianownika.
  const experienceHighlights = (safeVault.history || [])
    .flatMap((exp) => exp?.highlights || [])
    .filter((highlight) => typeof highlight?.text === 'string' && highlight.text.trim().length > 0);
  const measurableHighlights = experienceHighlights.filter((highlight) =>
    hasMeasurableMetric(highlight.text, highlight.metric)
  );
  const metricsScoreEngine = experienceHighlights.length > 0
    ? Math.round((measurableHighlights.length / experienceHighlights.length) * 100)
    : null;
  const engine6: AtsEngineResult = {
    id: 'metryki_liczbowe',
    name: 'Analizator Twardych Liczb i Wynikow KPI',
    component: 'consistencyGuard/timelineAuditor.ts (wykrywanie metryk)',
    category: 'Udzial opisow doswiadczenia z wykryta metryka',
    score: metricsScoreEngine,
    status: metricsScoreEngine === null ? 'NOT_ASSESSED' : metricsScoreEngine >= 80 ? 'OPTIMAL' : metricsScoreEngine >= 65 ? 'ACCEPTABLE' : metricsScoreEngine >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: metricsScoreEngine === null
      ? 'Nie oceniono ? brak opisow doswiadczenia do sprawdzenia'
      : 'Odsetek opisow doswiadczenia z wykryta metryka (100%)',
    keyStrengths: [
      metricsScoreEngine === null
        ? 'Brak opisow doswiadczenia do oceny obecnosci metryk'
        : `Wykryto metryke w ${measurableHighlights.length} z ${experienceHighlights.length} opisow doswiadczenia`,
    ],
    penaltiesAndFlags: [
      ...(metricsScoreEngine !== null && measurableHighlights.length < experienceHighlights.length
        ? [`Nie wykryto metryki w ${experienceHighlights.length - measurableHighlights.length} z ${experienceHighlights.length} opisow doswiadczenia`]
        : []),
    ],
    recommendation: metricsScoreEngine === null
      ? 'Dodaj rzeczywiste opisy doswiadczenia, jesli je masz. Nie uzupelniaj wyniku wymyslonymi liczbami.'
      : 'Dodawaj liczby tylko tam, gdzie mozesz potwierdzic wynik; opis jakosciowy tez jest wartosciowy.',
    proposals: metricsScoreEngine !== null && measurableHighlights.length < experienceHighlights.length
      ? ['Uzupelnij brakujace wyniki wylacznie danymi, ktore mozesz potwierdzic.']
      : [],
  };

  // 7. Moduł Naturalności i Gęstości Słów (Brak spamu / Stuffing Guard)
  // Mierzymy, ile dopasowanych umiej?tno?ci z oferty ma dodatni dow?d w narracji profilu.
  // To nie jest automatyczna ocena j?zykowej naturalno?ci ani detector zewn?trznego ATS.
  const matchedHardSkills = baseResult.layer2Nlp.lemmatizedMatches
    .filter((match) => match.category === 'HARD_SKILL');
  const narrativeText = [
    safeVault.personalInfo?.summary || '',
    ...(safeVault.history || []).flatMap((experience) => [
      experience.description || '',
      ...(experience.highlights || []).map((highlight) => highlight.text || ''),
    ]),
    ...(safeVault.projects || []).map((project) => project.description || ''),
  ].filter(Boolean).join(' ');
  const narrativeEvidenceCount = matchedHardSkills.filter((match) =>
    hasPositiveSkillEvidence(narrativeText, match.keywordFromJD)
  ).length;
  const hasRelevantCareerSkillEvidence = narrativeEvidenceCount > 0 || hasRecencyEvidence;
  const hasFitEvidence = hasCareerEvidenceInProfile
    && hasAssessableFitRequirements
    && (hardCoverage === 0 || hasRelevantCareerSkillEvidence);
  const narrativeEvidenceScore = matchedHardSkills.length > 0
    ? Math.round((narrativeEvidenceCount / matchedHardSkills.length) * 100)
    : null;
  const engine7: AtsEngineResult = {
    id: 'naturalnosc_jezyka',
    name: 'Audytor dowodow umiejetnosci w opisach',
    component: 'skillEvidence.ts (dodatnie dowody w narracji profilu)',
    category: 'Dopasowane umiejetnosci z potwierdzeniem w opisach',
    score: narrativeEvidenceScore,
    status: narrativeEvidenceScore === null ? 'NOT_ASSESSED' : narrativeEvidenceScore >= 80 ? 'OPTIMAL' : narrativeEvidenceScore >= 65 ? 'ACCEPTABLE' : narrativeEvidenceScore >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: narrativeEvidenceScore === null
      ? 'Nie oceniono ? oferta nie zawiera dopasowanych umiejetnosci twardych'
      : 'Odsetek dopasowanych umiejetnosci z dodatnim dowodem w narracji',
    keyStrengths: [
      narrativeEvidenceScore === null
        ? 'Brak dopasowanych umiejetnosci do sprawdzenia w opisach'
        : `W opisach znaleziono dodatni sygnal dla ${narrativeEvidenceCount} z ${matchedHardSkills.length} dopasowanych umiejetnosci`,
    ],
    penaltiesAndFlags: narrativeEvidenceScore !== null && narrativeEvidenceCount < matchedHardSkills.length
      ? [`W opisie profilu nie znaleziono dodatniego dowodu dla ${matchedHardSkills.length - narrativeEvidenceCount} dopasowanych umiejetnosci`]
      : [],
    recommendation: narrativeEvidenceScore === null
      ? 'Dodaj wymagania oferty lub sprawdz ponownie konkretne dopasowania.'
      : 'Pokazuj umiejetnosci w prawdziwym opisie zadan; sama lista umiejetnosci nie potwierdza praktyki.',
    proposals: narrativeEvidenceScore !== null && narrativeEvidenceCount < matchedHardSkills.length
      ? ['Dopisz kontekst tylko dla umiejetnosci, ktorych uzycia mozesz potwierdzic.']
      : [],
  };

  // 8. Moduł Spójności Dat i Faktów (consistencyGuard)
  // Audyt dostaje całą historię: wcześniejszy filtr ukrywał nieczytelne wpisy
  // i zmieniał częściowe porównanie w pozornie wysoki wynik.
  const timelineAudit = auditExperienceTimelineAndMetrics(safeVault.history || []);
  const timelineAlerts = timelineAudit.alerts.filter(alert => alert.type !== 'MISSING_METRICS');
  const hasInvalidTimelineDates = timelineAlerts.some(alert => alert.type === 'INVALID_DATE_RANGE');
  const hasTimelineEvidence = datedExperiences.length >= 2 && !hasInvalidTimelineDates;
  const consistencyStatus: AtsEngineResult['status'] = !hasTimelineEvidence
    ? 'NOT_ASSESSED'
    : timelineAlerts.length > 0 ? 'REVIEW_REQUIRED' : 'NO_SIGNALS';
  const engine8: AtsEngineResult = {
    id: 'spojnosc_profilu',
    name: 'Strażnik spójności i ciągłości zatrudnienia',
    component: 'consistencyGuard/timelineAuditor.ts (audyt zapisanej historii)',
    category: 'Kompletność dat i sygnały chronologiczne',
    score: null,
    status: consistencyStatus,
    weightsFocus: hasTimelineEvidence
      ? 'Porównanie kompletnych okresów; uwagi nie są oceną jakości kariery ani karą punktową'
      : hasInvalidTimelineDates
        ? 'Nie oceniono pełnej chronologii — część wpisów ma niekompletne lub niepoprawne daty'
        : 'Nie oceniono — potrzeba co najmniej dwóch wpisów z czytelnymi, kompletnymi datami',
    keyStrengths: [
      hasInvalidTimelineDates
        ? 'Pełna chronologia niepotwierdzona; pominięte okresy są wskazane w uwagach'
        : !hasTimelineEvidence
        ? 'Za mało wpisów z datami, aby porównać ciągłość zatrudnienia'
        : timelineAlerts.length === 0
          ? 'Nie wykryto luk ani nakładania się okresów w sprawdzonych wpisach'
          : `Wykryto ${timelineAlerts.length} sygnałów wymagających sprawdzenia`,
    ],
    penaltiesAndFlags: timelineAlerts.map((alert) => alert.title),
    recommendation: hasInvalidTimelineDates
      ? 'Sprawdź wskazane daty w dokumentach. Nie wpisuj domyślnego końca ani przyszłego okresu, aby uzyskać ocenę.'
      : !hasTimelineEvidence
      ? 'Uzupełnij co najmniej dwa rzeczywiste wpisy z datami, jeśli chcesz sprawdzić ich chronologię.'
      : timelineAlerts.length > 0
        ? 'Sprawdź wykryte sygnały z dokumentami i doprecyzuj okresy tylko wtedy, gdy daty są nieprawidłowe.'
        : 'W badanych wpisach nie wykryto sygnałów chronologicznych; nie jest to pełna weryfikacja całego CV.',
    proposals: timelineAlerts.length > 0 ? ['Sprawdź zapisane okresy pracy z dokumentami źródłowymi.'] : [],
  };

  // 9. Przesiewowy Audyt Wymagań (quickAtsCheck)
  const quickComponents = [
    { label: 'pokrycie wymagan', score: hasHardRequirementEvidence ? hardCoverage : null, weight: 40 },
    { label: 'porownanie tytulow', score: titleScoreEngine, weight: 30 },
  ].filter((item): item is typeof item & { score: number } => item.score !== null);
  const quickAvailableWeight = quickComponents.reduce((sum, item) => sum + item.weight, 0);
  const quickScore = !hasFitEvidence || quickAvailableWeight === 0 ? null : Math.round(
    quickComponents.reduce((sum, item) => sum + item.score * item.weight, 0) / quickAvailableWeight
  );
  const engine9: AtsEngineResult = {
    id: 'przesiew_wymagan',
    name: 'Przesiewowy Tester Rekrutacyjny',
    component: 'quickAtsCheck.ts (Szybkie Sito Formalne)',
    category: 'Wstepna kwalifikacja aplikacji',
    score: quickScore,
    status: quickScore === null ? 'NOT_ASSESSED' : quickScore >= 80 ? 'OPTIMAL' : quickScore >= 65 ? 'ACCEPTABLE' : quickScore >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: quickScore === null
      ? 'Nie oceniono - brakuje historii/projektu lub potwierdzenia dopasowanych umiejetnosci w doswiadczeniu.'
      : `Ocenione skladniki: ${quickComponents.map((item) => `${item.label} ${item.weight}%`).join(', ')}. Dostepne ${quickAvailableWeight}% wag nominalnych; wynik przeskalowany do 100%. Ukladu pliku nie oceniono.`,
    keyStrengths: [
      quickScore === null ? 'Brak danych do przesiewowej oceny profilu' : quickScore >= 70 ? 'Dobre pokrycie rozpoznanych wymagan lub zgodnosc tytulow' : 'Wynik obejmuje tylko dostepne dane profilu',
    ],
    penaltiesAndFlags: [
      ...(quickScore !== null && quickScore < 60 ? ['Niskie dopasowanie wedlug regul Kierivo; sprawdz wykryte wymagania i dane profilu'] : []),
    ],
    recommendation: 'Sprawdz wykryte wymagania i porownaj je z potwierdzonymi danymi profilu.',
    proposals: quickScore === null ? [] : [
      'Dopasuj CV do jednego ogloszenia, uzywajac wylacznie potwierdzonych informacji.',
    ],
  };

  // 10. Główny Konsensus Kierivo (cvelocity_consensus)
  const consensusComponents = [
    { label: 'pokrycie umiejetnosci', score: hasHardRequirementEvidence ? hardCoverage : null, weight: 35 },
    { label: 'uzycie w datowanym doswiadczeniu', score: hasRecencyEvidence ? recencyScore : null, weight: 25 },
    { label: 'porownanie stanowisk', score: titleScoreEngine, weight: 10 },
    { label: 'opisy z wykryta metryka', score: metricsScoreEngine, weight: 10 },
  ];
  const assessedComponents = consensusComponents.filter(
    (component): component is typeof component & { score: number } => component.score !== null
  );
  const assessedWeight = assessedComponents.reduce((sum, component) => sum + component.weight, 0);
  const cvelocityScore = !hasFitEvidence || assessedWeight === 0 ? null : Math.round(
    assessedComponents.reduce((sum, component) => sum + component.score * component.weight, 0) / assessedWeight
  );
  const engine10: AtsEngineResult = {
    id: 'konsensus_cvelocity',
    name: 'Glowny Zrownowazony Konsensus Kierivo',
    component: 'atsSimulator.ts (agregacja ocenionych skladnikow)',
    category: 'Koncowa syntetyczna ocena profilu',
    score: cvelocityScore,
    status: cvelocityScore === null ? 'NOT_ASSESSED' : cvelocityScore >= 80 ? 'OPTIMAL' : cvelocityScore >= 65 ? 'ACCEPTABLE' : cvelocityScore >= 50 ? 'RISKY' : 'REJECTED',
    weightsFocus: !hasFitEvidence
      ? `Nie oceniono dopasowania kariery bez historii zatrudnienia lub projektu. Dostepne ${assessedWeight}% wag nominalnych dla ${assessedComponents.length} z ${consensusComponents.length} skladnikow.`
      : `Ocenione skladniki: ${assessedComponents.map((component) => `${component.label} ${component.weight}%`).join(', ')}. Dostepne ${assessedWeight}% wag nominalnych; wynik przeskalowany do 100%.`,
    keyStrengths: [
      `Wynik obejmuje ${assessedComponents.length} z ${consensusComponents.length} skladnikow z dostepnymi danymi`,
    ],
    penaltiesAndFlags: [
      ...(missingHardCount > 0 ? [`Brak ${missingHardCount} dopasowanych umiejetnosci z ogloszenia`] : []),
    ],
    recommendation: cvelocityScore === null
      ? 'Nie ma wystarczajacych danych do wyniku skladnikowego. Uzupelnij oferte albo dane profilu.'
      : 'Interpretuj wynik wraz z lista ocenionych skladnikow i brakow danych; nie jest to wynik zewnetrznego ATS.',
    proposals: [
      ...(missingHardCount > 0 ? ['Sprawdz wykryte braki i uzupelnij profil tylko potwierdzonymi informacjami.'] : []),
    ],
  };

  const engines = [engine1, engine2, engine3, engine4, engine5, engine6, engine7, engine8, engine9, engine10];
  const allScores = engines.flatMap((engine) => engine.score === null ? [] : [engine.score]);
  const medianScore = calculateMedian(allScores);
  const meanScore = allScores.length === 0 ? null : Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length);
  const minScore = allScores.length === 0 ? null : Math.min(...allScores);
  const maxScore = allScores.length === 0 ? null : Math.max(...allScores);

  const consensusGrade: MultiEngineAtsConsensus['consensusGrade'] = !hasFitEvidence || allScores.length === 0
    ? 'INSUFFICIENT_DATA'
    : medianScore !== null && medianScore >= 80 ? 'EXCELLENT' : medianScore !== null && medianScore >= 65 ? 'GOOD' : medianScore !== null && medianScore >= 50 ? 'NEEDS_WORK' : 'CRITICAL_RISK';

  // Sama lista umiejętności nie potwierdza praktyki ani doświadczenia. Bez
  // historii zatrudnienia lub projektów nie werdyktujemy dopasowania i nie
  // podsuwamy alternatywnych zawodów na podstawie niepełnego profilu.
  const hasSignificantFitGaps = (hasHardRequirementEvidence && ((hardCoverage !== null && hardCoverage < 60) || missingHardCount > 4))
    || formalRequirements.blocking.length > 0;
  const assessment: MultiEngineAtsConsensus['careerFitAdvice']['assessment'] = !hasFitEvidence
    ? 'INSUFFICIENT_EVIDENCE'
    : !hasSignificantFitGaps
      ? 'PLAUSIBLE_FIT'
      : 'SIGNIFICANT_GAPS';
  const isRealisticFit = assessment === 'PLAUSIBLE_FIT';
  const suggestedAlternativeRoles: string[] = [];

  const careerVerdict = assessment === 'INSUFFICIENT_EVIDENCE'
    ? !hasCareerEvidenceInProfile
      ? 'Nie da się rzetelnie ocenić dopasowania: brakuje merytorycznego opisu doświadczenia lub projektu. Same nazwy firm, stanowisk i projektów nie potwierdzają użycia umiejętności.'
      : !hasAssessableFitRequirements
        ? 'Nie da się rzetelnie ocenić dopasowania: oferta nie zawiera wymagań rozpoznanych przez te reguły.'
        : 'Profil zawiera dopasowane umiejętności, ale nie ma dowodu ich użycia w opisie doświadczenia lub projektu.'
    : isRealisticFit
      ? 'Stanowisko może odpowiadać udokumentowanemu doświadczeniu i wymaganiom rozpoznanym przez Kierivo; wynik nie przesądza o decyzji pracodawcy.'
      : 'Wykryto luki między udokumentowanym profilem a wymaganiami rozpoznanymi przez Kierivo.';

  const careerPlan = assessment === 'INSUFFICIENT_EVIDENCE'
    ? !hasCareerEvidenceInProfile
      ? 'Dodaj prawdziwy opis zadań lub projektu, jeśli możesz go potwierdzić; sama nazwa firmy, stanowiska lub projektu nie wystarcza do oceny.'
      : !hasAssessableFitRequirements
        ? 'Sprawdź wymagania ręcznie i porównaj je z udokumentowanym doświadczeniem; reguły nie rozpoznały tu kryteriów do oceny.'
        : 'Dodaj prawdziwy przykład użycia dopasowanej umiejętności w doświadczeniu lub projekcie, jeśli możesz go potwierdzić.'
    : isRealisticFit
      ? 'Sprawdź ręcznie wymagania i dopracuj opis potwierdzonych osiągnięć. Wynik Kierivo nie gwarantuje zaproszenia ani zatrudnienia.'
      : 'Uzupełnij luki wyłącznie potwierdzonymi kwalifikacjami albo rozważ stanowiska o wymaganiach zgodnych z Twoim doświadczeniem.';

  if (assessment === 'SIGNIFICANT_GAPS') {
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

  const summaryJustification = medianScore === null
    ? 'Nie obliczono mediany kontrolnych wskaznikow: zaden modul nie ma danych do oceny.'
    : `Mediana kontrolnych wskaznikow wynosi ${medianScore}% dla ${allScores.length} modulow. Moduly sprawdzaja rozne cechy i nie tworza wyniku dopasowania ani przewidywania decyzji ATS lub rekrutera.`;

  const globalBestPractices = [
    {
      title: '1. Opisz działanie i potwierdzony efekt',
      badExample: '• Obsługa [narzędzie].',
      goodExample: '• Użyłem [narzędzie] do [działanie]; efekt: [potwierdzony wynik, jeśli go znasz].',
      explanation: 'Nazwanie działania i jego kontekstu ułatwia odbiorcy zrozumienie zakresu pracy. Uzupełnij tylko własne, potwierdzone fakty; pomiń metrykę, jeśli jej nie znasz.',
    },
    {
      title: '2. Nazwij faktyczną rolę lub kierunek',
      badExample: 'Nagłówek w CV: „Pasjonat nowych technologii”.',
      goodExample: 'Nagłówek w CV: „[Twoje stanowisko lub kierunek zgodny z doświadczeniem]”.',
      explanation: 'Konkretny, zgodny z doświadczeniem nagłówek pomaga szybko zrozumieć profil. Nie przypisuj sobie nazwy stanowiska ani specjalizacji wyłącznie dlatego, że pojawia się w ofercie.',
    },
    {
      title: '3. Użyj zrozumiałych nazw sekcji',
      badExample: '„Moja Droga Życiowa”, „Czym Się Pasjonuję”, „Gdzie Działałem”',
      goodExample: '„Doświadczenie”, „Umiejętności”, „Wykształcenie”, „Uprawnienia i certyfikaty”',
      explanation: 'Powszechnie rozumiane nagłówki mogą ułatwić szybkie odnalezienie informacji przez czytelnika. Sposób odczytu zależy od konkretnego systemu, więc sprawdź też tekst wyodrębniony z własnego PDF.',
    },
    {
      title: '4. Zadbaj o czytelny układ i sprawdź eksport',
      badExample: 'Pasek biegłości zamiast tekstowego opisu umiejętności.',
      goodExample: 'Prosty układ sekcji z tekstowymi nazwami umiejętności, których rzeczywiście używasz.',
      explanation: 'Odczyt elementów graficznych i układu zależy od pliku oraz systemu. Sprawdź kolejność tekstu po eksporcie do PDF; żaden układ nie gwarantuje identycznego odczytu w każdym ATS.',
    },
    {
      title: '5. Podawaj daty zgodnie z dokumentacją',
      badExample: 'Nieprecyzyjny zakres dat, którego nie da się potwierdzić.',
      goodExample: '„[MM.RRRR] – [MM.RRRR]” — wpisz rzeczywiste miesiące, jeśli je znasz.',
      explanation: 'Miesiące pomagają dokładniej przedstawić chronologię. Nie zgaduj brakujących dat ani nie wyliczaj stażu na podstawie niepewnych danych.',
    },
    {
      title: '6. Sprawdź wymagania dotyczące zgody',
      badExample: 'Wklejenie klauzuli zgody, której kandydat nie udzielił.',
      goodExample: 'Dodaj wyłącznie tekst wymagany w danym procesie, jeśli faktycznie udzielasz tej zgody.',
      explanation: 'Wymagania mogą zależeć od pracodawcy i procesu rekrutacji. Ta wskazówka nie rozstrzyga kwestii prawnych, a generator nie powinien dopisywać zgody w imieniu kandydata.',
    },
  ];

  return {
    medianScore,
    assessedEngineCount: allScores.length,
    meanScore,
    minScore,
    maxScore,
    consensusGrade,
    summaryJustification,
    careerFitAdvice: {
      assessment,
      isRealisticFit,
      verdict: careerVerdict,
      actionablePlan: careerPlan,
      suggestedAlternativeRoles,
    },
    engines,
    globalBestPractices,
  };
}



