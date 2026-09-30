import { MasterVault } from '../../types';
import { stripSensitiveFields, identifyingValues, pseudonymize, assertNoPii } from '../pseudonymize';
import { generateWithUsage, truncateForModel, parseModelJson } from '../geminiClient';
import { loadConfig } from '../config';
import { hasMeasurableMetric } from '../../lib/consistencyGuard/timelineAuditor';
import { z } from 'zod';

const verificationReportSchema = z.object({
  overallScore: z.number().finite().min(0).max(100),
  verdict: z.enum(['READY_TO_APPLY', 'MINOR_IMPROVEMENTS', 'CRITICAL_FIXES_NEEDED']),
  summary: z.string().min(1),
  atsLoop: z.object({
    atsScore: z.number().finite().min(0).max(100),
    parsedRole: z.string(),
    recognizedKeywords: z.array(z.string()),
    missingCriticalKeywords: z.array(z.string()),
    atsFormatRisks: z.array(z.object({
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      issue: z.string(),
      fix: z.string(),
    })),
  }),
  recruiterLoop: z.object({
    recruiterScore: z.number().finite().min(0).max(100),
    headlineClarity: z.enum(['POOR', 'AVERAGE', 'EXCELLENT']),
    strengthsFound: z.array(z.string()),
    weaknessesOrFluff: z.array(z.string()),
  }),
  logicComplianceLoop: z.object({
    consistencyScore: z.number().finite().min(0).max(100),
    chronologyValid: z.boolean(),
    timelineAnomalies: z.array(z.string()),
    logicalInconsistencies: z.array(z.string()),
    privacyRisks: z.array(z.string()),
  }),
  actionableRecommendations: z.array(z.object({
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    category: z.enum(['ATS', 'RECRUITER', 'LOGIC', 'COMPLIANCE']),
    title: z.string().min(1),
    description: z.string(),
    suggestedFix: z.string().optional(),
  })),
});

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
  achievementMetricRatePct: number | null; // wyliczone lokalnie; null bez punktów doświadczenia
}

export interface VerificationLogicComplianceLoop {
  consistencyScore: number; // subiektywna ocena modelu, nie ocena prawna
  chronologyValid: boolean;
  timelineAnomalies: string[]; // np. luki w zatrudnieniu, nakładające się daty
  logicalInconsistencies: string[]; // sprzeczne deklaracje
  rodoCompliant: null; // tekst klauzuli nie jest wejściem tej analizy
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
 * Pętla 3: Logic & Consistency (chronologia i spójność danych profilu).
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
    targetRole: targetRole?.trim() || safeVault.personalInfo?.title?.trim() || 'nie podano',
    targetCompany: targetCompany?.trim() || 'nie podano',
    summary: summary.text,
    skills: skillsList,
    certifications: certsList,
    history: history.text,
    projects: projects.text,
    education: safeVault.education || [],
    licenses: safeVault.profiler?.licenses || [],
    languages: safeVault.profiler?.languages || [],
  };

  // To jest licznik z treści profilu, nie ocena modelu. Przy braku punktów
  // pokazujemy brak danych zamiast fikcyjnego 0%.
  const achievementPoints = (safeVault.history || [])
    .flatMap((experience) => experience.highlights || [])
    .filter((point) => Boolean(point.text?.trim() || point.metric?.trim()));
  const achievementMetricRatePct = achievementPoints.length === 0
    ? null
    : Math.round(
      (achievementPoints.filter((point) => hasMeasurableMetric(point.text, point.metric)).length /
        achievementPoints.length) * 100
    );

  const jdSnippet = jobDescription?.trim()
    ? truncateForModel(jobDescription, 12_000)
    : 'Nie podano treści ogłoszenia. Nie wyciągaj wniosków o dopasowaniu do konkretnej oferty.';

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
  },
  "logicComplianceLoop": {
    "consistencyScore": number (subiektywna ocena modelu, 0-100),
    "chronologyValid": boolean,
    "timelineAnomalies": string[],
    "logicalInconsistencies": string[],
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

  const candidateReport = parseModelJson<unknown>(response.text, 'verify-cv-triple-loop');
  const validation = verificationReportSchema.safeParse(candidateReport);
  if (!validation.success) {
    // Brak oceny lub flagi zgodności nie oznacza wyniku neutralnego ani pozytywnego.
    // Odrzucamy niekompletną odpowiedź zamiast maskować błąd modelu stałymi.
    throw Object.assign(new Error('Model zwrócił niekompletny lub nieprawidłowy raport weryfikacji CV.'), {
      status: 502,
      expose: true,
    });
  }
  const parsed = validation.data;

  // Zera są prawidłową wartością. Nie używamy `||` ani domyślnych ocen,
  // bo brak wyniku został już odrzucony przez walidator schematu.
  const normalizedOverall = parsed.overallScore;
  const normalizedAts = parsed.atsLoop.atsScore;
  const normalizedRecruiter = parsed.recruiterLoop.recruiterScore;
  const normalizedConsistency = parsed.logicComplianceLoop.consistencyScore;

  return {
    overallScore: normalizedOverall,
    // Jedna reguła progów utrzymuje werdykt zgodny z wynikiem liczbowym.
    verdict: normalizedOverall >= 85 ? 'READY_TO_APPLY' : normalizedOverall >= 60 ? 'MINOR_IMPROVEMENTS' : 'CRITICAL_FIXES_NEEDED',
    summary: parsed.summary,
    atsLoop: {
      atsScore: normalizedAts,
      parsedRole: parsed.atsLoop.parsedRole,
      recognizedKeywords: parsed.atsLoop.recognizedKeywords,
      missingCriticalKeywords: parsed.atsLoop.missingCriticalKeywords,
      atsFormatRisks: parsed.atsLoop.atsFormatRisks,
    },
    recruiterLoop: {
      recruiterScore: normalizedRecruiter,
      headlineClarity: parsed.recruiterLoop.headlineClarity,
      strengthsFound: parsed.recruiterLoop.strengthsFound,
      weaknessesOrFluff: parsed.recruiterLoop.weaknessesOrFluff,
      achievementMetricRatePct,
    },
    logicComplianceLoop: {
      consistencyScore: normalizedConsistency,
      chronologyValid: parsed.logicComplianceLoop.chronologyValid,
      timelineAnomalies: parsed.logicComplianceLoop.timelineAnomalies,
      logicalInconsistencies: parsed.logicComplianceLoop.logicalInconsistencies,
      // MasterVault nie zawiera tekstu klauzuli, więc model nie może ocenić jej
      // zgodności prawnej na podstawie samego profilu.
      rodoCompliant: null,
      privacyRisks: parsed.logicComplianceLoop.privacyRisks,
    },
    actionableRecommendations: parsed.actionableRecommendations,
  };
}
