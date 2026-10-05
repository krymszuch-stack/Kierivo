import { MasterVault, TailoredResume } from '../types';
import { HR_AND_COMMON_STOP_WORDS, extractDynamicJdPhrases } from './atsSimulator';
import { countPhraseOccurrences, containsPhrase, hasPositiveSkillEvidence } from './skillEvidence';
import { auditKnockouts } from './knockouts';
import { SKILL_TAXONOMY, skillRegex } from './jdSkillTaxonomy';
import { parseJobDescriptionLocal } from './jdParser';
import { hasPositiveRequirementMention } from './jdOptionality';
import { isSupportedSkillAnnotation } from './candidateEvidence';

export type KeywordCategory = 'HARD_SKILL' | 'TOOL' | 'SOFT_SKILL' | 'LICENSE';

export type KeywordMatchStatus =
  | 'MATCHED_IN_CV'        // Słowo jest wyeksponowane w bieżącym CV
  | 'IN_VAULT_NOT_IN_CV'   // Słowo istnieje w MasterVault (np. w projektach/skills), ale brak go w wybranym CV
  | 'MISSING_IN_VAULT';    // Słowo wymagane w JD, brak w profilu MasterVault

export interface ExtractedKeyword {
  id: string;
  term: string;
  category: KeywordCategory;
  occurrencesInJd: number;
  status: KeywordMatchStatus;
  foundInVaultLocations: string[]; // np. ['skillsMatrix.hardSkills', 'Projekt: System Płatności']
  foundInCvLocations: string[];    // np. ['Podsumowanie', 'Doświadczenie: Cloud Corp']
  foundInVaultEvidence?: string[];
  foundInCvEvidence?: string[];
  jobRequirementEvidence?: string;
  importance: 'CRITICAL' | 'IMPORTANT' | 'NICE_TO_HAVE';
}

export interface KeywordSuggestion {
  id: string;
  keyword: string;
  category: KeywordCategory;
  type:
    | 'PROMOTE_FROM_VAULT_TO_PROJECT'
    | 'PROMOTE_FROM_VAULT_TO_EXPERIENCE'
    | 'ADD_TO_VAULT_SKILLS'
    | 'ADD_TO_CV_SUMMARY';
  message: string;
  targetName?: string;
  targetType?: 'project' | 'experience' | 'skills' | 'summary';
  targetId?: string;
  /** Wiersz źródłowy z historii zatrudnienia, gdy ukryty dowód pochodzi z niej. */
  sourceExperienceId?: string;
  sourceRole?: string;
  sourceCompany?: string;
  sourceEvidence?: string;
  /** Tekst edytowany przez użytkownika przed zastosowaniem pojedynczej zmiany. */
  proposedText?: string;
}

export interface CategoryCoverage {
  category: KeywordCategory;
  label: string;
  total: number;
  matchedInCv: number;
  inVaultOnly: number;
  missingInVault: number;
  cvPercentage: number;
  vaultPercentage: number;
}

export interface JdKeywordMappingResult {
  keywords: ExtractedKeyword[];
  overallCvScore: number;
  categoryCoverage: Record<KeywordCategory, CategoryCoverage>;
  suggestions: KeywordSuggestion[];
  counts: {
    total: number;
    matchedInCv: number;
    inVaultNotCv: number;
    missingInVault: number;
  };
}

