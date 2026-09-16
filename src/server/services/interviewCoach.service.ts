import { MasterVault } from '../../types';
import { stripSensitiveFields, identifyingValues, pseudonymize } from '../pseudonymize';
import { generateWithUsage, truncateForModel, parseModelJson } from '../geminiClient';
import { loadConfig } from '../config';

export interface GenerateQuestionsOptions {
  vault?: MasterVault;
  targetRole?: string;
  targetCompany?: string;
  jobDescription?: string;
}

export interface InterviewQuestionItem {
  id: string;
  category: 'behavioral' | 'situational' | 'competency';
  question: string;
  recruiterIntent: string;
  suggestedStarTips: string;
}

export interface EvaluateStarAnswerOptions {
  question: string;
  answer: string;
  targetRole?: string;
  vault?: MasterVault;
}

export interface StarComponentFeedback {
  score: number; // 1-10
  feedback: string;
}

export interface StarAnswerEvaluation {
  overallScore: number; // 1-10
  verdict: 'EXCELLENT' | 'SOLID' | 'NEEDS_REFINEMENT';
  starBreakdown: {
    situation: StarComponentFeedback;
    task: StarComponentFeedback;
    action: StarComponentFeedback;
    result: StarComponentFeedback;
  };
  strengths: string[];
  improvements: string[];
  exemplaryResponse: string;
}

/**
 * Generuje pytania rekrutacyjne (behawioralne, sytuacyjne, kompetencyjne)
 * dopasowane do profilu kandydata i stanowiska docelowego.
 */
export async function generateInterviewQuestionsWithAi(
  options: GenerateQuestionsOptions
): Promise<{ questions: InterviewQuestionItem[]; usage?: any }> {
  const { vault, targetRole, targetCompany, jobDescription } = options;

  let sanitizedHistory: string[] = [];
  let sanitizedSkills: string[] = [];

  if (vault) {
    const stripped = stripSensitiveFields(vault);
    const idVals = identifyingValues(vault);

    sanitizedHistory = (stripped.history || []).slice(0, 3).map((h) => {
      const highlights = (h.highlights || []).slice(0, 2).map((hl) => hl.text).join('; ');
      const raw = `${h.role} w ${h.company}: ${highlights}`;
      return pseudonymize(raw, idVals).text;
    });

    sanitizedSkills = [
      ...(stripped.skillsMatrix?.hardSkills || []).slice(0, 8),
      ...(stripped.skillsMatrix?.toolsAndTech || []).slice(0, 8),
    ];
  }

  const role = targetRole || vault?.personalInfo?.title || 'Specjalista';
  const company = targetCompany || 'Firma Rekrutująca';
  const jdContext = jobDescription ? truncateForModel(jobDescription, 2000) : 'Standardowe wymagania rynkowe';

  const systemPrompt = `Jesteś doświadczonym Dyrektorem Rekrutacji (Executive Recruiter) i Trenerem Rozmów Kwalifikacyjnych.
Twoim zadaniem jest ułożenie 4 celowanych, wymagających i realistycznych pytań rekrutacyjnych dla kandydata na stanowisko "${role}" w firmie "${company}".

Kategorie pytań:
1. "behavioral" - Oparte na trudnej sytuacji z przeszłości (np. awaria, konflikt, trudny klient, presja terminowa).
2. "situational" - Pytanie scenariuszowe ("Co byś zrobił, gdyby...").
3. "competency" - Weryfikacja głębi wiedzy, architektury lub doboru narzędzi.

Dla każdego pytania podaj:
- id: unikalny identyfikator, np. "q_1", "q_2", "q_3", "q_4"
- category: "behavioral" | "situational" | "competency"
- question: precyzyjnie sformułowane pytanie po polsku
- recruiterIntent: czego rekruter NAPRAWDĘ szuka w tym pytaniu (np. "Bada odporność na stres i umiejętność komunikacji kryzysowej")
- suggestedStarTips: zwięzła wskazówka, na czym skupić odpowiedź w strukturze STAR (Situation, Task, Action, Result)

ZWRÓĆ WYŁĄCZNIE CZYSTY JSON:
{
  "questions": [
    {
      "id": "q_1",
      "category": "behavioral",
      "question": "...",
      "recruiterIntent": "...",
      "suggestedStarTips": "..."
    }
  ]
}`;

  const userPrompt = `Stanowisko docelowe: ${role}
Firma: ${company}
Kluczowe kompetencje kandydata: ${sanitizedSkills.join(', ') || 'Brak danych'}
Dotychczasowe doświadczenie: ${sanitizedHistory.join(' | ') || 'Brak danych'}
Wycinek ogłoszenia o pracę:
${jdContext}`;

  const config = loadConfig();
  const modelToUse = config.AI_PROVIDER === 'azure_openai'
    ? (config.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o')
    : config.OLLAMA_MODEL;

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const response = await generateWithUsage(
    {
      model: modelToUse,
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
      },
    },
    'interviewCoach:generateQuestions'
  );

  const parsed = parseModelJson<{ questions: InterviewQuestionItem[] }>(
    response.text,
    'interviewCoach:generateQuestions'
  );

  return {
    questions: parsed.questions || [],
    usage: response.usageMetadata,
  };
}

