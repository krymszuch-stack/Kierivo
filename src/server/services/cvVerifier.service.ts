import { MasterVault } from '../../types';
import { stripSensitiveFields, identifyingValues, pseudonymize, assertNoPii } from '../pseudonymize';
import { generateWithUsage, truncateForModel, parseModelJson } from '../geminiClient';
import { loadConfig } from '../config';

export interface VerifyCvOptions {
  vault: MasterVault;
  targetRole?: string;
  targetCompany?: string;
  jobDescription?: string;
}

export interface VerificationAtsLoop {
  atsScore: number; // 0-100
  parsedRole: string;
  recognizedKeywords: string[];
  missingCriticalKeywords: string[];
  atsFormatRisks: Array<{
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    issue: string;
    fix: string;
  }>;
}

export interface VerificationRecruiterLoop {
  recruiterScore: number; // 0-100
  headlineClarity: 'POOR' | 'AVERAGE' | 'EXCELLENT';
  strengthsFound: string[];
  weaknessesOrFluff: string[]; // wykryte ogólniki bez metryk
  achievementMetricRatePct: number; // % punktów z liczbami/%
}

export interface VerificationLogicComplianceLoop {
  complianceScore: number; // 0-100
  chronologyValid: boolean;
  timelineAnomalies: string[]; // np. luki w zatrudnieniu, nakładające się daty
  logicalInconsistencies: string[]; // sprzeczne deklaracje
  rodoCompliant: boolean;
  privacyRisks: string[];
}

export interface CvVerificationReport {
  overallScore: number; // 0-100
  verdict: 'READY_TO_APPLY' | 'MINOR_IMPROVEMENTS' | 'CRITICAL_FIXES_NEEDED';
  summary: string;
  atsLoop: VerificationAtsLoop;
  recruiterLoop: VerificationRecruiterLoop;
  logicComplianceLoop: VerificationLogicComplianceLoop;
  actionableRecommendations: Array<{
    priority: 1 | 2 | 3;
    category: 'ATS' | 'RECRUITER' | 'LOGIC' | 'COMPLIANCE';
    title: string;
    description: string;
    suggestedFix?: string;
  }>;
}

/**
 * Weryfikator CV 360° z Potrójną Pętlą Sprawdzającą (Triple-Loop AI Verification Gate).
 *
 * Pętla 1: ATS Parser Gate (symulacja ekstrakcji słów kluczowych i podatności formatowania).
 * Pętla 2: Recruiter Eye (6-sekundowy skan, siła nagłówka, gęstość metryk liczbowych vs ogólniki).
 * Pętla 3: Logic & Compliance (spójność chronologii dat, brak sprzeczności, weryfikacja RODO).
 */
