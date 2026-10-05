import { MasterVault } from '../types';
import { HR_AND_COMMON_STOP_WORDS, extractDynamicJdPhrases } from './atsSimulator';
import { auditKnockouts, KNOCKOUT_RULES, type KnockoutSeverity } from './knockouts';
import { detectBenefits } from './commuteCalculator';
import {
  dedupeSkillDefinitions, extractGenericRequirementCandidates, extractNiceLanguageSkills,
  findPositiveSkillDefinitions, findPreferredSkillDefinitions, findRequiredSkillDefinitions,
} from './jdSkillTaxonomy';
import { hasExplicitRequiredMarker, hasPositiveRequirementMention, hasPreferredRequirementMention, hasRequiredRequirementMention, isKnownSectionHeader, isNegatedRequirementAt, isOptionalSectionHeader, isPreferredRequirementAt, isRequiredSectionHeader, requirementSectionContextAt } from './jdOptionality';
import { cleanPastedJobOffer } from './jobOfferCleaner';
import { extractExplicitJobLocation } from './jobOfferMetadata';
import { formatExperienceRequirementLabel, type ExperienceComparison } from './experienceRequirement';
export { formatExperienceRequirementLabel } from './experienceRequirement';

export interface StructuredSalary {
  min: number;
  max: number;
  currency: string;
  period: string;
  grossNet: string;
}

export interface FormalRequirement {
  id: string;
  label: string;
  required: boolean;
  severity: KnockoutSeverity | 'information';
  sourceText: string;
}

export type ParsedWorkModel = 'REMOTE' | 'HYBRID' | 'ON_SITE' | 'FLEXIBLE' | 'UNKNOWN';

export interface StructuredLanguage {
  language: string;
  level?: string;
  required: boolean;
  sourceText: string;
}

export interface RequiredExperienceRequirement {
  years: number;
  sourceText: string;
  scopeText: string | null;
  comparison?: ExperienceComparison;
}

export interface ParsedJobDescription {
  jobTitle: string;
  companyName: string;
  seniorityLevel: 'ENTRY' | 'MID' | 'SENIOR' | 'LEAD' | 'EXECUTIVE' | 'UNKNOWN';
  requiredHardSkills: string[];
  requiredSoftSkills: string[];
  toolsAndTech: string[];
  languagesRequired: string[];
  coreResponsibilities: string[];
  keyKeywords: string[];
  // Extended fields for Benefits, Perks & Dealbreakers
  benefits?: string[];
  perksAndPlusy?: string[];
  mandatoryRequirements?: string[];
  salaryRange?: string;
  workModel?: ParsedWorkModel;
  recruitmentMode?: 'ATS_CORPORATE' | 'CRAFT_LOCAL' | 'HYBRID';
  recruitmentModeReason?: string;
  sourceUrl?: string;
  niceToHaveHardSkills?: string[];
  niceToHaveSoftSkills?: string[];
  formalRequirements?: FormalRequirement[];
  experienceMinYears?: number | null;
  experienceRequirements?: RequiredExperienceRequirement[];
  structuredLanguages?: StructuredLanguage[];
  location?: string;
  contractTypes?: string[];
  salary?: StructuredSalary | null;
  sourceSections?: Record<string, string[]>;
}

/** Mapuje regułę knock-outu na kategorię używaną przez interfejs. */
function knockoutTypeFor(ruleId: string): DealbreakerWarning['type'] {
  if (ruleId.startsWith('license_')) return 'LICENSE';
  if (ruleId === 'language_advanced') return 'LANGUAGE';
  if (ruleId === 'shift_work' || ruleId === 'own_transport') return 'LOCATION';
  return 'CERTIFICATE';
}

export interface DealbreakerWarning {
  id: string;
  requirement: string;
  type: 'LICENSE' | 'LANGUAGE' | 'EXPERIENCE' | 'CERTIFICATE' | 'SKILL' | 'LOCATION';
  message: string;
  missingInVault: boolean;
  canQuickAdd: boolean;
  quickAddValue: string;
}

export interface JDVaultMatchAnalysis {
  parsedJD: ParsedJobDescription;
  overallMatchPercentage: number;
  matchedSkills: string[];
  missingSkills: string[];
  recommendations: string[];
  dealbreakerWarnings: DealbreakerWarning[];
  benefitsList: string[];
  vaultSuggestions: {
    suggestedTitle: string;
    addSkillsToVault: string[];
    highlightAdvice: string[];
  };
}

/**
 * Local client-side smart parser fallback for Job Descriptions
 */
