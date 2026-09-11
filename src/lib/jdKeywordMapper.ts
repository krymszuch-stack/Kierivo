import { MasterVault, TailoredResume } from '../types';
import { HR_AND_COMMON_STOP_WORDS, extractDynamicJdPhrases } from './atsSimulator';
import { countPhraseOccurrences } from './skillEvidence';
import { auditKnockouts } from './knockouts';

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
  impactScore: number;
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
  overallVaultScore: number;
  categoryCoverage: Record<KeywordCategory, CategoryCoverage>;
  suggestions: KeywordSuggestion[];
  counts: {
    total: number;
    matchedInCv: number;
    inVaultNotCv: number;
    missingInVault: number;
  };
}

/**
 * Znane technologie i narzędzia (w tym branże fizyczne/techniczne zgodnie z regułą 8)
 */
const TECH_AND_TOOLS_DICTIONARY: Array<{ name: string; category: KeywordCategory }> = [
  // IT & Software
  { name: 'TypeScript', category: 'HARD_SKILL' },
  { name: 'JavaScript', category: 'HARD_SKILL' },
  { name: 'React', category: 'HARD_SKILL' },
  { name: 'Node.js', category: 'HARD_SKILL' },
  { name: 'Python', category: 'HARD_SKILL' },
  { name: 'Java', category: 'HARD_SKILL' },
  { name: 'C#', category: 'HARD_SKILL' },
  { name: '.NET', category: 'HARD_SKILL' },
  { name: 'PostgreSQL', category: 'HARD_SKILL' },
  { name: 'SQL', category: 'HARD_SKILL' },
  { name: 'MySQL', category: 'HARD_SKILL' },
  { name: 'MongoDB', category: 'HARD_SKILL' },
  { name: 'Redis', category: 'TOOL' },
  { name: 'Docker', category: 'TOOL' },
  { name: 'Kubernetes', category: 'TOOL' },
  { name: 'AWS', category: 'TOOL' },
  { name: 'GCP', category: 'TOOL' },
  { name: 'Azure', category: 'TOOL' },
  { name: 'Kafka', category: 'TOOL' },
  { name: 'Elasticsearch', category: 'TOOL' },
  { name: 'Git', category: 'TOOL' },
  { name: 'Jira', category: 'TOOL' },
  { name: 'Terraform', category: 'TOOL' },
  { name: 'GraphQL', category: 'HARD_SKILL' },
  { name: 'REST API', category: 'HARD_SKILL' },
  { name: 'Next.js', category: 'HARD_SKILL' },
  { name: 'TailwindCSS', category: 'TOOL' },
  { name: 'Linux', category: 'TOOL' },
  { name: 'CI/CD', category: 'TOOL' },
  { name: 'Vitest', category: 'TOOL' },
  { name: 'Jest', category: 'TOOL' },

  // Branże fizyczne, techniczne i uprawnienia (Reguła 8)
  { name: 'SEP G1', category: 'LICENSE' },
  { name: 'SEP G2', category: 'LICENSE' },
  { name: 'SEP G3', category: 'LICENSE' },
  { name: 'UDT wózki', category: 'LICENSE' },
  { name: 'UDT suwnice', category: 'LICENSE' },
  { name: 'F-Gaz', category: 'LICENSE' },
  { name: 'Spawanie TIG', category: 'HARD_SKILL' },
  { name: 'Spawanie MIG/MAG', category: 'HARD_SKILL' },
  { name: 'Spawanie MMA', category: 'HARD_SKILL' },
  { name: 'Prawo Jazdy Kat. B', category: 'LICENSE' },
  { name: 'Prawo Jazdy Kat. C', category: 'LICENSE' },
  { name: 'Prawo Jazdy Kat. C+E', category: 'LICENSE' },
  { name: 'HACCP', category: 'HARD_SKILL' },
  { name: 'BHP', category: 'HARD_SKILL' },
  { name: '5S', category: 'TOOL' },
  { name: 'Kaizen', category: 'TOOL' },
  { name: 'WMS', category: 'TOOL' },
  { name: 'Utrzymanie Ruchu', category: 'HARD_SKILL' },
  { name: 'Praca na wysokości', category: 'LICENSE' },
];

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

  // 1. Zbuduj mapę lokalizacji faktów w MasterVault
  const vaultLocationsMap = new Map<string, string[]>();

  const registerVaultTerm = (term: string, location: string) => {
    const norm = normalizeTerm(term);
    if (!norm) return;
    const list = vaultLocationsMap.get(norm) || [];
    if (!list.includes(location)) {
      list.push(location);
    }
    vaultLocationsMap.set(norm, list);
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
    p.techStack?.forEach((t) => registerVaultTerm(t, loc));
    if (p.description) {
      TECH_AND_TOOLS_DICTIONARY.forEach((dict) => {
        if (countOccurrences(p.description, dict.name) > 0) {
          registerVaultTerm(dict.name, loc);
        }
      });
    }
  });

  // Zarejestruj historię zatrudnienia w MasterVault
  vault.history?.forEach((h) => {
    const loc = `Doświadczenie: ${h.company} (${h.role})`;
    h.highlights?.forEach((hl) => {
      hl.keywords?.forEach((k) => registerVaultTerm(k, loc));
      TECH_AND_TOOLS_DICTIONARY.forEach((dict) => {
        if (countOccurrences(hl.text, dict.name) > 0) {
          registerVaultTerm(dict.name, loc);
        }
      });
    });
  });

  // 2. Zbuduj mapę lokalizacji słów w bieżącym CV (TailoredResume lub wybrane highlights)
  const cvLocationsMap = new Map<string, string[]>();

  const registerCvTerm = (term: string, location: string) => {
    const norm = normalizeTerm(term);
    if (!norm) return;
    const list = cvLocationsMap.get(norm) || [];
    if (!list.includes(location)) {
      list.push(location);
    }
    cvLocationsMap.set(norm, list);
  };

  if (tailoredResume) {
    tailoredResume.skillsMatched?.hardSkills?.forEach((s) => registerCvTerm(s, 'CV: Kluczowe umiejętności'));
    tailoredResume.skillsMatched?.toolsAndTech?.forEach((t) => registerCvTerm(t, 'CV: Narzędzia'));
    tailoredResume.skillsMatched?.softSkills?.forEach((s) => registerCvTerm(s, 'CV: Kompetencje miękkie'));
    if (tailoredResume.summary) {
      TECH_AND_TOOLS_DICTIONARY.forEach((dict) => {
        if (countOccurrences(tailoredResume.summary, dict.name) > 0) {
          registerCvTerm(dict.name, 'CV: Podsumowanie zawodowe');
        }
      });
    }
    tailoredResume.selectedHighlights?.forEach((sh) => {
      sh.keywordsMatched?.forEach((k) => registerCvTerm(k, `CV: ${sh.company} (${sh.role})`));
      TECH_AND_TOOLS_DICTIONARY.forEach((dict) => {
        if (countOccurrences(sh.optimizedText || sh.originalText, dict.name) > 0) {
          registerCvTerm(dict.name, `CV: ${sh.company} (${sh.role})`);
        }
      });
    });
  } else {
    // Gdy brak tailoredResume, sprawdzamy pozycje w głównym CV
    if (vault.personalInfo?.summary) {
      TECH_AND_TOOLS_DICTIONARY.forEach((dict) => {
        if (countOccurrences(vault.personalInfo.summary, dict.name) > 0) {
          registerCvTerm(dict.name, 'CV: Podsumowanie');
        }
      });
    }
    vault.history?.forEach((h) => {
      h.highlights?.forEach((hl) => {
        hl.keywords?.forEach((k) => registerCvTerm(k, `CV: ${h.company}`));
      });
    });
  }

  // 3. Ekstrakcja słów kluczowych z tekstu ogłoszenia (JD)
  const extractedKeywordsMap = new Map<string, ExtractedKeyword>();

  // A. Ekstrakcja ze słownika technologii i uprawnień
  for (const item of TECH_AND_TOOLS_DICTIONARY) {
    const occurrences = countOccurrences(jdText, item.name);
    if (occurrences > 0) {
      const norm = normalizeTerm(item.name);
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
        term: item.name,
        category: item.category,
        occurrencesInJd: occurrences,
        status,
        foundInVaultLocations: vaultLocs,
        foundInCvLocations: cvLocs,
        importance: occurrences >= 3 ? 'CRITICAL' : occurrences >= 2 ? 'IMPORTANT' : 'NICE_TO_HAVE',
      });
    }
  }

  // B. Ekstrakcja ze słownika kompetencji miękkich
  for (const soft of SOFT_SKILLS_DICTIONARY) {
    const occurrences = countOccurrences(jdText, soft);
    if (occurrences > 0) {
      const norm = normalizeTerm(soft);
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
        term: soft,
        category: 'SOFT_SKILL',
        occurrencesInJd: occurrences,
        status,
        foundInVaultLocations: vaultLocs,
        foundInCvLocations: cvLocs,
        importance: occurrences >= 2 ? 'IMPORTANT' : 'NICE_TO_HAVE',
      });
    }
  }

  // C. Dynamiczna ekstrakcja NLP (frazy wielowyrazowe i rzadkie technologie)
  const dynamicNlp = extractDynamicJdPhrases(jdText);
  dynamicNlp.hardSkills.forEach((hs) => {
    const norm = normalizeTerm(hs.phrase);
    if (!extractedKeywordsMap.has(norm) && !HR_AND_COMMON_STOP_WORDS.has(norm)) {
      const vaultLocs = vaultLocationsMap.get(norm) || [];
      const cvLocs = cvLocationsMap.get(norm) || [];
      let status: KeywordMatchStatus = 'MISSING_IN_VAULT';
      if (cvLocs.length > 0) status = 'MATCHED_IN_CV';
      else if (vaultLocs.length > 0) status = 'IN_VAULT_NOT_IN_CV';

      extractedKeywordsMap.set(norm, {
        id: `kw_${norm}`,
        term: hs.phrase,
        category: 'HARD_SKILL',
        occurrencesInJd: 1,
        status,
        foundInVaultLocations: vaultLocs,
        foundInCvLocations: cvLocs,
        importance: 'IMPORTANT',
      });
    }
  });

  // D. Weryfikacja kryteriów formalnych i knock-outów (SEP, UDT, Prawo Jazdy)
  const knockoutReport = auditKnockouts(jdText, vault);
  knockoutReport.findings.forEach((finding) => {
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
      });
    }
  });

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
          impactScore: kw.importance === 'CRITICAL' ? 12 : 8,
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
          impactScore: kw.importance === 'CRITICAL' ? 10 : 7,
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
        impactScore: 6,
      });
    } else if (kw.status === 'MISSING_IN_VAULT' && kw.importance === 'CRITICAL') {
      suggestions.push({
        id: `sug_missing_${kw.id}`,
        keyword: kw.term,
        category: kw.category,
        type: 'ADD_TO_VAULT_SKILLS',
        message: `Oferta wymaga kluczowej kompetencji „${kw.term}”. Jeśli posiadasz to doświadczenie, uzupełnij je w MasterVault.`,
        targetType: 'skills',
        impactScore: 15,
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
  const overallVaultScore = Math.min(
    100,
    Math.round(((matchedInCvTotal + inVaultNotCvTotal) / totalKeywords) * 100)
  );

  return {
    keywords,
    overallCvScore,
    overallVaultScore,
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
    overallVaultScore: 0,
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