/** Dodaje lub cofa pojedynczy, jawnie wskazany termin w roboczej wersji CV. */
export function applyKeywordSuggestionToResume(
  resume: TailoredResume,
  suggestion: KeywordSuggestion,
  apply: boolean
): TailoredResume {
  if (suggestion.category === 'LICENSE') return resume;
  if (suggestion.sourceExperienceId && suggestion.sourceEvidence) {
    if (apply) {
      const alreadyIncluded = resume.selectedHighlights.some((highlight) =>
        highlight.experienceId === suggestion.sourceExperienceId &&
        highlight.originalText === suggestion.sourceEvidence
      );
      if (alreadyIncluded) return resume;
      return {
        ...resume,
        selectedHighlights: [
          ...resume.selectedHighlights,
          {
            experienceId: suggestion.sourceExperienceId,
            role: suggestion.sourceRole || '',
            company: suggestion.sourceCompany || '',
            originalText: suggestion.sourceEvidence,
            optimizedText: suggestion.proposedText?.trim() || suggestion.sourceEvidence,
            source: 'SLOT_FILLING',
            keywordsMatched: [suggestion.keyword],
          },
        ],
      };
    }
    return {
      ...resume,
      selectedHighlights: resume.selectedHighlights.filter((highlight) => !(
        highlight.experienceId === suggestion.sourceExperienceId &&
        highlight.originalText === suggestion.sourceEvidence &&
        highlight.optimizedText === (suggestion.proposedText?.trim() || suggestion.sourceEvidence) &&
        highlight.keywordsMatched.includes(suggestion.keyword)
      )),
    };
  }
  const field = suggestion.category === 'TOOL'
    ? 'toolsAndTech'
    : suggestion.category === 'SOFT_SKILL'
      ? 'softSkills'
      : 'hardSkills';
  const currentValues = resume.skillsMatched[field];
  const normalizedKeyword = normalizeTerm(suggestion.keyword);
  const nextValues = apply
    ? (currentValues.some((value) => normalizeTerm(value) === normalizedKeyword)
      ? currentValues
      : [...currentValues, suggestion.keyword])
    : currentValues.filter((value) => normalizeTerm(value) !== normalizedKeyword);

  return {
    ...resume,
    skillsMatched: { ...resume.skillsMatched, [field]: nextValues },
  };
}

/** Umiejętności pochodzą ze wspólnej taksonomii; tu mapujemy je tylko na etykiety UI. */
const TECH_AND_TOOLS_DICTIONARY: Array<{
  name: string;
  category: KeywordCategory;
  pattern?: string;
  guard?: (source: string) => boolean;
}> = [
  ...SKILL_TAXONOMY.map(({ term, kind, pattern, guard }) => ({
    name: term,
    category: kind === 'TOOL' ? 'TOOL' as const : 'HARD_SKILL' as const,
    pattern,
    guard,
  })),
  // Uprawnienia nie są umiejętnościami z taksonomii i pozostają odrębną klasą.
  ...[
    'SEP G1', 'SEP G2', 'SEP G3', 'UDT wózki', 'UDT suwnice', 'F-Gaz',
    'Prawo Jazdy Kat. B', 'Prawo Jazdy Kat. C', 'Prawo Jazdy Kat. C+E',
    'Praca na wysokości',
  ].map((name) => ({ name, category: 'LICENSE' as const })),
];

function dictionaryOccurrences(
  text: string,
  item: (typeof TECH_AND_TOOLS_DICTIONARY)[number],
): number {
  if (item.guard && !item.guard(text)) return 0;
  const kind = item.category === 'TOOL' ? 'TOOL' : 'HARD';
  return text.match(skillRegex({ term: item.name, kind, pattern: item.pattern }))?.length ?? 0;
}

function hasDictionaryEvidence(text: string, item: (typeof TECH_AND_TOOLS_DICTIONARY)[number]): boolean {
  if (item.guard && !item.guard(text)) return false;
  const kind = item.category === 'TOOL' ? 'TOOL' : 'HARD';
  return (text.match(skillRegex({ term: item.name, kind, pattern: item.pattern })) ?? [])
    .some(mention => hasPositiveSkillEvidence(text, mention));
}

const SOFT_SKILLS_DICTIONARY: string[] = [
  'Komunikatywność',
  'Praca zespołowa',
  'Analityczne myślenie',
  'Rozwiązywanie problemów',
  'Zarządzanie czasem',
  'Przywództwo',
  'Elastyczność',
  'Inicjatywa',
  'Mentoring',
  'Samodzielność',
  'Odporność na stres',
  'Dokładność',
  'Organizacja pracy',
];

/**
 * Normalizuje ciąg do porównań bez uwzględniania wielkości liter i zbędnych znaków.
 */
