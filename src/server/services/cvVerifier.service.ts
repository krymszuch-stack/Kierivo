import { MasterVault } from '../../types';
import { stripSensitiveFields, identifyingValues, pseudonymize, preparePromptForModel } from '../pseudonymize';
import { generateWithUsage, truncateForModel, parseModelJson } from '../geminiClient';
import { loadConfig } from '../config';
import { hasMeasurableMetric } from '../../lib/consistencyGuard/timelineAuditor';
import { hasSufficientCvContent, INSUFFICIENT_CV_CONTENT_MESSAGE } from '../../lib/canonicalAts';
import { z } from 'zod';
import { hasNoReportedChronologyAnomalies, recommendationsForOffer } from '../../lib/cvVerificationFindings';

const verificationReportSchema = z.object({
  overallScore: z.number().finite().min(0).max(100).nullable(),
  verdict: z.enum(['READY_TO_APPLY', 'MINOR_IMPROVEMENTS', 'CRITICAL_FIXES_NEEDED']).nullable(),
  summary: z.string().min(1),
  atsLoop: z.object({
    atsScore: z.number().finite().min(0).max(100).nullable(),
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
  atsScore: number | null; // null bez treści oferty
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
  hasJobDescription: boolean;
  overallScore: number | null; // null, gdy brakuje wejscia do jednej z trzech petli
  verdict: 'READY_TO_APPLY' | 'MINOR_IMPROVEMENTS' | 'CRITICAL_FIXES_NEEDED' | null;
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
 * Jedna odpowiedź AI z opinią o trzech obszarach danych strukturalnych profilu.
 *
 * Obszar 1: porównanie deklaracji z wymaganiami oferty.
 * Obszar 2: czytelność treści i lokalny licznik punktów z metrykami.
 * Obszar 3: możliwe sprzeczności w chronologii i deklaracjach.
 */
export async function verifyCvWithTripleLoop(options: VerifyCvOptions): Promise<CvVerificationReport> {
  const { vault, targetRole = '', targetCompany = '', jobDescription = '' } = options;

  if (!hasSufficientCvContent(vault)) {
    throw Object.assign(new Error(INSUFFICIENT_CV_CONTENT_MESSAGE), {
      status: 422,
      expose: true,
    });
  }

  // Usuwamy część pól identyfikujących i pseudonimizujemy wykryte dane; to nie gwarantuje pełnej anonimizacji.
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
Analizujesz dane strukturalne profilu kandydata i opcjonalny kontekst oferty.
Oceny są opinią modelu i wymagają weryfikacji przez użytkownika. Nie potwierdzaj prawdziwości deklaracji ani zgodności prawnej.

DANE KANDYDATA (spseudonimizowane):
${JSON.stringify(candidatePayload, null, 2)}

KONTEKST OFERTY PRACY:
${jdSnippet}

Przygotuj jeden raport w trzech obszarach i zwróć czysty JSON zgodny z poniższym schematem:
{
  "overallScore": number (0-100) lub null bez kompletu petli,
  "verdict": "READY_TO_APPLY" | "MINOR_IMPROVEMENTS" | "CRITICAL_FIXES_NEEDED" lub null bez oferty,
  "summary": string (syntetyczna ocena 2-3 zdania),
  "atsLoop": {
    "atsScore": number (0-100) lub null, gdy nie podano treści oferty,
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
2. PĘTLA REKRUTERA: Czy podany nagłówek jest czytelny? Nie zgaduj czasu ani reakcji rekrutera. Czy punkty doświadczenia są w formule wyników (Rezultat -> Działanie -> Skala), czy zawierają puste zwroty ("odpowiedzialny za...")?
3. PĘTLA LOGIKI I SPÓJNOŚCI: Czy daty zatrudnienia tworzą logiczny ciąg bez sprzecznych nakładek czasowych? Czy poziom deklarowanych kompetencji zgadza się ze stażem pracy?
Nie otrzymujesz PDF-a ani tekstu wyrenderowanego CV — masz wyłącznie dane strukturalne profilu. Zwróć atsFormatRisks jako pustą tablicę; nie zgaduj układu, parserowalności pliku ani zachowania konkretnego ATS.
Jeśli nie podano treści oferty, zwróć atsScore=null oraz puste recognizedKeywords i missingCriticalKeywords. Nie oceniaj dopasowania do oferty.
Bez treści oferty nie zwracaj rekomendacji kategorii ATS. Jeśli wskazujesz timelineAnomalies, ustaw chronologyValid=false. Luki i równoległe zatrudnienie same w sobie nie dowodzą błędu; wyjaśnij wątpliwości jako wymagające sprawdzenia.
Odpowiedz WYŁĄCZNIE poprawnym obiektem JSON.
`.trim();

  // Końcowa kontrola i pseudonimizacja wykrytych danych przed wysłaniem
  const safePrompt = preparePromptForModel(prompt, names);

  const config = loadConfig();
  // Deployment weryfikatora może nadpisać deployment domyślny; nie zmienia to zakresu analizy.
  const modelToUse = config.AI_PROVIDER === 'azure_openai'
    ? (process.env.AZURE_OPENAI_VERIFIER_DEPLOYMENT || config.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o')
    : config.OLLAMA_MODEL;

  const response = await generateWithUsage(
    {
      model: modelToUse,
      contents: safePrompt.text,
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
  if (jobDescription.trim() && (parsed.atsLoop.atsScore === null || parsed.overallScore === null)) {
    throw Object.assign(new Error('Model zwrócił niekompletną ocenę dopasowania do podanej oferty.'), {
      status: 502,
      expose: true,
    });
  }

  // Zera są prawidłową wartością. Nie używamy `||` ani domyślnych ocen,
  // bo brak wyniku został już odrzucony przez walidator schematu.
  const normalizedOverall = jobDescription.trim() ? parsed.overallScore : null;
  const normalizedAts = parsed.atsLoop.atsScore;
  const normalizedRecruiter = parsed.recruiterLoop.recruiterScore;
  const normalizedConsistency = parsed.logicComplianceLoop.consistencyScore;

  return {
    hasJobDescription: Boolean(jobDescription.trim()),
    overallScore: normalizedOverall,
    // Jedna reguła progów utrzymuje werdykt zgodny z wynikiem liczbowym.
    verdict: normalizedOverall === null
      ? null
      : normalizedOverall >= 85 ? 'READY_TO_APPLY' : normalizedOverall >= 60 ? 'MINOR_IMPROVEMENTS' : 'CRITICAL_FIXES_NEEDED',
    summary: parsed.summary,
    atsLoop: {
      atsScore: jobDescription.trim() ? normalizedAts : null,
      parsedRole: jobDescription.trim() ? parsed.atsLoop.parsedRole : '',
      recognizedKeywords: jobDescription.trim() ? parsed.atsLoop.recognizedKeywords : [],
      missingCriticalKeywords: jobDescription.trim() ? parsed.atsLoop.missingCriticalKeywords : [],
      // Bez pliku lub surowego tekstu dokumentu nie da się ocenić jego formatowania.
      atsFormatRisks: [],
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
      chronologyValid: hasNoReportedChronologyAnomalies(parsed.logicComplianceLoop),
      timelineAnomalies: parsed.logicComplianceLoop.timelineAnomalies,
      logicalInconsistencies: parsed.logicComplianceLoop.logicalInconsistencies,
      // MasterVault nie zawiera tekstu klauzuli, więc model nie może ocenić jej
      // zgodności prawnej na podstawie samego profilu.
      rodoCompliant: null,
      privacyRisks: parsed.logicComplianceLoop.privacyRisks,
    },
    actionableRecommendations: recommendationsForOffer(parsed.actionableRecommendations, Boolean(jobDescription.trim())),
  };
}