export async function verifyCvWithTripleLoop(options: VerifyCvOptions): Promise<CvVerificationReport> {
  const { vault, targetRole = '', targetCompany = '', jobDescription = '' } = options;

  // 1. Ochrona danych osobowych i zgodność z RODO (Zero-Leakage)
  const safeVault = stripSensitiveFields(vault);
  const names = identifyingValues(vault);

  const history = pseudonymize(
    truncateForModel(JSON.stringify(safeVault.history || []), 18_000),
    names
  );
  const projects = pseudonymize(
    truncateForModel(JSON.stringify(safeVault.projects || []), 6_000),
    names
  );
  const summary = pseudonymize(safeVault.personalInfo?.summary || '', names);

  const skillsList = [
    ...(safeVault.skillsMatrix?.hardSkills || []),
    ...(safeVault.skillsMatrix?.toolsAndTech || []),
    ...(safeVault.skillsMatrix?.softSkills || []),
  ].filter(Boolean);

  const certsList = (safeVault.skillsMatrix?.certifications || [])
    .map((c) => c.name)
    .filter(Boolean);

  const candidatePayload = {
    targetRole: targetRole || safeVault.personalInfo?.title || 'Specjalista',
    targetCompany: targetCompany || 'Firma Rekrutująca',
    summary: summary.text,
    skills: skillsList,
    certifications: certsList,
    history: history.text,
    projects: projects.text,
    education: safeVault.education || [],
    licenses: safeVault.profiler?.licenses || [],
    languages: safeVault.profiler?.languages || [],
  };

  const jdSnippet = jobDescription ? truncateForModel(jobDescription, 12_000) : 'Brak dedykowanego ogłoszenia (audyt profilu uniwersalnego)';

  const prompt = `
Jesteś bezlitosnym, wielopoziomowym audytorem rekrutacyjnym CV pracującym dla nowoczesnych systemów ATS i czołowych agencji headhunterskich w 2026 roku.
Twoim celem jest przeprowadzenie precyzyjnego audytu POTRÓJNEJ PĘTLI dla poniższego kandydata.

DANE KANDYDATA (spseudonimizowane):
${JSON.stringify(candidatePayload, null, 2)}

KONTEKST OFERTY PRACY:
${jdSnippet}

Wykonaj audyt w trzech niezależnych pętlach i zwróć czysty JSON zgodny z poniższym schematem:
{
  "overallScore": number (0-100),
  "verdict": "READY_TO_APPLY" | "MINOR_IMPROVEMENTS" | "CRITICAL_FIXES_NEEDED",
  "summary": string (syntetyczna ocena 2-3 zdania),
  "atsLoop": {
    "atsScore": number (0-100),
    "parsedRole": string,
    "recognizedKeywords": string[],
    "missingCriticalKeywords": string[],
    "atsFormatRisks": [
      { "severity": "LOW" | "MEDIUM" | "HIGH", "issue": string, "fix": string }
    ]
  },
  "recruiterLoop": {
    "recruiterScore": number (0-100),
    "headlineClarity": "POOR" | "AVERAGE" | "EXCELLENT",
    "strengthsFound": string[],
    "weaknessesOrFluff": string[],
    "achievementMetricRatePct": number (szacowany % punktów zawierających wymierne liczby/metryki/%)
  },
  "logicComplianceLoop": {
    "complianceScore": number (0-100),
    "chronologyValid": boolean,
    "timelineAnomalies": string[],
    "logicalInconsistencies": string[],
    "rodoCompliant": boolean,
    "privacyRisks": string[]
  },
  "actionableRecommendations": [
    {
      "priority": 1 | 2 | 3,
      "category": "ATS" | "RECRUITER" | "LOGIC" | "COMPLIANCE",
      "title": string,
      "description": string,
      "suggestedFix": string
    }
  ]
}

Kluczowe kryteria oceny:
1. PĘTLA ATS: Czy słowa kluczowe (hard skills, narzędzia, uprawnienia SEP/UDT/certyfikaty) odpowiadają roli? Czy nie ma ukrytych braków semantycznych?
2. PĘTLA REKRUTERA: Czy pierwsze 6 sekund przyciąga uwagę? Czy punkty doświadczenia są w formule wyników (Rezultat -> Działanie -> Skala), czy zawierają puste zwroty ("odpowiedzialny za...")?
3. PĘTLA LOGIKI I SPÓJNOŚCI: Czy daty zatrudnienia tworzą logiczny ciąg bez sprzecznych nakładek czasowych? Czy poziom deklarowanych kompetencji zgadza się ze stażem pracy?
Odpowiedz WYŁĄCZNIE poprawnym obiektem JSON.
`.trim();

  // Weryfikacja braku PII przed wysłaniem
  assertNoPii(prompt);

  const config = loadConfig();
  // Używamy gpt-4o dla najwyższej jakości weryfikacji audytorskiej, z fallbackiem na domyślny deployment
  const modelToUse = config.AI_PROVIDER === 'azure_openai'
    ? (process.env.AZURE_OPENAI_VERIFIER_DEPLOYMENT || config.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o')
    : config.OLLAMA_MODEL;

  const response = await generateWithUsage(
    {
      model: modelToUse,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
      },
    },
    'verify-cv-triple-loop'
  );

  const parsed = parseModelJson<CvVerificationReport>(response.text, 'verify-cv-triple-loop');

  // Walidacja i normalizacja wyniku
  const normalizedOverall = Math.min(Math.max(Number(parsed.overallScore) || 70, 0), 100);
  const normalizedAts = Math.min(Math.max(Number(parsed.atsLoop?.atsScore) || 70, 0), 100);
  const normalizedRecruiter = Math.min(Math.max(Number(parsed.recruiterLoop?.recruiterScore) || 70, 0), 100);
  const normalizedCompliance = Math.min(Math.max(Number(parsed.logicComplianceLoop?.complianceScore) || 85, 0), 100);

  return {
    overallScore: normalizedOverall,
    verdict: parsed.verdict || (normalizedOverall >= 85 ? 'READY_TO_APPLY' : normalizedOverall >= 60 ? 'MINOR_IMPROVEMENTS' : 'CRITICAL_FIXES_NEEDED'),
    summary: parsed.summary || 'Audyt profilu zakończony.',
    atsLoop: {
      atsScore: normalizedAts,
      parsedRole: parsed.atsLoop?.parsedRole || candidatePayload.targetRole,
      recognizedKeywords: Array.isArray(parsed.atsLoop?.recognizedKeywords) ? parsed.atsLoop.recognizedKeywords : [],
      missingCriticalKeywords: Array.isArray(parsed.atsLoop?.missingCriticalKeywords) ? parsed.atsLoop.missingCriticalKeywords : [],
      atsFormatRisks: Array.isArray(parsed.atsLoop?.atsFormatRisks) ? parsed.atsLoop.atsFormatRisks : [],
    },
    recruiterLoop: {
      recruiterScore: normalizedRecruiter,
      headlineClarity: parsed.recruiterLoop?.headlineClarity || 'AVERAGE',
      strengthsFound: Array.isArray(parsed.recruiterLoop?.strengthsFound) ? parsed.recruiterLoop.strengthsFound : [],
      weaknessesOrFluff: Array.isArray(parsed.recruiterLoop?.weaknessesOrFluff) ? parsed.recruiterLoop.weaknessesOrFluff : [],
      achievementMetricRatePct: Number(parsed.recruiterLoop?.achievementMetricRatePct) || 50,
    },
    logicComplianceLoop: {
      complianceScore: normalizedCompliance,
      chronologyValid: parsed.logicComplianceLoop?.chronologyValid ?? true,
      timelineAnomalies: Array.isArray(parsed.logicComplianceLoop?.timelineAnomalies) ? parsed.logicComplianceLoop.timelineAnomalies : [],
      logicalInconsistencies: Array.isArray(parsed.logicComplianceLoop?.logicalInconsistencies) ? parsed.logicComplianceLoop.logicalInconsistencies : [],
      rodoCompliant: parsed.logicComplianceLoop?.rodoCompliant ?? true,
      privacyRisks: Array.isArray(parsed.logicComplianceLoop?.privacyRisks) ? parsed.logicComplianceLoop.privacyRisks : [],
    },
    actionableRecommendations: Array.isArray(parsed.actionableRecommendations) ? parsed.actionableRecommendations : [],
  };
}