/**
 * Ocenia wypowiedź kandydata na wybrane pytanie rekrutacyjne w schemacie STAR (Situation, Task, Action, Result).
 */
export async function evaluateStarAnswerWithAi(
  options: EvaluateStarAnswerOptions
): Promise<{ evaluation: StarAnswerEvaluation; usage?: any }> {
  const { question, answer, targetRole, vault } = options;

  if (!answer || answer.trim().length === 0) {
    throw new Error('Brak treści odpowiedzi do analizy.');
  }

  let sanitizedContext = '';
  if (vault) {
    const stripped = stripSensitiveFields(vault);
    const idVals = identifyingValues(vault);
    const rawContext = (stripped.history || [])
      .slice(0, 2)
      .map((h) => `${h.role} w ${h.company}`)
      .join(', ');
    sanitizedContext = `Doświadczenie z profilu kandydata: ${pseudonymize(rawContext, idVals).text}`;
  }

  const role = targetRole || vault?.personalInfo?.title || 'Specjalista';

  const systemPrompt = `Jesteś bezkompromisowym, ale wspierającym Trenerem Rozmów Kwalifikacyjnych.
Oceniasz odpowiedź kandydata na stanowisko "${role}" pod kątem techniki STAR:
- S (Situation): Czy tło sytuacji jest zwięzłe i jasne? (nie za długie, maks. 20% wypowiedzi).
- T (Task): Czy cel, wyzwanie i konkretna rola kandydata są precyzyjnie określone?
- A (Action): Czy kandydat skupił się na WŁASNYCH działaniach ("ja wdrożyłem", a nie ogólne "my zrobiliśmy")? Jakie narzędzia/metody zastosował?
- R (Result): CZY SĄ TWARDE METRYKI LICZBOWE? (liczby, %, czas, oszczędności, SLA). Rekruterzy odrzucają opowieści bez mierzalnego finału.

Wymogi punktacji:
- overallScore (1-10): ocena ogólna siły perswazyjnej odpowiedzi.
- verdict: "EXCELLENT" (8-10) | "SOLID" (6-7) | "NEEDS_REFINEMENT" (1-5).
- starBreakdown: obiekt z ocenami (1-10) i 1-2 zdaniami konstruktywnego feedbacku dla każdego komponentu (situation, task, action, result).
- strengths: tablica 2-3 najsilniejszych elementów wypowiedzi.
- improvements: tablica 2-3 konkretnych luk do wyeliminowania.
- exemplaryResponse: Zredagowana, wzorcowa wersja tej samej odpowiedzi. MUSI zachować fakty podane przez kandydata, ale brzmieć profesjonalnie, pewnie i z twardą strukturą STAR.

ZWRÓĆ WYŁĄCZNIE CZYSTY JSON:
{
  "overallScore": 8,
  "verdict": "SOLID",
  "starBreakdown": {
    "situation": { "score": 8, "feedback": "..." },
    "task": { "score": 7, "feedback": "..." },
    "action": { "score": 8, "feedback": "..." },
    "result": { "score": 6, "feedback": "..." }
  },
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "exemplaryResponse": "..."
}`;

  const userPrompt = `Pytanie rekrutera:
"${question}"

Odpowiedź kandydata:
"${truncateForModel(answer, 4000)}"

Kontekst kandydata:
${sanitizedContext || 'Brak dodatkowego kontekstu'}`;

  const config = loadConfig();
  const modelToUse = config.AI_PROVIDER === 'azure_openai'
    ? (config.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o')
    : config.OLLAMA_MODEL;

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const response = await generateWithUsage(
    {
      model: modelToUse,
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
      },
    },
    'interviewCoach:evaluateStarAnswer'
  );

  const parsed = parseModelJson<StarAnswerEvaluation>(
    response.text,
    'interviewCoach:evaluateStarAnswer'
  );

  return {
    evaluation: parsed,
    usage: response.usageMetadata,
  };
}