function normalizeTerm(str: string): string {
  return str.trim().toLowerCase().replace(/[^\p{L}\p{N}#+.-]/gu, '');
}

/**
 * Sprawdza wystąpienie frazy w tekście — deleguje do kanonicznego licznika
 * (`skillEvidence`), żeby `Java` ≠ `JavaScript` tak samo jak w symulatorze
 * (F14: jeden graf dopasowań, nie dwa rozjechane).
 */
function countOccurrences(text: string, term: string): number {
  if (!text || !term) return 0;
  return countPhraseOccurrences(text, term);
}

function sourceExcerpt(text: string, term: string, candidate = true): string | undefined {
  const excerpt = text
    .split(/\n+|(?<=[.!?;])\s+/u)
    .map((part) => part.trim())
    .find((part) => candidate ? hasPositiveSkillEvidence(part, term) : countOccurrences(part, term) > 0);
  if (!excerpt) return undefined;
  return excerpt.length > 240 ? `${excerpt.slice(0, 237).trimEnd()}…` : excerpt;
}

/**
 * Główna funkcja mapująca słowa kluczowe z opisu stanowiska (Job Description)
 * przeciwko MasterVault oraz wyselekcjonowanemu CV.
 */
export function mapJdKeywords(
  rawJdText: string,
  vault: MasterVault,
  tailoredResume?: TailoredResume | null
): JdKeywordMappingResult {
  const jdText = rawJdText.trim();
  if (!jdText) {
    return createEmptyMappingResult();
  }
  const parsedJd = parseJobDescriptionLocal(jdText);
  const parsedRequirementsText = parsedJd.sourceSections?.required?.join('\n').trim() ?? '';
  const requirementText = parsedRequirementsText || jdText;
  const parserRequiredTerms = Array.from(new Set([
    ...parsedJd.requiredHardSkills,
    ...parsedJd.requiredSoftSkills,
    ...parsedJd.toolsAndTech,
  ]));
  const dynamicRequiredTerms = extractDynamicJdPhrases(requirementText).hardSkills
    .map((skill) => skill.phrase)
    .filter((term) => hasPositiveRequirementMention(requirementText, term))
    .filter((term) => !parserRequiredTerms.some((known) => containsPhrase(term, known) || containsPhrase(known, term)));
  const canonicalRequiredTerms = [...parserRequiredTerms, ...dynamicRequiredTerms];
  // Lista braków musi używać tych samych rozpoznanych wymagań co wynik kanoniczny.
  // Skan całego ogłoszenia podnosił technologie z obowiązków, benefitów i stopki
  // do rangi braków kandydata, mimo że nie zwiększały mianownika ATS.
  const canonicalRequirementTerm = (term: string): string | undefined => {
    if (!parsedRequirementsText) return term;
    const exact = canonicalRequiredTerms.find((candidate) => normalizeTerm(candidate) === normalizeTerm(term));
    if (exact) return exact;
    // Taksonomia potrafi nazwać system „Windows”, a NLP wyciągnąć „Windows 11”.
    // W mapperze zachowaj nazwę kanoniczną, aby nie policzyć jednego wymogu dwa razy.
    return canonicalRequiredTerms.find((candidate) => containsPhrase(term, candidate));
  };

  // 1. Zbuduj mapę lokalizacji faktów w MasterVault
  const vaultLocationsMap = new Map<string, string[]>();
  const vaultEvidenceMap = new Map<string, string[]>();
  const experienceEvidenceMap = new Map<string, { id: string; role: string; company: string; text: string }>();

  const registerVaultTerm = (term: string, location: string, evidence = term) => {
    if (!isSupportedSkillAnnotation(evidence, term)) return;
    const norm = normalizeTerm(term);
    if (!norm) return;
    const list = vaultLocationsMap.get(norm) || [];
    if (!list.includes(location)) {
      list.push(location);
    }
    vaultLocationsMap.set(norm, list);
    const evidenceList = vaultEvidenceMap.get(norm) || [];
    const excerpt = sourceExcerpt(evidence, term) ?? evidence.trim();
    if (excerpt && !evidenceList.includes(excerpt)) evidenceList.push(excerpt);
    vaultEvidenceMap.set(norm, evidenceList);
  };

  // Zarejestruj skillsMatrix
  vault.skillsMatrix?.hardSkills?.forEach((s) => registerVaultTerm(s, 'Umiejętności twarde (SkillsMatrix)'));
  vault.skillsMatrix?.toolsAndTech?.forEach((t) => registerVaultTerm(t, 'Narzędzia i technologie (SkillsMatrix)'));
  vault.skillsMatrix?.softSkills?.forEach((s) => registerVaultTerm(s, 'Umiejętności miękkie (SkillsMatrix)'));
  vault.profiler?.licenses?.forEach((l) => registerVaultTerm(l, 'Uprawnienia formalne (Profiler)'));
  vault.skillsMatrix?.certifications?.forEach((c) => registerVaultTerm(c.name, `Certyfikat: ${c.name}`));

  // Zarejestruj projekty w MasterVault
  vault.projects?.forEach((p) => {
    const loc = `Projekt: ${p.name}`;
    p.techStack?.forEach((t) => registerVaultTerm(t, loc, p.description || t));
    if (p.description) {
      TECH_AND_TOOLS_DICTIONARY.forEach((dict) => {
        if (hasDictionaryEvidence(p.description, dict)) {
          registerVaultTerm(dict.name, loc, p.description);
        }
      });
      SKILL_TAXONOMY.forEach(({ term }) => {
        if (hasPositiveSkillEvidence(p.description, term)) registerVaultTerm(term, loc, p.description);
      });
    }
  });

  // Zarejestruj historię zatrudnienia w MasterVault
  vault.history?.forEach((h) => {
    const loc = `Doświadczenie: ${h.company} (${h.role})`;
    // Opis stanowiska może zawierać obowiązek pominięty w krótkich punktach CV.
    // ATS czyta go z Vault, więc mapper musi sprawdzać to samo źródło zamiast
    // zgłaszać fałszywy brak kompetencji.
    const description = h.description;
    if (description) {
      TECH_AND_TOOLS_DICTIONARY.forEach((dict) => {
        if (hasDictionaryEvidence(description, dict)) {
          registerVaultTerm(dict.name, loc, description);
          experienceEvidenceMap.set(normalizeTerm(dict.name), {
            id: h.id, role: h.role, company: h.company,
            text: sourceExcerpt(description, dict.name) ?? description.trim().slice(0, 240),
          });
        }
      });
      SKILL_TAXONOMY.forEach(({ term }) => {
        if (hasPositiveSkillEvidence(description, term)) {
          registerVaultTerm(term, loc, description);
          const sentences = description.split(/\n+|(?<=[.!?;])\s+/u).map((part) => part.trim()).filter(Boolean);
          const evidence = sentences.find((part) => hasPositiveSkillEvidence(part, term)) ?? description.trim();
          experienceEvidenceMap.set(normalizeTerm(term), {
            id: h.id, role: h.role, company: h.company,
            text: evidence.length > 240 ? `${evidence.slice(0, 237).trimEnd()}…` : evidence,
          });
        }
      });
    }
    h.highlights?.forEach((hl) => {
      hl.keywords?.forEach((k) => {
        if (!isSupportedSkillAnnotation(hl.text, k)) return;
        registerVaultTerm(k, loc, hl.text);
        if (!experienceEvidenceMap.has(normalizeTerm(k))) experienceEvidenceMap.set(normalizeTerm(k), {
          id: h.id, role: h.role, company: h.company,
          text: sourceExcerpt(hl.text, k) ?? hl.text.trim().slice(0, 240),
        });
      });
      TECH_AND_TOOLS_DICTIONARY.forEach((dict) => {
        if (hasDictionaryEvidence(hl.text, dict)) {
          registerVaultTerm(dict.name, loc, hl.text);
          experienceEvidenceMap.set(normalizeTerm(dict.name), {
            id: h.id, role: h.role, company: h.company,
            text: sourceExcerpt(hl.text, dict.name) ?? hl.text.trim().slice(0, 240),
          });
        }
      });
      SKILL_TAXONOMY.forEach(({ term }) => {
        if (hasPositiveSkillEvidence(hl.text, term)) {
          registerVaultTerm(term, loc, hl.text);
          const sentences = hl.text.split(/\n+|(?<=[.!?;])\s+/u).map((part) => part.trim()).filter(Boolean);
          const evidence = sentences.find((part) => hasPositiveSkillEvidence(part, term)) ?? hl.text.trim();
          experienceEvidenceMap.set(normalizeTerm(term), {
            id: h.id, role: h.role, company: h.company,
            text: evidence.length > 240 ? `${evidence.slice(0, 237).trimEnd()}…` : evidence,
          });
        }
      });
    });
  });

  // 2. Zbuduj mapę lokalizacji słów w bieżącym CV (TailoredResume lub wybrane highlights)
  const cvLocationsMap = new Map<string, string[]>();
  const cvEvidenceMap = new Map<string, string[]>();

  const registerCvTerm = (term: string, location: string, evidence = term) => {
    if (!isSupportedSkillAnnotation(evidence, term)) return;
    const norm = normalizeTerm(term);
    if (!norm) return;
    const list = cvLocationsMap.get(norm) || [];
    if (!list.includes(location)) {
      list.push(location);
    }
    cvLocationsMap.set(norm, list);
    const evidenceList = cvEvidenceMap.get(norm) || [];
    const excerpt = sourceExcerpt(evidence, term) ?? evidence.trim();
    if (excerpt && !evidenceList.includes(excerpt)) evidenceList.push(excerpt);
    cvEvidenceMap.set(norm, evidenceList);
  };

  if (tailoredResume) {
    tailoredResume.skillsMatched?.hardSkills?.forEach((s) => registerCvTerm(s, 'CV: Kluczowe umiejętności'));
    tailoredResume.skillsMatched?.toolsAndTech?.forEach((t) => registerCvTerm(t, 'CV: Narzędzia'));
    tailoredResume.skillsMatched?.softSkills?.forEach((s) => registerCvTerm(s, 'CV: Kompetencje miękkie'));
    if (tailoredResume.summary) {
      TECH_AND_TOOLS_DICTIONARY.forEach((dict) => {
        if (hasDictionaryEvidence(tailoredResume.summary, dict)) {
          registerCvTerm(dict.name, 'CV: Podsumowanie zawodowe', tailoredResume.summary);
        }
      });
      SKILL_TAXONOMY.forEach(({ term }) => {
        if (hasPositiveSkillEvidence(tailoredResume.summary, term)) registerCvTerm(term, 'CV: Podsumowanie zawodowe', tailoredResume.summary);
      });
    }
    tailoredResume.selectedHighlights?.forEach((sh) => {
      sh.keywordsMatched?.forEach((k) => registerCvTerm(k, `CV: ${sh.company} (${sh.role})`, sh.optimizedText || sh.originalText));
      TECH_AND_TOOLS_DICTIONARY.forEach((dict) => {
        if (hasDictionaryEvidence(sh.optimizedText || sh.originalText, dict)) {
          registerCvTerm(dict.name, `CV: ${sh.company} (${sh.role})`, sh.optimizedText || sh.originalText);
        }
      });
      SKILL_TAXONOMY.forEach(({ term }) => {
        const text = sh.optimizedText || sh.originalText;
        if (hasPositiveSkillEvidence(text, term)) registerCvTerm(term, `CV: ${sh.company} (${sh.role})`, text);
      });
    });
  } else {
    // Gdy brak tailoredResume, sprawdzamy pozycje w głównym CV
    if (vault.personalInfo?.summary) {
      TECH_AND_TOOLS_DICTIONARY.forEach((dict) => {
        if (hasDictionaryEvidence(vault.personalInfo.summary, dict)) {
          registerCvTerm(dict.name, 'CV: Podsumowanie', vault.personalInfo.summary);
        }
      });
      SKILL_TAXONOMY.forEach(({ term }) => {
        if (hasPositiveSkillEvidence(vault.personalInfo.summary, term)) registerCvTerm(term, 'CV: Podsumowanie', vault.personalInfo.summary);
      });
    }
    vault.history?.forEach((h) => {
      h.highlights?.forEach((hl) => {
        hl.keywords?.forEach((k) => registerCvTerm(k, `CV: ${h.company}`, hl.text));
      });
    });
  }

  // 3. Ekstrakcja słów kluczowych z tekstu ogłoszenia (JD)
  const extractedKeywordsMap = new Map<string, ExtractedKeyword>();
  const knockoutReport = auditKnockouts(jdText, vault);
  const knockoutLabels = knockoutReport.findings.map((finding) => finding.label);
  const duplicatesFormalRequirement = (phrase: string) =>
    knockoutLabels.some((label) => containsPhrase(label, phrase) || containsPhrase(phrase, label)) ||
    (normalizeTerm(phrase) === 'c' && knockoutReport.findings.some((finding) => finding.ruleId === 'license_c'));

  // A. Ekstrakcja ze słownika technologii i uprawnień
  for (const item of TECH_AND_TOOLS_DICTIONARY) {
    // Wymóg formalny ma jedną etykietę z audytu, także gdy taksonomia NLP
    // znalazła jego fragment (np. pojedyncze „C”).
    if (duplicatesFormalRequirement(item.name)) continue;
    // Formalia są klasyfikowane przez audyt wymagań. Wspomniane przy okazji lub
    // opcjonalne uprawnienie nie może trafić do sekcji braków jako twardy wymóg.
    if (item.category === 'LICENSE' && !knockoutReport.findings.some((finding) =>
      finding.severity === 'knockout' && containsPhrase(finding.label, item.name)
    )) continue;
    const occurrences = dictionaryOccurrences(requirementText, item);
    if (occurrences > 0) {
      const canonicalTerm = canonicalRequirementTerm(item.name);
      if (!canonicalTerm) continue;
      const norm = normalizeTerm(canonicalTerm);
      const vaultLocs = vaultLocationsMap.get(norm) || [];
      const cvLocs = cvLocationsMap.get(norm) || [];

      let status: KeywordMatchStatus = 'MISSING_IN_VAULT';
      if (cvLocs.length > 0) {
        status = 'MATCHED_IN_CV';
      } else if (vaultLocs.length > 0) {
        status = 'IN_VAULT_NOT_IN_CV';
      }

      extractedKeywordsMap.set(norm, {
        id: `kw_${norm}`,
        term: canonicalTerm,
        category: item.category,
        occurrencesInJd: occurrences,
        status,
        foundInVaultLocations: vaultLocs,
        foundInCvLocations: cvLocs,
        importance: occurrences >= 3 ? 'CRITICAL' : occurrences >= 2 ? 'IMPORTANT' : 'NICE_TO_HAVE',
        foundInVaultEvidence: vaultEvidenceMap.get(norm) || [],
        foundInCvEvidence: cvEvidenceMap.get(norm) || [],
        jobRequirementEvidence: sourceExcerpt(requirementText, canonicalTerm, false),
      });
    }
  }

  // B. Ekstrakcja ze słownika kompetencji miękkich
  for (const soft of SOFT_SKILLS_DICTIONARY) {
    const occurrences = countOccurrences(requirementText, soft);
    if (occurrences > 0) {
      const canonicalTerm = canonicalRequirementTerm(soft);
      if (!canonicalTerm) continue;
      const norm = normalizeTerm(canonicalTerm);
      const vaultLocs = vaultLocationsMap.get(norm) || [];
      const cvLocs = cvLocationsMap.get(norm) || [];

      let status: KeywordMatchStatus = 'MISSING_IN_VAULT';
      if (cvLocs.length > 0) {
        status = 'MATCHED_IN_CV';
      } else if (vaultLocs.length > 0) {
        status = 'IN_VAULT_NOT_IN_CV';
      }

      extractedKeywordsMap.set(norm, {
        id: `kw_${norm}`,
        term: canonicalTerm,
        category: 'SOFT_SKILL',
        occurrencesInJd: occurrences,
        status,
        foundInVaultLocations: vaultLocs,
        foundInCvLocations: cvLocs,
        importance: occurrences >= 2 ? 'IMPORTANT' : 'NICE_TO_HAVE',
        foundInVaultEvidence: vaultEvidenceMap.get(norm) || [],
        foundInCvEvidence: cvEvidenceMap.get(norm) || [],
        jobRequirementEvidence: sourceExcerpt(requirementText, canonicalTerm, false),
      });
    }
  }

  // C. Dynamiczna ekstrakcja NLP (frazy wielowyrazowe i rzadkie technologie)
  const dynamicNlp = extractDynamicJdPhrases(requirementText);
  dynamicNlp.hardSkills.forEach((hs) => {
    if (!hasPositiveRequirementMention(requirementText, hs.phrase)) return;
    const canonicalTerm = canonicalRequirementTerm(hs.phrase);
    if (!canonicalTerm) return;
    const norm = normalizeTerm(canonicalTerm);
    if (!extractedKeywordsMap.has(norm) && !HR_AND_COMMON_STOP_WORDS.has(norm) && !duplicatesFormalRequirement(hs.phrase)) {
      const vaultLocs = vaultLocationsMap.get(norm) || [];
      const cvLocs = cvLocationsMap.get(norm) || [];
      let status: KeywordMatchStatus = 'MISSING_IN_VAULT';
      if (cvLocs.length > 0) status = 'MATCHED_IN_CV';
      else if (vaultLocs.length > 0) status = 'IN_VAULT_NOT_IN_CV';

      extractedKeywordsMap.set(norm, {
        id: `kw_${norm}`,
        term: canonicalTerm,
        category: 'HARD_SKILL',
        occurrencesInJd: 1,
        status,
        foundInVaultLocations: vaultLocs,
        foundInCvLocations: cvLocs,
        importance: 'IMPORTANT',
        foundInVaultEvidence: vaultEvidenceMap.get(norm) || [],
        foundInCvEvidence: cvEvidenceMap.get(norm) || [],
        jobRequirementEvidence: sourceExcerpt(requirementText, canonicalTerm, false),
      });
    }
  });

  // D. Weryfikacja kryteriów formalnych i knock-outów (SEP, UDT, Prawo Jazdy)
  knockoutReport.findings.forEach((finding) => {
    // UNKNOWN nie jest pozycją brakującą; kanoniczny wynik pokazuje osobne
    // wyjaśnienie i nie może dostać równoległego, czerwonego wpisu mappera.
    if (finding.severity !== 'knockout' || finding.status === 'unknown') return;
    const norm = normalizeTerm(finding.label);
    if (!extractedKeywordsMap.has(norm)) {
      const vaultLocs = finding.satisfied ? ['Uprawnienia w profilu (Profiler)'] : [];
      const cvLocs = finding.satisfied ? ['CV: Uprawnienia'] : [];
      extractedKeywordsMap.set(norm, {
        id: `kw_license_${norm}`,
        term: finding.label,
        category: 'LICENSE',
        occurrencesInJd: 1,
        status: finding.satisfied ? 'MATCHED_IN_CV' : 'MISSING_IN_VAULT',
        foundInVaultLocations: vaultLocs,
        foundInCvLocations: cvLocs,
        importance: 'CRITICAL',
        foundInVaultEvidence: vaultEvidenceMap.get(norm) || [],
        foundInCvEvidence: cvEvidenceMap.get(norm) || [],
        jobRequirementEvidence: sourceExcerpt(jdText, finding.label, false),
      });
    }
  });

  // W konstrukcji „ServiceNow lub Jira” kandydat nie musi znać obu narzędzi.
  // Usunięcie Jiry z rachunku wymaga pozytywnego śladu ServiceNow w CV lub profilu.
  const serviceNowOrJira = /servicenow\s+(?:or|lub)\s+jira\b/i.test(requirementText);
  const hasServiceNowEvidence = (vaultLocationsMap.get(normalizeTerm('ServiceNow'))?.length ?? 0) > 0 ||
    (cvLocationsMap.get(normalizeTerm('ServiceNow'))?.length ?? 0) > 0;
  if (serviceNowOrJira && hasServiceNowEvidence) {
    for (const [key, keyword] of extractedKeywordsMap) {
      if (/\bjira\b/i.test(keyword.term)) extractedKeywordsMap.delete(key);
    }
  }

  const keywords = Array.from(extractedKeywordsMap.values()).sort((a, b) => {
    if (a.importance === 'CRITICAL' && b.importance !== 'CRITICAL') return -1;
    if (b.importance === 'CRITICAL' && a.importance !== 'CRITICAL') return 1;
    return b.occurrencesInJd - a.occurrencesInJd;
  });

  // 4. Generowanie inteligentnych sugestii (np. "Dodaj 'Kafka' do opisu projektu Y — masz to w vault, ale nie w CV")
  const suggestions: KeywordSuggestion[] = [];

  for (const kw of keywords) {
    if (kw.status === 'IN_VAULT_NOT_IN_CV') {
      // Sprawdź czy słowo pochodzi z projektu
      const projectLoc = kw.foundInVaultLocations.find((loc) => loc.startsWith('Projekt:'));
      if (projectLoc) {
        const projectName = projectLoc.replace('Projekt: ', '');
        suggestions.push({
          id: `sug_proj_${kw.id}`,
          keyword: kw.term,
          category: kw.category,
          type: 'PROMOTE_FROM_VAULT_TO_PROJECT',
          message: `Dodaj „${kw.term}” do opisu projektu „${projectName}” — masz to w Vault, ale nie w wybranym CV.`,
          targetName: projectName,
          targetType: 'project',
        });
        continue;
      }

      // Sprawdź czy słowo pochodzi z historii zatrudnienia
      const expLoc = kw.foundInVaultLocations.find((loc) => loc.startsWith('Doświadczenie:'));
      if (expLoc) {
        const expName = expLoc.replace('Doświadczenie: ', '');
        suggestions.push({
          id: `sug_exp_${kw.id}`,
          keyword: kw.term,
          category: kw.category,
          type: 'PROMOTE_FROM_VAULT_TO_EXPERIENCE',
          message: `Wyeksponuj „${kw.term}” w doświadczeniu „${expName}” — posiadasz to w historii zatrudnienia, ale brak w bieżącej selekcji CV.`,
          targetName: expName,
          targetType: 'experience',
          ...(experienceEvidenceMap.has(normalizeTerm(kw.term)) ? {
            sourceExperienceId: experienceEvidenceMap.get(normalizeTerm(kw.term))?.id,
            sourceRole: experienceEvidenceMap.get(normalizeTerm(kw.term))?.role,
            sourceCompany: experienceEvidenceMap.get(normalizeTerm(kw.term))?.company,
            sourceEvidence: experienceEvidenceMap.get(normalizeTerm(kw.term))?.text,
          } : {}),
        });
        continue;
      }

      // W przeciwnym razie sugeruj dodanie do podsumowania zawodowego lub sekcji skills
      suggestions.push({
        id: `sug_sum_${kw.id}`,
        keyword: kw.term,
        category: kw.category,
        type: 'ADD_TO_CV_SUMMARY',
        message: `Dodaj „${kw.term}” do sekcji umiejętności w CV — masz ten skill w SkillsMatrix, ale nie został dopasowany do oferty.`,
        targetType: 'summary',
      });
    } else if (kw.status === 'MISSING_IN_VAULT' && kw.importance === 'CRITICAL') {
      suggestions.push({
        id: `sug_missing_${kw.id}`,
        keyword: kw.term,
        category: kw.category,
        type: 'ADD_TO_VAULT_SKILLS',
        message: `Oferta wymaga kluczowej kompetencji „${kw.term}”. Jeśli posiadasz to doświadczenie, uzupełnij je w MasterVault.`,
        targetType: 'skills',
      });
    }
  }

  // 5. Statystyki i Heatmap Coverage per kategoria
  const categories: KeywordCategory[] = ['HARD_SKILL', 'TOOL', 'SOFT_SKILL', 'LICENSE'];
  const categoryLabels: Record<KeywordCategory, string> = {
    HARD_SKILL: 'Umiejętności twarde',
    TOOL: 'Narzędzia i technologie',
    SOFT_SKILL: 'Kompetencje miękkie',
    LICENSE: 'Uprawnienia i certyfikaty',
  };

  const categoryCoverage: Record<KeywordCategory, CategoryCoverage> = {} as any;

  for (const cat of categories) {
    const catKws = keywords.filter((k) => k.category === cat);
    const total = catKws.length;
    const matchedInCv = catKws.filter((k) => k.status === 'MATCHED_IN_CV').length;
    const inVaultOnly = catKws.filter((k) => k.status === 'IN_VAULT_NOT_IN_CV').length;
    const missingInVault = catKws.filter((k) => k.status === 'MISSING_IN_VAULT').length;

    categoryCoverage[cat] = {
      category: cat,
      label: categoryLabels[cat],
      total,
      matchedInCv,
      inVaultOnly,
      missingInVault,
      cvPercentage: total > 0 ? Math.round((matchedInCv / total) * 100) : 100,
      vaultPercentage: total > 0 ? Math.round(((matchedInCv + inVaultOnly) / total) * 100) : 100,
    };
  }

  const totalKeywords = keywords.length || 1;
  const matchedInCvTotal = keywords.filter((k) => k.status === 'MATCHED_IN_CV').length;
  const inVaultNotCvTotal = keywords.filter((k) => k.status === 'IN_VAULT_NOT_IN_CV').length;
  const missingInVaultTotal = keywords.filter((k) => k.status === 'MISSING_IN_VAULT').length;

  const overallCvScore = Math.min(100, Math.round((matchedInCvTotal / totalKeywords) * 100));

  return {
    keywords,
    overallCvScore,
    categoryCoverage,
    suggestions,
    counts: {
      total: keywords.length,
      matchedInCv: matchedInCvTotal,
      inVaultNotCv: inVaultNotCvTotal,
      missingInVault: missingInVaultTotal,
    },
  };
}

function createEmptyMappingResult(): JdKeywordMappingResult {
  const emptyCat = (cat: KeywordCategory, label: string): CategoryCoverage => ({
    category: cat,
    label,
    total: 0,
    matchedInCv: 0,
    inVaultOnly: 0,
    missingInVault: 0,
    cvPercentage: 0,
    vaultPercentage: 0,
  });

  return {
    keywords: [],
    overallCvScore: 0,
    categoryCoverage: {
      HARD_SKILL: emptyCat('HARD_SKILL', 'Umiejętności twarde'),
      TOOL: emptyCat('TOOL', 'Narzędzia i technologie'),
      SOFT_SKILL: emptyCat('SOFT_SKILL', 'Kompetencje miękkie'),
      LICENSE: emptyCat('LICENSE', 'Uprawnienia i certyfikaty'),
    },
    suggestions: [],
    counts: {
      total: 0,
      matchedInCv: 0,
      inVaultNotCv: 0,
      missingInVault: 0,
    },
  };
}
