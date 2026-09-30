import type { InterviewCoachProfileContext } from '../../lib/interviewCoachContext';
import { pseudonymize } from '../pseudonymize';
import { generateWithUsage, truncateForModel, parseModelJson } from '../geminiClient';
import { loadConfig } from '../config';

export interface GenerateQuestionsOptions {
  profileContext?: InterviewCoachProfileContext;
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
  const { profileContext, targetRole, targetCompany, jobDescription } = options;

  let sanitizedHistory: string[] = [];
  let sanitizedSkills: string[] = [];

  if (profileContext) {
    sanitizedHistory = profileContext.experience.slice(0, 3).map((entry) => {
      const raw = `${entry.role}: ${entry.highlights.slice(0, 2).join('; ')}`;
      return pseudonymize(raw).text;
    });

    sanitizedSkills = [
      ...profileContext.hardSkills.slice(0, 8),
      ...profileContext.toolsAndTech.slice(0, 8),
    ];
  }

  const role = targetRole?.trim() || profileContext?.roleTitle?.trim() || 'Nie podano stanowiska';
  const company = targetCompany?.trim() || 'Nie podano firmy';
  const jdContext = jobDescription ? truncateForModel(jobDescription, 2000) : 'Nie podano treści ogłoszenia';

  const systemPrompt = `Jesteś doświadczonym Dyrektorem Rekrutacji (Executive Recruiter) i Trenerem Rozmów Kwalifikacyjnych.
Twoim zadaniem jest ułożenie 4 realistycznych pytań do ćwiczenia rozmowy. Stanowisko: "${role}". Firma: "${company}".
Jeśli brakuje stanowiska, firmy, ogłoszenia lub danych kandydata, nie zgaduj ich ani nie przedstawiaj typowych wymagań jako faktów o tej ofercie.
Pytania mają pasować do branży i rodzaju pracy wskazanych w kontekście. Nie zakładaj, że kandydat pracuje w IT ani że ma doświadczenie projektowe.
Nie wymagaj liczbowej metryki; akceptuj rzetelny opis jakościowego rezultatu i sytuacji, w której rezultat nie był mierzony.

Kategorie pytań:
1. "behavioral" - Oparte na trudnej sytuacji z przeszłości (np. awaria, konflikt, trudny klient, presja terminowa).
2. "situational" - Pytanie scenariuszowe ("Co byś zrobił, gdyby...").
3. "competency" - Weryfikacja kompetencji właściwej dla wskazanej roli; nie zakładaj technologii ani architektury bez źródła.

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
  const { question, answer, targetRole } = options;

  if (!answer || answer.trim().length === 0) {
    throw new Error('Brak treści odpowiedzi do analizy.');
  }

  const role = targetRole?.trim() || 'Nie podano stanowiska';

  const systemPrompt = `Jesteś wspierającym trenerem rozmów kwalifikacyjnych. Twoja ocena jest orientacyjną opinią AI, a nie obiektywnym pomiarem ani prognozą decyzji rekrutacyjnej.
Oceniasz odpowiedź kandydata na stanowisko "${role}" pod kątem techniki STAR:
- S (Situation): Czy tło sytuacji jest zrozumiałe i wystarczające?
- T (Task): Czy cel, wyzwanie i konkretna rola kandydata są jasno określone?
- A (Action): Czy kandydat opisał własny wkład i działania? Nie wymagaj stanowiska kierowniczego, wdrożenia ani pracy zespołowej.
- R (Result): Czy kandydat podał rzeczywisty skutek, wniosek lub uczciwie zaznaczył brak pomiaru? Liczby są opcjonalne; nie obniżaj oceny wyłącznie za ich brak.

Najważniejsza zasada: nie dopisuj żadnych faktów, nazw, odpowiedzialności, liczb, sukcesów ani skutków, których nie ma w odpowiedzi kandydata. W polach bez danych zostaw neutralny tekst lub wskaż [uzupełnij własnym faktem]; nie wymyślaj przykładu.

Wymogi punktacji:
- overallScore (1-10): subiektywna ocena treningowa struktury i jasności odpowiedzi.
- verdict: "EXCELLENT" (8-10) | "SOLID" (6-7) | "NEEDS_REFINEMENT" (1-5).
- starBreakdown: obiekt z ocenami (1-10) i 1-2 zdaniami konstruktywnego feedbacku dla każdego komponentu (situation, task, action, result).
- strengths: tablica 2-3 najsilniejszych elementów wypowiedzi.
- improvements: tablica 2-3 konkretnych luk do wyeliminowania.
- exemplaryResponse: Zredagowany szkic tej samej odpowiedzi. Zachowaj wyłącznie fakty podane przez kandydata. Brakujących elementów nie uzupełniaj domysłami; wstaw [uzupełnij własnym faktem] albo pomiń.

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

Kontekst kandydata: brak. Oceniaj wyłącznie treść podanej odpowiedzi.`;

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