function parseJobDescriptionLocalLegacy(rawJdText: string, defaultTitle = ''): ParsedJobDescription {
  const text = rawJdText.trim();
  const lower = text.toLowerCase();

  // Extract potential job title from top lines
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let jobTitle = defaultTitle;
  if (lines.length > 0) {
    const firstLine = lines[0].replace(/^(poszukujemy|rekrutacja na|stanowisko:?|oferta:?)\s*/i, '');
    if (firstLine.length > 3 && firstLine.length < 80) {
      jobTitle = firstLine;
    }
  }

  // Seniority detection
  let seniorityLevel: ParsedJobDescription['seniorityLevel'] = 'MID';
  if (/senior|główny|lead|principal|architekt|head/i.test(lower)) seniorityLevel = 'SENIOR';
  if (/junior|praktykant|stażysta|entry/i.test(lower)) seniorityLevel = 'ENTRY';
  if (/tech lead|team lead|lead engineer|kierownik/i.test(lower)) seniorityLevel = 'LEAD';

  // Common Tech & Skill Dictionaries
  const knownTech = [
    'TypeScript', 'JavaScript', 'React', 'React.js', 'Node.js', 'Express', 'Python', 'Java', 'C#', '.NET',
    'PostgreSQL', 'SQL', 'MySQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
    'GraphQL', 'REST API', 'CI/CD', 'Git', 'Tailwind', 'Next.js', 'NestJS', 'Microservices', 'Jest', 'Cypress',
    'Linux', 'Agile', 'Scrum', 'Jira', 'Terraform', 'Kafka', 'Elasticsearch'
  ];

  const knownSoft = [
    'Praca zespołowa', 'Komunikatywność', 'Analityczne myślenie', 'Rozwiązywanie problemów',
    'Zarządzanie czasem', 'Przywództwo', 'Elastyczność', 'Inicjatywa', 'Code Review', 'Mentoring'
  ];

  const foundHard: string[] = [];
  const foundTools: string[] = [];
  const foundSoft: string[] = [];

  knownTech.forEach((tech) => {
    const regex = new RegExp(`\\b${tech.replace('.', '\\.')}\\b`, 'i');
    if (regex.test(text)) {
      if (['Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Git', 'Jira', 'Terraform', 'Kafka', 'Redis', 'Linux'].includes(tech)) {
        foundTools.push(tech);
      } else {
        foundHard.push(tech);
      }
    }
  });

  knownSoft.forEach((soft) => {
    if (new RegExp(soft, 'i').test(text)) {
      foundSoft.push(soft);
    }
  });

  // Languages detection
  const languages: string[] = [];
  if (/angielsk|english|c1|b2|c2/i.test(lower)) languages.push('Angielski (B2/C1)');
  if (/polsk|polish/i.test(lower)) languages.push('Polski (Ojczysty)');
  if (/niemieck|german/i.test(lower)) languages.push('Niemiecki');

  // Parser i kalkulator muszą stosować ten sam matcher dowodów: samo słowo
  // „MultiSport” w zdaniu „nie zapewniamy MultiSport” nie jest benefitem.
  const benefits = detectBenefits([text])
    .filter((benefit) => benefit.status === 'PROVIDED')
    .map((benefit) => benefit.label);

  // Mandatory requirements / Dealbreakers detection
  const mandatory: string[] = [];
  if (/prawo jazdy|driver'?s license|kat\.?\s*b/i.test(lower)) mandatory.push('Prawo Jazdy Kat. B (Wymóg Konieczny)');
  if (/(?:c1|c2)\s*(?:poziom|level|cefr|angielsk|english)|(?:angielsk|english|j[ęe]zyk)\s*[:\-–—]?\s*(?:c1|c2)|fluent english|bieg[łl]y angielski/i.test(lower)) {
    mandatory.push('Język Angielski poziom min. C1');
  }
  if (/studia wyższe|wykształcenie wyższe|bachelor|master degree/i.test(lower)) mandatory.push('Wykształcenie Wyższe (Inżynier / Magister)');
  if (/(?:min(?:imum)?\.?\s*)?(?:3|5)\+?\s*lat\s*(?:do[śs]wiadczeni|sta[żz]u)|years\s+of\s+experience/i.test(lower)) {
    mandatory.push('Min. 3-5 lat udokumentowanego doświadczenia');
  }
  if (/stacjonarnie|z biura|office only/i.test(lower)) mandatory.push('Praca Stacjonarna z Biura');

  // Work model — domyślnie praca stacjonarna (ON_SITE), hybryda tylko przy jawnej wzmiance
  const workModel = inferWorkModel(text);

  // Salary range
  let salaryRange = '';
  const salaryMatch = text.match(/(\d[\d\s.,]*\s*(?:–|-|do)\s*\d[\d\s.,]*\s*(?:PLN|EUR|USD|zl|zł))/i);
  if (salaryMatch) {
    salaryRange = salaryMatch[0];
  }

  // 4-Stage Advanced NLP extraction
  const dynamicNlp = extractDynamicJdPhrases(text);

  dynamicNlp.hardSkills.forEach((hs) => {
    const term = hs.phrase;
    if (['docker', 'kubernetes', 'aws', 'gcp', 'azure', 'git', 'jira', 'terraform', 'kafka', 'redis', 'linux'].includes(term)) {
      if (!foundTools.includes(term)) foundTools.push(term);
    } else {
      if (!foundHard.includes(term)) foundHard.push(term);
    }
  });

  dynamicNlp.softSkills.forEach((ss) => {
    if (!foundSoft.includes(ss.phrase)) foundSoft.push(ss.phrase);
  });

  // Extract keywords (filtering out HR stop words)
  const rawWords = (text.match(/\b[a-zA-Z0-9#+.-]{3,}\b/g) || [])
    .map((w) => w.toLowerCase())
    .filter((w) => !HR_AND_COMMON_STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const keywords = Array.from(new Set([
    ...dynamicNlp.hardSkills.map((h) => h.phrase),
    ...dynamicNlp.formalReqs.map((f) => f.phrase),
    ...foundTools,
    ...foundSoft,
    ...rawWords,
  ])).filter((k) => !HR_AND_COMMON_STOP_WORDS.has(k));

  // Every field below reflects what was actually found in the posting. Filling a
  // blank with plausible defaults would make the ATS score measure the user's CV
  // against requirements the employer never stated — a wrong answer presented
  // with the same confidence as a right one.
  return {
    jobTitle,
    companyName: '',
    seniorityLevel,
    requiredHardSkills: foundHard,
    requiredSoftSkills: foundSoft,
    toolsAndTech: foundTools,
    languagesRequired: languages,
    coreResponsibilities: lines.slice(1, 6),
    keyKeywords: keywords.slice(0, 15),
    benefits,
    perksAndPlusy: [],
    mandatoryRequirements: mandatory,
    salaryRange: salaryRange || undefined,
    workModel,
  };
}

/**
 * Granica KAŻDEJ znanej sekcji nagłówkowej ogłoszenia (PL i EN) — używana do
 * odcięcia sekcji od dołu. Ślepy holdout pokazał, że wersja wyłącznie polska
 * dawała 35 z 77 FN (kategoria SECTION_EXTRACTION): angielskie "Requirements"/
 * "Responsibilities"/"Nice to have" nie były w ogóle rozpoznawane, więc dla
 * sześciu ofert `requiredLines`/`niceLines` wychodziły puste niezależnie od
 * tego, co zawierał słownik umiejętności.
 */
const SECTION_HEADER_NAMES = "(mile widziane|nice[- ]to[- ]have|preferred qualifications?|preferred|dodatkowo|nasze wymagania|twoje wymagania|wymagania|wymagane|(?:required|minimum|basic) qualifications?|qualifications?|must[- ]haves?|requirements?|what we (?:expect|require|need)|what you(?:'|’)ll bring|what you will bring|your profile|who you are|czego oczekujemy(?:\\s+od\\s+naszych\\s+pracowników|\\s+od\\s+kandydatów|\\s+od\\s+ciebie)?|nasze oczekiwania|oczekiwania|czego szukamy|to oferujemy|co oferujemy(?:\\s+naszym\\s+pracownikom|\\s+kandydatom)?|we offer|benefity|benefits|perks|twój zakres|zakres obowiązków|obowiązki|czym będziesz się zajmować|responsibilities|what you.?ll do|o projekcie|about the project|o firmie|about us|about the company|technologie|tech stack|technologies)";
const SECTION_HEADER_PATTERN = new RegExp(`^${SECTION_HEADER_NAMES}\\s*[:.]?\\s*$`, 'i');
const INLINE_SECTION_HEADER_PATTERN = new RegExp(`^${SECTION_HEADER_NAMES}\\s*:\\s*(.+)$`, 'i');

/** Dzieli „Wymagania: ...” tak samo jak nagłówek i treść w osobnych liniach. */
function normalizeInlineSectionHeaders(lines: string[]): string[] {
  return lines.flatMap((line) => {
    const match = line.match(INLINE_SECTION_HEADER_PATTERN);
    if (match) return [match[1], match[2].trim()];

    // Portale czesto doklejaja naglowek do zdania wprowadzajacego:
    // "Szukamy elektryka. Wymagania: ...". Bez granicy zdania parser
    // traktowal cala linie jak tekst ogolny i kanon pomijal jawne wymagania.
    const embeddedHeader = line.match(
      new RegExp(`(?<prefix>^.*?[.!?;]\\s+)(?<header>${SECTION_HEADER_NAMES})\\s*:\\s*(?<content>.+)$`, 'i')
    );
    if (embeddedHeader?.groups) {
      return [
        embeddedHeader.groups.prefix.trim(),
        embeddedHeader.groups.header.trim(),
        embeddedHeader.groups.content.trim(),
      ].filter(Boolean);
    }

    const colon = line.indexOf(':');
    const header = colon >= 0 ? line.slice(0, colon).trim() : '';
    return colon >= 0 && isKnownSectionHeader(header)
      ? [header, line.slice(colon + 1).trim()]
      : [line];
  });
}

function parseSectionLines(lines: string[], headers: RegExp[], isHeader?: (line: string) => boolean): string[] {
  let insideSection = false;
  const result: string[] = [];

  lines.forEach((line) => {
    if (headers.some((pattern) => pattern.test(line)) || isHeader?.(line)) {
      insideSection = true;
      return;
    }
    if (SECTION_HEADER_PATTERN.test(line) || isKnownSectionHeader(line)) {
      insideSection = false;
      return;
    }
    if (insideSection) result.push(line);
  });

  // Oferty często powtarzają wymagania pod nagłówkami „technologie” lub
  // „kwalifikacje”; zbieraj wszystkie rozpoznane bloki, bez zaciągania sekcji
  // obowiązków, benefitów i opisu firmy pomiędzy nimi.
  return result;
}

const GENERAL_EXPERIENCE_DESCRIPTOR = /^(?:professional|work|zawodow[\p{L}]*)$/iu;
const EXPERIENCE_COMPARISON_MARKERS: { comparison: ExperienceComparison; source: string }[] = [
  { comparison: 'at_least', source: String.raw`(?:minimum(?:[ \t]+of)?|min\.?|co[ \t]+najmniej|at[ \t]+least|no[ \t]+less[ \t]+than|nie[ \t]+mniej[ \t]+ni[żz]|or[ \t]+more|>=|≥)` },
  { comparison: 'at_most', source: String.raw`(?:maksymaln[\p{L}]*|maks\.?|max(?:imum)?\.?|at[ \t]+most|up[ \t]+to|no[ \t]+more[ \t]+than|nie[ \t]+wi[ęe]cej[ \t]+ni[żz]|or[ \t]+(?:less|fewer)|do|<=|≤)` },
  { comparison: 'more_than', source: String.raw`(?:more[ \t]+than|over|ponad|powy[żz]ej|wi[ęe]cej[ \t]+ni[żz]|>)` },
  { comparison: 'less_than', source: String.raw`(?:less[ \t]+than|fewer[ \t]+than|mniej[ \t]+ni[żz]|poni[żz]ej|<)` },
];

function experienceScopeDescriptor(text: string): string {
  const hasRequiredMarker = hasExplicitRequiredMarker(text);
  return text.trim().split(/\s+/u).filter((word) =>
    !GENERAL_EXPERIENCE_DESCRIPTOR.test(word) && !hasExplicitRequiredMarker(word) &&
    !(hasRequiredMarker && /^(?:is|are|jest|są)$/iu.test(word))
  ).join(' ');
}

/** Wyciąga próg stażu tylko z tej samej sekcji wymagań, którą widzi parser oferty. */
function extractRequiredExperienceRequirements(rawJdText: string): RequiredExperienceRequirement[] {
  const lines = normalizeInlineSectionHeaders(
    (rawJdText ?? '').trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  );
  // Nagłówki zostają w źródle: późniejsze „Required” musi zamknąć wcześniejsze
  // „not required”. Po wycięciu nagłówków znacznik opcjonalności wyciekał dalej.
  const source = lines.join('\n');
  // Granica obejmuje separator liczby i zakresu: po błędnym zapisie nie wolno
  // próbować ponownie od cyfry po przecinku ani od górnego końca przedziału.
  const yearQuantity = String.raw`(?<years>\d{1,2}(?:[.,]\d{1,2})?)(?:[ \t]*(?:[-–—]|do|to)[ \t]*(?<upper>\d{1,2}(?:[.,]\d{1,2})?))?[ \t]*\+?[ \t]*(?:lat|lata|rok|roku|years?)(?!\p{L})`;
  const experienceTerm = String.raw`(?:experience|do[śs]wiadczeni[\p{L}]*|sta[żz]u?|pracy(?:[ \t]+zawodowej)?)(?!\p{L})`;
  const descriptorWord = String.raw`\.?[\p{L}][\p{L}\p{N}+#/]*(?:[.-][\p{L}\p{N}+#/]+)*`;
  const comparisonMarker = `(?:${EXPERIENCE_COMPARISON_MARKERS.map(({ source }) => source).join('|')})`;
  const descriptors = String.raw`(?<prefix>(?:(?!${experienceTerm})${descriptorWord}[ \t]+){0,6})`;
  const experiencePattern = new RegExp(String.raw`(?<![\p{L}\p{N}.,+\-–—])(?:(?<comparison>${comparisonMarker})[ \t]*)?${yearQuantity}[ \t]*(?:(?:of|['’])[ \t]*)?${descriptors}${experienceTerm}`, 'giu');
  const reversedPattern = new RegExp(String.raw`(?<![\p{L}\p{N}])${descriptors}${experienceTerm}[ \t]*(?<middle>(?:(?!${comparisonMarker}(?!\p{L}))${descriptorWord}(?:[ \t]+|(?=:))){0,6})[ \t]*:?[ \t]*(?:(?<comparison>${comparisonMarker})[ \t]*)?${yearQuantity}`, 'giu');
  const forwardMatches = [...source.matchAll(experiencePattern)].map((match) => ({
    index: match.index ?? 0, end: (match.index ?? 0) + match[0].length,
    lower: match.groups!.years, upper: match.groups?.upper, prefix: match.groups!.prefix, marker: match.groups?.comparison, middle: '', reversed: false,
  }));
  // Ta sama nazwa doświadczenia nie może tworzyć drugiego wymogu tylko
  // dlatego, że podlega też wzorcowi odwróconemu.
  const reversedMatches = [...source.matchAll(reversedPattern)].map((match) => ({
    index: match.index ?? 0, end: (match.index ?? 0) + match[0].length,
    lower: match.groups!.years, upper: match.groups?.upper, prefix: match.groups!.prefix, marker: match.groups?.comparison, middle: match.groups!.middle, reversed: true,
  })).filter((match) => !forwardMatches.some((forward) => match.index < forward.end && forward.index < match.end));
  const requirements: RequiredExperienceRequirement[] = [];
  for (const match of [...forwardMatches, ...reversedMatches].sort((a, b) => a.index - b.index)) {
    const index = match.index;
    // „minimum 18 years old” albo okres gwarancji nie jest stażem. Pomijamy
    // też nieobowiązkowe trafienia zamiast kończyć na pierwszej liczbie lat.
    if (requirementSectionContextAt(source, index) !== 'required' ||
        isNegatedRequirementAt(source, index) || isPreferredRequirementAt(source, index)) continue;
    const years = Number(match.lower.replace(',', '.'));
    const upperYears = match.upper ? Number(match.upper.replace(',', '.')) : null;
    if (upperYears !== null && upperYears < years) continue;
    // Zakres z tego samego zdania zachowujemy jako dowód. Kropka w .NET nie
    // kończy klauzuli, a osobna linia umiejętności nie zmienia stażu ogólnego.
    const tail = source.slice(match.end).split(/\n|[;,!?]|\.(?=\s|$)/u)[0].trim();
    const postfix = EXPERIENCE_COMPARISON_MARKERS.map(({ comparison, source: pattern }) => ({
      comparison, match: new RegExp(`^(?:${pattern})(?![\\p{L}\\p{N}])`, 'iu').exec(tail),
    })).find((candidate) => candidate.match !== null);
    const comparison = EXPERIENCE_COMPARISON_MARKERS.find(({ source: pattern }) =>
      new RegExp(`^(?:${pattern})$`, 'iu').test(match.marker ?? '')
    )?.comparison ?? postfix?.comparison ?? 'at_least';
    const scopeTail = postfix ? tail.slice(postfix.match![0].length).trim() : tail;
    // Liczba w opisie gwarancji lub wieku sprzętu nie datuje doświadczenia
    // z tym sprzętem, nawet jeśli oba fakty znalazły się w jednej klauzuli.
    if (match.reversed && /^(?:warranty|guarantee|old|gwarancj[\p{L}]*|wieku)(?!\p{L})/iu.test(tail)) continue;
    const scopeMiddle = experienceScopeDescriptor(match.middle);
    let suffix = [scopeMiddle, scopeTail].filter(Boolean).join(' ');
    const suffixWords = suffix.split(/\s+/u);
    while (suffixWords.length > 0 && GENERAL_EXPERIENCE_DESCRIPTOR.test(suffixWords[0])) suffixWords.shift();
    suffix = suffixWords.join(' ');
    const scopeStart = /(?<!\p{L})(?:w|z|przy|na|jako|in|with|as|using|of|komercyjn[\p{L}]*|praktyczn[\p{L}]*|samodzieln[\p{L}]*)(?!\p{L})/iu.exec(suffix);
    const scopedSuffix = scopeStart !== null && (scopeStart.index === 0 || hasExplicitRequiredMarker(suffix.slice(0, scopeStart.index)));
    if (scopedSuffix && scopeStart) suffix = suffix.slice(scopeStart.index);
    const scopePrefix = experienceScopeDescriptor(match.prefix);
    const qualifiedPrefix = /^(?:relevant|related|commercial|samodzielnego|praktycznego|komercyjnego)$/iu.test(scopePrefix);
    const sourceText = `${source.slice(index, match.end)}${tail ? ` ${tail}` : ''}`;
    // „Magazynowe” określa zakres również bez przyimka. Zgubienie tego
    // przymiotnika pozwalałoby zaliczyć wymóg dowolnym zatrudnieniem.
    requirements.push({ years, sourceText, scopeText: scopedSuffix ? suffix : scopeMiddle || (scopePrefix ? qualifiedPrefix ? sourceText : scopePrefix : null), ...(comparison === 'at_least' ? {} : { comparison }) });
  }
  return requirements;
}

/** Brak jawnej informacji o poziomie stanowiska pozostaje nierozstrzygnięty. */
function inferSeniorityLevel(title: string, lines: string[]): ParsedJobDescription['seniorityLevel'] {
  const firstSection = lines.findIndex(isKnownSectionHeader);
  const headerLines = firstSection < 0 ? lines.slice(0, 8) : lines.slice(0, firstSection);
  const explicitLevelLines = headerLines.filter((line) =>
    /^(?:(?:seniority|poziom)\s*:\s*)?(?:entry(?:[- ]level)?|junior|intern(?:ship)?|praktykant|stażysta|mid(?:[- ]level)?|middle[- ]level|regular|senior|lead|executive)(?:\s*(?:\/|,)\s*(?:entry(?:[- ]level)?|junior|intern(?:ship)?|praktykant|stażysta|mid(?:[- ]level)?|middle[- ]level|regular|senior|lead|executive))*$/i.test(line.trim())
  );
  const evidence = `${title}\n${explicitLevelLines.join('\n')}`;

  if (/\b(?:executive|chief|vice president|vp|dyrektor)\b/i.test(evidence)) return 'EXECUTIVE';
  if (/\b(?:tech lead|team lead|lead engineer|lead|kierownik)\b/i.test(evidence)) return 'LEAD';
  if (/\b(?:senior|główny|principal|architekt|head of)\b/i.test(evidence)) return 'SENIOR';
  if (/\b(?:junior|intern|internship|praktykant|stażysta|entry)\b/i.test(evidence)) return 'ENTRY';
  if (/\b(?:mid(?:[- ]level)?|middle[- ]level|regular)\b/i.test(evidence)) return 'MID';
  return 'UNKNOWN';
}

/**
 * Parser lokalny ogranicza ekstrakcję umiejętności do sekcji wymagań. Stary
 * ekstraktor pozostaje jako fallback dla nietypowych ręcznych ogłoszeń, ale nie
 * może zasilać ATS rzeczownikami z benefitu ani stopki portalu.
 */
/** Brak jawnej informacji o trybie pracy pozostaje nierozstrzygnięty. */
function inferWorkModel(text: string): ParsedWorkModel {
  const hasPositiveMention = (pattern: RegExp): boolean => {
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const before = text.slice(Math.max(0, start - 40), start);
      const after = text.slice(end, Math.min(text.length, end + 45));
      if (/(?:\bnie|\bnot|\bno)\s+(?:(?:jest|is|available|offered|oferowana|dostępna)\s+)?$/i.test(before)) continue;
      if (/^\s*(?:(?:is|jest)\s+)?(?:not|nie)\s+(?:(?:is|jest)\s+)?(?:available|offered|provided|dostępna|oferowana|możliwa|obowiązuje)/i.test(after)) continue;
      return true;
    }
    return false;
  };

  const hybrid = hasPositiveMention(/(?:prac\S*|tryb pracy)\s+hybryd\w*|\bhybrid\s+(?:work|position|role|model)\b/gi);
  const remoteInBody = hasPositiveMention(/prac\S*\s+zdaln\w*|\bfully\s+remote\b|\b100\s*%\s*remote\b|\bremote(?:[- ]only|[- ]first)?\s+(?:work|position|role|job)\b|\b(?:work|working)\s+remotely\b/gi);
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  // Portale często eksportują tryb jako osobny, pojedynczy wiersz; lokalizacja „Remote, Poland” nie jest takim potwierdzeniem.
  const standaloneRemote = lines.some((line) => /^(?:[-*•]\s*)?(?:remote|fully\s+remote|100\s*%\s*remote)$/i.test(line));
  const standaloneOnsite = lines.some((line) => /^(?:[-*•]\s*)?(?:stacjonarnie|stacjonarna|praca\s+stacjonarna|on[- ]site)$/i.test(line));
  const firstLine = lines.find(Boolean) ?? '';
  const remoteInTitle = /^remote\s+(?!desktop\b|access\b|server\b|support\b|monitoring\b|network\b)[\w+#.-]+(?:[\s/-]+[\w+#.-]+){0,4}$/i.test(firstLine);
  const remote = remoteInBody || remoteInTitle || standaloneRemote;
  const onsite = hasPositiveMention(/prac\S*\s+stacjonarn\w*|tryb(?: pracy)?\s*[:=]?\s*stacjonarn\w*|\bon[- ]site\s+(?:work|position|role|only|based)\b|\bwork(?:ing)?\s+in[- ]office\b/gi) || standaloneOnsite;
  const flexible = hasPositiveMention(/elastyczny\s+model\s+pracy|\bflexible\s+work\s+model\b/gi);
  const explicitModels = [hybrid && 'HYBRID', remote && 'REMOTE', onsite && 'ON_SITE', flexible && 'FLEXIBLE'].filter(Boolean);
  return explicitModels.length === 1 ? explicitModels[0] as ParsedWorkModel : 'UNKNOWN';
}

function normalizedTitleCandidate(candidate: string | undefined): string {
  if (!candidate) return '';
  const title = candidate.trim()
    .replace(/^(?:poszukujemy|rekrutacja na|stanowisko|oferta)\s*:?\s*/i, '')
    .replace(/^(?:praca|raca)\s+dla\s+/i, '')
    .split(/\s+(?=(?:dobre|doskonałe|atrakcyjne|świetne|najlepsze)\s+warunki\b|dniówka\s+od\b|wynagrodzenie\s+od\b|stawka\s+od\b|wysokie\s+zarobki\b)/i)[0]
    .trim();
  if (title.length < 3 || title.length > 80 || /[!?;]$/.test(title)) return '';
  if (/^(?:firma|wymagania|wymagania obowiązkowe|obowiązki|zakres obowiązków|oferujemy|about us|requirements|responsibilities|location|lokalizacja|wynagrodzenie|salary|contract|typ umowy|stanowisko|nie określono|nieznane stanowisko)\b/i.test(title)) {
    return '';
  }
  // Po czyszczeniu portalu pierwszą linią bywa lokalizacja, widełki, ważność
  // ogłoszenia albo nazwa pracodawcy. To metadane, nie tytuły stanowiska.
  if (/^(?:warszawa|katowice|kraków|wrocław|gdańsk|poznań|łódź|szczecin|gliwice|białystok|polska|śląskie|mazowieckie|małopolskie|dolnośląskie|pomorskie|wielkopolskie)(?:\s*[,/].*)?$/i.test(title)) return '';
  if (/^(?:\d[\d\s.,]*\s*(?:[-\u2013]|do)\s*\d[\d\s.,]*\s*(?:\p{Sc}|z\u0142|pln|eur|usd)|(?:od\s*)?\d[\d\s.,]*\s*(?:\p{Sc}|z\u0142|pln|eur|usd)(?=\s|$|\/)|netto\b|brutto\b|ważna\b|ważne\b|do\s+\d{1,2}\s+(?:sty|lut|mar|kwi|maj|cze|lip|sie|wrz|paź|lis|gru)|\(?do\s+\d{1,2}\s*\w*\)?|(?:umowa\s+o\s+pracę|umowa\s+zlecenie|b2b|praca\s+(?:zdalna|hybrydowa|stacjonarna)))(?=$|\s)/iu.test(title)) return '';
  if (/^(?:remote|hybrid|on[- ]site)(?:\s+(?:work|position|role|job|only))?$/i.test(title)) return '';
  if (/\bo firmie\b|\bsp\.\s*z\s*o\.\s*o\.?\b|\bS\.A\.\b/i.test(title)) return '';
  if (/^(?:dziękujemy|thank you|we are|jesteśmy|klikając|aplikując|informujemy|prosimy|poznaj nas)/i.test(title)) return '';
  if (title.split(/\s+/).length > 10) return '';
  return title;
}

export function parseJobDescriptionLocal(rawJdText: string, defaultTitle = ''): ParsedJobDescription {
  const cleaned = cleanPastedJobOffer(rawJdText);
  const effectiveRaw = cleaned.hasNoiseRemoved ? cleaned.cleanText : rawJdText;
  const legacy = parseJobDescriptionLocalLegacy(effectiveRaw, cleaned.title || defaultTitle);
  const text = effectiveRaw.trim();
  const lines = normalizeInlineSectionHeaders(text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  const requiredLines = parseSectionLines(lines, [], isRequiredSectionHeader);
  const niceLines = parseSectionLines(lines, [], isOptionalSectionHeader);
  const requiredSectionText = requiredLines.join('\n');
  const niceSectionText = niceLines.join('\n');
  // Jedno źródło prawdy dla umiejętności/narzędzi — `src/lib/jdSkillTaxonomy.ts`.
  // Płaska lista `skillNames` obsługiwała tylko IT/.NET; ślepy holdout na 20
  // ofertach z innych branż pokazał 12 FN samych brakujących kompetencji
  // domenowych i 19 brakujących narzędzi/platform (reguła 8).
  const requiredDefs = dedupeSkillDefinitions(findRequiredSkillDefinitions(requiredSectionText));
  const niceDefsRaw = dedupeSkillDefinitions([
    ...findPositiveSkillDefinitions(niceSectionText),
    ...findPreferredSkillDefinitions(requiredSectionText),
  ])
    .filter((def) => !requiredDefs.some((r) => r.term === def.term));
  const requiredTaxonomyTerms = requiredDefs.map((def) => def.term);
  const tools = requiredDefs.filter((def) => def.kind === 'TOOL').map((def) => def.term);
  const softNames = ['Praca zespołowa', 'Komunikatywność', 'Analityczne myślenie', 'Rozwiązywanie problemów', 'Mentoring'];
  // Bezpieczna ścieżka generyczna: łapie nazwy własne/akronimy z sekcji
  // wymagań, których nie ma (jeszcze) w dedykowanym słowniku, odrzucając
  // rzeczowniki pospolite, liczby lat doświadczenia i szum portalowy —
  // patrz `looksLikeGenericSkillToken` w `jdSkillTaxonomy.ts`. Filtrujemy też
  // nazwy miękkich kompetencji (`softNames`), żeby nie duplikować ich jako
  // twardych umiejętności.
  const PORTAL_NOISE = /^(?:juwentus|aplikuj|zgłoś|otodom|olx|grupa pracuj|the network|tiktok|instagram|współadministrator|facebook|linkedin)$/i;
  const genericRequired = extractGenericRequirementCandidates(requiredSectionText)
    .filter((token) => hasRequiredRequirementMention(requiredSectionText, token))
    .filter((token) => !requiredTaxonomyTerms.some((skill) => skill.toLowerCase() === token.toLowerCase()))
    .filter((token) => !softNames.some((skill) => skill.toLowerCase() === token.toLowerCase()))
    .filter((token) => !PORTAL_NOISE.test(token));
  const genericNice = [
    ...extractGenericRequirementCandidates(niceSectionText)
      .filter((token) => hasPositiveRequirementMention(niceSectionText, token)),
    ...extractGenericRequirementCandidates(requiredSectionText)
      .filter((token) => hasPreferredRequirementMention(requiredSectionText, token)),
  ]
    .filter((token) => hasPositiveRequirementMention(niceSectionText, token) || hasPreferredRequirementMention(requiredSectionText, token))
    .filter((token) => !requiredTaxonomyTerms.some((skill) => skill.toLowerCase() === token.toLowerCase()))
    .filter((token) => !genericRequired.some((skill) => skill.toLowerCase() === token.toLowerCase()))
    .filter((token) => !softNames.some((skill) => skill.toLowerCase() === token.toLowerCase()))
    .filter((token) => !PORTAL_NOISE.test(token));
  // Nazwa języka bez poziomu w sekcji "Mile widziane" liczy się jako dodatkowa
  // umiejętność (np. „Angielski.”) — ale TYLKO tam. W sekcji wymagań język
  // pozostaje wyłącznie formalnym progiem (`structuredLanguages`), inaczej
  // niemal każda oferta zyskałaby fałszywy wpis „Angielski” jako skill.
  const niceLanguageSkills = extractNiceLanguageSkills(niceSectionText)
    .filter((language) => hasPositiveRequirementMention(niceSectionText, language))
    .filter((language) => !requiredTaxonomyTerms.some((skill) => skill.toLowerCase() === language.toLowerCase()));
  const nice = Array.from(new Set([
    ...niceDefsRaw.map((def) => def.term),
    ...genericNice,
    ...niceLanguageSkills,
  ]));
  const required = Array.from(new Set([...requiredTaxonomyTerms, ...genericRequired]));
  const hard = Array.from(new Set([
    ...requiredDefs.filter((def) => def.kind !== 'TOOL').map((def) => def.term),
    ...genericRequired,
  ]));
  const soft = softNames.filter((skill) => new RegExp(skill, 'i').test(requiredSectionText) && hasRequiredRequirementMention(requiredSectionText, skill));
  const niceSoft = softNames.filter((skill) => new RegExp(skill, 'i').test(niceSectionText) && hasPositiveRequirementMention(niceSectionText, skill));
  const structuredLanguages = lines.flatMap((line, index) => {
    const match = line.match(/\b(angielski|niemiecki|francuski|hiszpański|polski|english|german|french|spanish)\b(?:\s*\(([^)]*)\))?/i);
    const previousLine = lines[index - 1] || '';
    const requiredByHeader = /^wymagane języki\b/i.test(previousLine);
    const languageIndex = match ? line.indexOf(match[1]) : -1;
    const required = Boolean(
      match &&
      !isNegatedRequirementAt(line, languageIndex) &&
      (requiredLines.includes(line) || /wymagan|minimum|min\./i.test(line) || requiredByHeader)
    );
    return match ? [{ language: match[1], level: match[2], required, sourceText: line }] : [];
  });
  // Staż kandydata wolno wyprowadzić z wymagań, nie z opisu firmy (np. „25 lat na rynku”).
  const experienceRequirements = extractRequiredExperienceRequirements(text);
  const lowerBounds = experienceRequirements.filter(({ comparison = 'at_least' }) => comparison === 'at_least' || comparison === 'more_than');
  const experienceMinYears = lowerBounds.length === 0 ? null : Math.max(...lowerBounds.map(({ years }) => years));
  const salaryMatch = text.match(/(?:od\s*)?(\d[\d\s.]*(?:,\d+)?)\s*(?:–|-|do)\s*(\d[\d\s.]*(?:,\d+)?)\s*(zł|pln|eur|usd)([^.\n]*)/i);
  const parseNumber = (value: string) => Number(value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
  const salary = salaryMatch ? {
    min: parseNumber(salaryMatch[1]), max: parseNumber(salaryMatch[2]), currency: salaryMatch[3].toUpperCase().replace('ZŁ', 'PLN'),
    period: /godz|h\b/i.test(salaryMatch[4]) ? 'godzina' : /mies/i.test(salaryMatch[4]) ? 'miesiąc' : 'nieokreślony',
    grossNet: /netto/i.test(salaryMatch[4]) ? 'netto' : /brutto/i.test(salaryMatch[4]) ? 'brutto' : 'nieokreślony',
  } : null;
  const formalRequirements: FormalRequirement[] = [];
  for (const rule of KNOCKOUT_RULES) {
    const sourceText = requiredLines.find((line) => rule.detect.some((pattern) => {
      const globalPattern = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`);
      return [...line.matchAll(globalPattern)].some((match) => !isNegatedRequirementAt(line, match.index ?? 0));
    }));
    if (sourceText) formalRequirements.push({ id: rule.id, label: rule.label, required: true, severity: rule.severity, sourceText });
  }
  const degreeLine = lines.find((line) => /wykształcenie wyższe|studia wyższe|bachelor|master degree/i.test(line));
  if (degreeLine) {
    const degreeIndex = degreeLine.search(/wykształcenie wyższe|studia wyższe|bachelor|master degree/i);
    formalRequirements.push({ id: 'degree', label: degreeLine, required: requiredLines.includes(degreeLine) && !isNegatedRequirementAt(degreeLine, degreeIndex), severity: 'information', sourceText: degreeLine });
  }
  experienceRequirements.forEach(({ years, scopeText, sourceText, comparison }, index) => {
    formalRequirements.push({ id: index === 0 ? 'experience_years' : `experience_years_${index}`, label: formatExperienceRequirementLabel(years, scopeText, comparison), required: true, severity: 'information', sourceText });
  });
  structuredLanguages.filter((language) => language.required).forEach((language) => {
    formalRequirements.push({
      id: `language_${language.language.toLowerCase()}`,
      label: `${language.language}${language.level ? ` (${language.level})` : ''}`,
      required: true,
      severity: 'information',
      sourceText: language.sourceText,
    });
  });
  const companyName = cleaned.company || text.match(/^(.{2,100}?)\s*o firmie\s*$/im)?.[1]?.trim() || legacy.companyName;
  const titleFromText = lines.find((line) => /^(poszukujemy|rekrutacja na|stanowisko:|oferta:)/i.test(line))
    ?.replace(/^(poszukujemy|rekrutacja na|stanowisko:|oferta:)\s*/i, '').trim();
  const jobTitle = normalizedTitleCandidate(titleFromText) ||
    normalizedTitleCandidate(cleaned.title) ||
    normalizedTitleCandidate(defaultTitle) ||
    normalizedTitleCandidate(lines.find((line) => line.length > 3 && line.length < 90));
  const seniorityLevel = inferSeniorityLevel(jobTitle, lines);
  const mandatoryRequirements = formalRequirements.filter((requirement) => requirement.required).map((requirement) => requirement.label);
  const explicitLocation = extractExplicitJobLocation(text);
  const location = explicitLocation || cleaned.location || lines.find((line) => /warszawa|katowice|gliwice|kraków|wrocław|gdańsk|poznań|łódź|szczecin|białołęka|polska|oświęcim|zielona góra|luzino|bochnia|trzebnica|sandomierz|siedlce|korsze|piaseczno/i.test(line));
  const contractText = lines.join('\n');
  const contractTypeDefinitions: Array<[string, RegExp]> = [
    // JavaScriptowe \b nie traktuje polskich znaków jako liter, więc po „pracę”
    // granicę słowa wyznaczamy lookaheadem, a nie \b.
    ['umowa o pracę', /\bumowa\s+o\s+prac(?:ę|e)(?=\s|$|[,;.!/])|\buop\b/i],
    ['umowa zlecenie', /\bumowa\s+zlecen(?:ie|ia)\b/i],
    ['umowa o dzieło', /\bumowa\s+o\s+dzieł[oa]\b/i],
    ['kontrakt B2B', /\bkontrakt\s+b2b\b|\bb2b\b/i],
    ['pełny etat', /\bpełny\s+etat\b|\bfull[- ]time\b/i],
    ['część etatu', /\bczęść\s+etatu\b|\bpart[- ]time\b/i],
  ];
  const contractTypes = contractTypeDefinitions
    .filter(([, pattern]) => pattern.test(contractText))
    .map(([label]) => label);
  const workModel = inferWorkModel(text);
  const explicitSalaryLine = lines.find((line) => /^wynagrodzenie:\s*(.+)$/i.test(line));
  const explicitSalary = explicitSalaryLine ? explicitSalaryLine.replace(/^wynagrodzenie:\s*/i, '').trim() : '';
  const salaryRange = explicitSalary || cleaned.salary || salaryMatch?.[0];
  return {
    ...legacy,
    jobTitle,
    companyName,
    seniorityLevel,
    requiredHardSkills: hard,
    requiredSoftSkills: soft,
    // Pole legacyjne pozostaje agregatem rozpoznanych technologii; nowe pola
    // niceToHaveHardSkills przechowują właściwy podział dla nowych konsumentów.
    toolsAndTech: Array.from(new Set([...tools, ...nice])),
    languagesRequired: structuredLanguages.filter((language) => language.required).map((language) => `${language.language}${language.level ? ` (${language.level})` : ''}`),
    coreResponsibilities: parseSectionLines(lines, [/^(twój|twoje)?\s*zakres obowiązków/i, /^obowiązki/i]).slice(0, 10),
    keyKeywords: Array.from(new Set([...required, ...nice, ...soft, ...niceSoft, ...mandatoryRequirements])).filter((keyword) => !HR_AND_COMMON_STOP_WORDS.has(keyword.toLowerCase())).slice(0, 30),
    mandatoryRequirements,
    salaryRange,
    workModel,
    niceToHaveHardSkills: nice,
    niceToHaveSoftSkills: niceSoft,
    formalRequirements,
    experienceMinYears,
    experienceRequirements,
    structuredLanguages,
    location,
    contractTypes,
    salary,
    sourceSections: { required: requiredLines, niceToHave: niceLines },
  };
}

/**
 * Compare Parsed Job Description against user's Master Vault
 */
export function analyzeJdMatchWithVault(
  parsedJd: ParsedJobDescription,
  vault: MasterVault,
  /**
   * Surowa treść ogłoszenia, jeśli wywołujący ją ma.
   *
   * Wykrywanie wymagań formalnych działa na niej wyraźnie lepiej niż na
   * strukturze po parsowaniu: „praca w systemie zmianowym" albo „nie wymagamy
   * prawa jazdy" to zdania, które przepadają, gdy zostaną z nich same
   * wyekstrahowane umiejętności. Bez tego argumentu spadamy na zserializowaną
   * strukturę — gorzej, ale nadal działa.
   */
  rawJdText?: string
): JDVaultMatchAnalysis {
  const vaultTextFull = JSON.stringify(vault).toLowerCase();
  const jdSourceText = rawJdText?.trim() || JSON.stringify(parsedJd);
  const vaultSkillsLower = new Set([
    ...vault.skillsMatrix.hardSkills.map((s) => s.toLowerCase()),
    ...vault.skillsMatrix.toolsAndTech.map((s) => s.toLowerCase()),
    ...vault.skillsMatrix.softSkills.map((s) => s.toLowerCase()),
  ]);

  const allJdSkills = [
    ...parsedJd.requiredHardSkills,
    ...parsedJd.toolsAndTech,
    ...parsedJd.requiredSoftSkills,
  ];

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  allJdSkills.forEach((skill) => {
    if (vaultSkillsLower.has(skill.toLowerCase()) || vaultTextFull.includes(skill.toLowerCase())) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  });

  // Audyt kryteriów zerojedynkowych.
  //
  // Tu stały wcześniej dwa zaszyte warunki: prawo jazdy kat. B i angielski C1.
  // Dla montera, spawacza, magazyniera czy sprzątaczki oba są nietrafione —
  // ich aplikacje odpadają na SEP-ie, UDT, F-Gazie, orzeczeniu sanepidu albo
  // dyspozycyjności zmianowej, czyli na rzeczach, których tamten audyt nie
  // widział w ogóle. Reguły mieszkają teraz w `src/lib/knockouts.ts`.
  //
  // Druga, cichsza naprawa: tamta wersja szukała uprawnień przez
  // `JSON.stringify(vault)`, więc zaznaczenie „UDT wózki" w profilu nie miało
  // szans dopasować się do wymagania „uprawnienia na wózki widłowe".
  // Silnik porównuje teraz identyfikatory z `profiler.licenses` wprost.
  const knockoutReport = auditKnockouts(jdSourceText, vault);

  const dealbreakerWarnings: DealbreakerWarning[] = knockoutReport.findings.map((finding) => ({
    id: finding.ruleId,
    requirement: finding.label,
    type: knockoutTypeFor(finding.ruleId),
    message: finding.status === 'unknown'
      ? `Nie można potwierdzić aktualności: ${finding.label}. ${finding.hint ?? 'Brakuje danych o ważności dokumentu.'}`
      : finding.severity === 'information'
      ? `Oferta wspomina o: ${finding.label}, ale nie określa tego jako wymogu ani atutu. Warto potwierdzić status z rekruterem.`
      : finding.satisfied
      ? `Wymagane: ${finding.label} (potwierdzone w Twoim profilu)`
      : finding.severity === 'knockout'
        ? `Oferta wymaga: ${finding.label}. Nie znaleziono tego w Twoim profilu.`
        : `Mile widziane: ${finding.label}. Warto dopisać, jeśli to posiadasz.`,
    missingInVault: finding.status !== 'unknown' && finding.severity !== 'information' && !finding.satisfied,
    canQuickAdd: finding.status !== 'unknown' && finding.severity !== 'information' && !finding.satisfied,
    quickAddValue: finding.status === 'unknown' || finding.severity === 'information' ? '' : finding.label,
  }));

  // Brakujące umiejętności kluczowe zostają — to jest osobna kategoria niż
  // uprawnienia formalne i dotyczy każdej branży tak samo.
  parsedJd.requiredHardSkills.slice(0, 3).forEach((skill, idx) => {
    if (!vaultSkillsLower.has(skill.toLowerCase()) && !vaultTextFull.includes(skill.toLowerCase())) {
      dealbreakerWarnings.push({
        id: `missing_skill_${idx}`,
        requirement: `Kluczowy Skill: ${skill}`,
        type: 'SKILL',
        message: `Brak wymaganej technologii kluczowej: '${skill}'.`,
        missingInVault: true,
        canQuickAdd: true,
        quickAddValue: skill,
      });
    }
  });

  const total = allJdSkills.length || 1;
  const matchRatio = matchedSkills.length / total;
  const overallMatchPercentage = Math.min(100, Math.round(matchRatio * 100));

  const recommendations: string[] = [];
  if (knockoutReport.blocking.length > 0) {
    // Wymieniamy je z nazwy. „Wykryto potencjalne krytyczne luki" nie mówi
    // użytkownikowi, co ma zrobić — a to jest jedyny powód, dla którego czyta
    // ten ekran.
    const names = knockoutReport.blocking.map((finding) => finding.label).join(', ');
    recommendations.push(`Oferta stawia twarde wymagania, których nie widać w Twoim profilu: ${names}.`);
  }
  if (knockoutReport.optional.length > 0) {
    const names = knockoutReport.optional.map((finding) => finding.label).join(', ');
    recommendations.push(`Mile widziane, warto dopisać jeśli posiadasz: ${names}.`);
  }
  if (missingSkills.length > 0) {
    recommendations.push(`Dodaj brakujące słowa kluczowe do sekcji Skills: ${missingSkills.slice(0, 4).join(', ')}.`);
  } else {
    recommendations.push('Twój profil zawiera pełne pokrycie umiejętności z ogłoszenia!');
  }

  if (parsedJd.seniorityLevel === 'SENIOR' && vault.history.length < 2) {
    recommendations.push('Ogłoszenie wymaga poziomu Senior. Zaakcentuj w podsumowaniu i wpisach wskaźniki biznesowe oraz przywództwo.');
  }

  return {
    parsedJD: parsedJd,
    overallMatchPercentage,
    matchedSkills: Array.from(new Set(matchedSkills)),
    missingSkills: Array.from(new Set(missingSkills)),
    recommendations,
    dealbreakerWarnings,
    benefitsList: parsedJd.benefits ?? [],
    vaultSuggestions: {
      suggestedTitle: parsedJd.jobTitle,
      addSkillsToVault: missingSkills,
      highlightAdvice: [
        `Użyj aktywnego czasownika w pierwszym punkcie historii pod kątem: ${parsedJd.requiredHardSkills[0] || 'Głównych wymagań'}.`,
        `Wzmocnij odniesienie do narzędzia: ${parsedJd.toolsAndTech[0] || 'CI/CD'}.`
      ],
    },
  };
}
