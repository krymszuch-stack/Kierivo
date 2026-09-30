import { MasterVault } from '../types';
import { HR_AND_COMMON_STOP_WORDS, extractDynamicJdPhrases } from './atsSimulator';
import { auditKnockouts, KNOCKOUT_RULES, type KnockoutSeverity } from './knockouts';
import { detectBenefits } from './commuteCalculator';
import {
  dedupeSkillDefinitions, extractGenericRequirementCandidates, extractNiceLanguageSkills,
  findSkillDefinitions,
} from './jdSkillTaxonomy';
import { cleanPastedJobOffer } from './jobOfferCleaner';

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

export interface StructuredLanguage {
  language: string;
  level?: string;
  required: boolean;
  sourceText: string;
}

export interface ParsedJobDescription {
  jobTitle: string;
  companyName: string;
  seniorityLevel: 'ENTRY' | 'MID' | 'SENIOR' | 'LEAD' | 'EXECUTIVE';
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
  workModel?: 'REMOTE' | 'HYBRID' | 'ON_SITE' | 'FLEXIBLE' | string;
  recruitmentMode?: 'ATS_CORPORATE' | 'CRAFT_LOCAL' | 'HYBRID';
  recruitmentModeReason?: string;
  sourceUrl?: string;
  niceToHaveHardSkills?: string[];
  niceToHaveSoftSkills?: string[];
  formalRequirements?: FormalRequirement[];
  experienceMinYears?: number | null;
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
function parseJobDescriptionLocalLegacy(rawJdText: string, defaultTitle = 'Full-Stack Developer'): ParsedJobDescription {
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
  let workModel = 'ON_SITE';
  if (/hybryd|hybrid|cz[ęe][śs]ciowo\s+zdaln/i.test(lower)) {
    workModel = 'HYBRID';
  } else if (/100%\s*zdaln|w\s+pe[łl]ni\s+zdaln|praca\s+zdaln|remote\s+only|fully\s+remote/i.test(lower)) {
    workModel = 'REMOTE';
  } else if (/zdaln|remote/i.test(lower) && !/nie\s+(?:jest\s+)?zdaln/i.test(lower)) {
    workModel = 'REMOTE';
  }

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
    return match ? [match[1], match[2].trim()] : [line];
  });
}

function parseSectionLines(lines: string[], headers: RegExp[]): string[] {
  let start = -1;
  lines.forEach((line, index) => {
    if (headers.some((pattern) => pattern.test(line))) start = index;
  });
  if (start < 0) return [];
  const end = lines.slice(start + 1).findIndex((line) => SECTION_HEADER_PATTERN.test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : start + 1 + end);
}

const REQUIRED_SECTION_HEADERS = [
  /^(nasze|twoje)?\s*wymagania\s*[:.]?$/i, /^wymagane\s*[:.]?$/i,
  /^requirements?\s*[:.]?$/i, /^what we (?:expect|require|need)\s*[:.]?$/i,
  /^(required|minimum|basic) qualifications?\s*[:.]?$/i, /^qualifications?\s*[:.]?$/i,
  /^must[- ]haves?\s*[:.]?$/i, /^what you(?:'|’)ll bring\s*[:.]?$/i,
  /^what you will bring\s*[:.]?$/i, /^your profile\s*[:.]?$/i, /^who you are\s*[:.]?$/i,
  /^(?:czego oczekujemy|nasze oczekiwania|oczekiwania|czego szukamy)(?:\s+(?:od\s+ciebie|od\s+kandydatów|od\s+naszych\s+pracowników))?\s*[:.]?$/i,
];

/** Wyciąga próg stażu tylko z tej samej sekcji wymagań, którą widzi parser oferty. */
export function extractRequiredExperienceYears(rawJdText: string): number | null {
  const lines = normalizeInlineSectionHeaders(
    (rawJdText ?? '').trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  );
  const requiredText = parseSectionLines(lines, REQUIRED_SECTION_HEADERS).join('\n').toLocaleLowerCase('pl-PL');
  const experienceMatch = requiredText.match(
    /(?:minimum(?:\s+of)?|min\.?|co\s+najmniej|at\s+least)\s*(\d{1,2})\s*\+?\s*(?:lat|lata|years?)\b/i
  ) || requiredText.match(
    /\b(\d{1,2})\s*\+?\s*(?:lat|lata)\s+doświadczenia(?:\s+(?:zawodowego|w\s+pracy))?\b/i
  ) || requiredText.match(
    /\b(\d{1,2})\s*\+?\s*years?\s*(?:(?:of|')\s*)?(?:(?:professional|relevant|work)\s+)*experience\b/i
  );

  return experienceMatch ? Number(experienceMatch[1]) : null;
}

export function formatExperienceRequirementLabel(years: number): string {
  const lastTwo = years % 100;
  const last = years % 10;
  const unit = lastTwo >= 12 && lastTwo <= 14 ? 'lat' : last >= 2 && last <= 4 ? 'lata' : 'lat';
  return `Min. ${years} ${unit} doświadczenia`;
}

/**
 * Parser lokalny ogranicza ekstrakcję umiejętności do sekcji wymagań. Stary
 * ekstraktor pozostaje jako fallback dla nietypowych ręcznych ogłoszeń, ale nie
 * może zasilać ATS rzeczownikami z benefitu ani stopki portalu.
 */
export function parseJobDescriptionLocal(rawJdText: string, defaultTitle = 'Full-Stack Developer'): ParsedJobDescription {
  const cleaned = cleanPastedJobOffer(rawJdText);
  const effectiveRaw = cleaned.hasNoiseRemoved ? cleaned.cleanText : rawJdText;
  const legacy = parseJobDescriptionLocalLegacy(effectiveRaw, cleaned.title || defaultTitle);
  const text = effectiveRaw.trim();
  const lines = normalizeInlineSectionHeaders(text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  const requiredLines = parseSectionLines(lines, REQUIRED_SECTION_HEADERS);
  const niceLines = parseSectionLines(lines, [
    /^mile widziane/i, /^nice[- ]to[- ]have/i, /^preferred(?:\s+qualifications?)?/i,
    /^dodatkowo/i, /^additionally/i,
  ]);
  const requiredSectionText = requiredLines.join('\n');
  const niceSectionText = niceLines.join('\n');
  // Jedno źródło prawdy dla umiejętności/narzędzi — `src/lib/jdSkillTaxonomy.ts`.
  // Płaska lista `skillNames` obsługiwała tylko IT/.NET; ślepy holdout na 20
  // ofertach z innych branż pokazał 12 FN samych brakujących kompetencji
  // domenowych i 19 brakujących narzędzi/platform (reguła 8).
  const requiredDefs = dedupeSkillDefinitions(findSkillDefinitions(requiredSectionText));
  const niceDefsRaw = dedupeSkillDefinitions(findSkillDefinitions(niceSectionText))
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
    .filter((token) => !requiredTaxonomyTerms.some((skill) => skill.toLowerCase() === token.toLowerCase()))
    .filter((token) => !softNames.some((skill) => skill.toLowerCase() === token.toLowerCase()))
    .filter((token) => !PORTAL_NOISE.test(token));
  const genericNice = extractGenericRequirementCandidates(niceSectionText)
    .filter((token) => !requiredTaxonomyTerms.some((skill) => skill.toLowerCase() === token.toLowerCase()))
    .filter((token) => !genericRequired.some((skill) => skill.toLowerCase() === token.toLowerCase()))
    .filter((token) => !softNames.some((skill) => skill.toLowerCase() === token.toLowerCase()))
    .filter((token) => !PORTAL_NOISE.test(token));
  // Nazwa języka bez poziomu w sekcji "Mile widziane" liczy się jako dodatkowa
  // umiejętność (np. „Angielski.”) — ale TYLKO tam. W sekcji wymagań język
  // pozostaje wyłącznie formalnym progiem (`structuredLanguages`), inaczej
  // niemal każda oferta zyskałaby fałszywy wpis „Angielski” jako skill.
  const niceLanguageSkills = extractNiceLanguageSkills(niceSectionText)
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
  const soft = softNames.filter((skill) => new RegExp(skill, 'i').test(requiredSectionText));
  const niceSoft = softNames.filter((skill) => new RegExp(skill, 'i').test(niceSectionText));
  const structuredLanguages = lines.flatMap((line, index) => {
    const match = line.match(/\b(angielski|niemiecki|francuski|hiszpański|polski|english|german|french|spanish)\b(?:\s*\(([^)]*)\))?/i);
    const previousLine = lines[index - 1] || '';
    const requiredByHeader = /^wymagane języki\b/i.test(previousLine);
    return match ? [{ language: match[1], level: match[2], required: requiredLines.includes(line) || /wymagan|minimum|min\./i.test(line) || requiredByHeader, sourceText: line }] : [];
  });
  const lower = text.toLocaleLowerCase('pl-PL');
  // Staż kandydata wolno wyprowadzić z wymagań, nie z opisu firmy (np. „25 lat na rynku”).
  const experienceMinYears = extractRequiredExperienceYears(text);
  const salaryMatch = text.match(/(?:od\s*)?(\d[\d\s.]*(?:,\d+)?)\s*(?:–|-|do)\s*(\d[\d\s.]*(?:,\d+)?)\s*(zł|pln|eur|usd)([^.\n]*)/i);
  const parseNumber = (value: string) => Number(value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
  const salary = salaryMatch ? {
    min: parseNumber(salaryMatch[1]), max: parseNumber(salaryMatch[2]), currency: salaryMatch[3].toUpperCase().replace('ZŁ', 'PLN'),
    period: /godz|h\b/i.test(salaryMatch[4]) ? 'godzina' : /mies/i.test(salaryMatch[4]) ? 'miesiąc' : 'nieokreślony',
    grossNet: /netto/i.test(salaryMatch[4]) ? 'netto' : /brutto/i.test(salaryMatch[4]) ? 'brutto' : 'nieokreślony',
  } : null;
  const formalRequirements: FormalRequirement[] = [];
  for (const rule of KNOCKOUT_RULES) {
    const sourceText = requiredLines.find((line) => rule.detect.some((pattern) => pattern.test(line)));
    if (sourceText) formalRequirements.push({ id: rule.id, label: rule.label, required: true, severity: rule.severity, sourceText });
  }
  const degreeLine = lines.find((line) => /wykształcenie wyższe|studia wyższe|bachelor|master degree/i.test(line));
  if (degreeLine) formalRequirements.push({ id: 'degree', label: degreeLine, required: requiredLines.includes(degreeLine), severity: 'information', sourceText: degreeLine });
  if (experienceMinYears !== null) formalRequirements.push({ id: 'experience_years', label: formatExperienceRequirementLabel(experienceMinYears), required: true, severity: 'information', sourceText: requiredLines.find((line) => /\d+\s*\+?\s*(?:lat|lata|years?)/i.test(line)) || '' });
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
  const usefulTitle = defaultTitle.length > 3 && !/^(full-stack developer|stanowisko)$/i.test(defaultTitle);
  const titleFromText = lines.find((line) => /^(poszukujemy|rekrutacja na|stanowisko:|oferta:)/i.test(line))
    ?.replace(/^(poszukujemy|rekrutacja na|stanowisko:|oferta:)\s*/i, '').trim();
  const jobTitle = usefulTitle ? defaultTitle : (cleaned.title || titleFromText || lines.find((line) => line.length > 3 && line.length < 90 && !/^(firma|wymagania|o firmie|lokalizacja|wynagrodzenie)/i.test(line)) || legacy.jobTitle);
  const mandatoryRequirements = formalRequirements.filter((requirement) => requirement.required).map((requirement) => requirement.label);
  const explicitLocationLine = lines.find((line) => /^lokalizacja:\s*(.+)$/i.test(line));
  const explicitLocation = explicitLocationLine ? explicitLocationLine.replace(/^lokalizacja:\s*/i, '').trim() : '';
  const location = explicitLocation || cleaned.location || lines.find((line) => /warszawa|katowice|gliwice|kraków|wrocław|gdańsk|poznań|łódź|szczecin|białołęka|polska|oświęcim|zielona góra|luzino|bochnia|trzebnica|sandomierz|siedlce|korsze|piaseczno/i.test(line));
  const contractTypes = Array.from(new Set(lines.filter((line) => /umowa o pracę|umowa zlecenie|umowa o dzieło|kontrakt b2b|pełny etat|część etatu/i.test(line))));
  const workModel: ParsedJobDescription['workModel'] = /praca zdalna|zdalnie|remote/i.test(lower) ? 'REMOTE' : /stacjonarn|z biura|in-office/i.test(lower) ? 'ON_SITE' : legacy.workModel;
  const explicitSalaryLine = lines.find((line) => /^wynagrodzenie:\s*(.+)$/i.test(line));
  const explicitSalary = explicitSalaryLine ? explicitSalaryLine.replace(/^wynagrodzenie:\s*/i, '').trim() : '';
  const salaryRange = explicitSalary || cleaned.salary || salaryMatch?.[0];
  return {
    ...legacy,
    jobTitle,
    companyName,
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
    message: finding.severity === 'information'
      ? `Oferta wspomina o: ${finding.label}, ale nie określa tego jako wymogu ani atutu. Warto potwierdzić status z rekruterem.`
      : finding.satisfied
      ? `Wymagane: ${finding.label} (potwierdzone w Twoim profilu)`
      : finding.severity === 'knockout'
        ? `Oferta wymaga: ${finding.label}. Nie znaleziono tego w Twoim profilu.`
        : `Mile widziane: ${finding.label}. Warto dopisać, jeśli to posiadasz.`,
    missingInVault: finding.severity !== 'information' && !finding.satisfied,
    canQuickAdd: finding.severity !== 'information' && !finding.satisfied,
    quickAddValue: finding.severity === 'information' ? '' : finding.label,
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
