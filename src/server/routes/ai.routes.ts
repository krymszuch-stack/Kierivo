import { Router, Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service';
import { verifyCvWithTripleLoop } from '../services/cvVerifier.service';
import {
  generateInterviewQuestionsWithAi,
  evaluateStarAnswerWithAi,
} from '../services/interviewCoach.service';
import { aiEndpointsLimiter } from '../middleware/rateLimiter';
import { requireAuth } from '../middleware/requireAuth';
import { executeAiOperation } from '../quota';
import { MasterVault } from '../../types';
import { checkOllamaHealth, callOllamaChat, OllamaChatMessage } from '../ollamaClient';
import { loadConfig } from '../config';

export const aiRouter = Router();

/**
 * Panel Doradcy korzysta z Ollamy jako opcjonalnego, lokalnego rozszerzenia.
 * Nie wolno udostępniać takiego modelu jako nieograniczonego endpointu publicznej
 * instancji. W trybie chmurowym aplikacja używa standardowych tras AI z
 * autoryzacją i kwotą, a interfejs Doradcy wraca do własnych reguł.
 */
function requireLocalOllama(req: Request, res: Response, next: NextFunction): void {
  if (loadConfig().backendEnabled) {
    res.status(501).json({
      success: false,
      error: 'Lokalna asysta Ollamy nie jest dostępna w instancji chmurowej.',
    });
    return;
  }

  next();
}

/**
 * POST /api/parse-jd
 */
aiRouter.post(
  '/parse-jd',
  requireAuth,
  aiEndpointsLimiter,
  async (req: Request<unknown, unknown, { rawJdText?: string }>, res: Response, next: NextFunction) => {
    try {
      const { rawJdText } = req.body;
      if (!rawJdText || typeof rawJdText !== 'string' || rawJdText.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Brak treści ogłoszenia o pracę.',
        });
      }

      const userId = req.user!.id;
      // Limit dobowy wyprowadza `executeAiOperation` ze statusu subskrypcji —
      // wcześniej „FREE” stało tu na sztywno i płacący Pro miał darmowy sufit.
      const parsedJd = await executeAiOperation(
        userId,
        'parse-jd',
        async () => {
          const result = await aiService.parseJd(rawJdText);
          return { data: result };
        }
      );

      res.json({ success: true, parsedJd });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/generate-cheat-sheet
 *
 * Wzbogaca lokalnie zbudowaną ściągę o część wymagającą modelu. Za
 * `requireAuth` i licznikiem kwot, jak każde inne wywołanie płatne — stara
 * wersja tej trasy stała otworem i nie meldowała zużycia.
 */
aiRouter.post(
  '/generate-cheat-sheet',
  requireAuth,
  aiEndpointsLimiter,
  async (
    req: Request<
      unknown,
      unknown,
      {
        vault?: MasterVault;
        targetRole?: string;
        companyName?: string;
        jobDescription?: string;
        topRequirements?: string[];
      }
    >,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { vault, targetRole, companyName, jobDescription, topRequirements } = req.body;

      if (!vault || typeof vault !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Brak profilu kandydata (MasterVault).',
        });
      }

      const userId = req.user!.id;

      const enrichment = await executeAiOperation(
        userId,
        'generate-cheat-sheet',
        async () => {
          const result = await aiService.generateCheatSheetEnrichment(
            targetRole ?? '',
            companyName ?? '',
            jobDescription ?? '',
            vault,
            Array.isArray(topRequirements) ? topRequirements : []
          );
          return { data: result };
        }
      );

      res.json({ success: true, enrichment });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/ai/verify-cv
 *
 * Dedykowany endpoint backendowy z potrójną pętlą sprawdzającą AI (360° CV Verification).
 * Wykorzystuje wdrożone modele Azure OpenAI (np. gpt-4o) do głębokiego audytu:
 * 1. ATS Parser & Keyword Alignment Gate
 * 2. Recruiter 6-Second First Impression & Achievement Metrics
 * 3. Chronology, Logic Consistency & Compliance Gate
 */
aiRouter.post(
  '/ai/verify-cv',
  requireAuth,
  aiEndpointsLimiter,
  async (
    req: Request<
      unknown,
      unknown,
      {
        vault?: MasterVault;
        targetRole?: string;
        targetCompany?: string;
        jobDescription?: string;
      }
    >,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { vault, targetRole, targetCompany, jobDescription } = req.body;

      if (!vault || typeof vault !== 'object' || !vault.personalInfo) {
        return res.status(400).json({
          success: false,
          error: 'Brak kompletnego profilu MasterVault do weryfikacji.',
        });
      }

      const userId = req.user!.id;
      const report = await executeAiOperation(
        userId,
        'verify-cv',
        async () => {
          const result = await verifyCvWithTripleLoop({
            vault,
            targetRole,
            targetCompany,
            jobDescription,
          });
          return { data: result };
        }
      );

      res.json({ success: true, report });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/ai/ollama/health
 *
 * Endpoint diagnostyczny sprawdzający łączność z instancją Ollama (/api/tags).
 * Zwraca status połączenia oraz listę modeli bez ujawniania konfiguracji env/adresów wewnętrznych.
 */
aiRouter.get('/ai/ollama/health', requireLocalOllama, async (_req: Request, res: Response) => {
  const config = loadConfig();
  try {
    const health = await checkOllamaHealth();
    res.json({
      success: true,
      provider: config.AI_PROVIDER,
      connected: health.connected,
      models: health.models,
      activeModel: config.OLLAMA_MODEL,
      checkedAt: health.checkedAt,
    });
  } catch (err) {
    res.json({
      success: true,
      provider: config.AI_PROVIDER,
      connected: false,
      models: [],
      activeModel: config.OLLAMA_MODEL,
      error: err instanceof Error ? err.message : 'Brak połączenia z instancją Ollama.',
      checkedAt: new Date().toISOString(),
    });
  }
});

const ADVISOR_SYSTEM_PROMPT = `Jesteś życzliwym, precyzyjnym i profesjonalnym Doradcą Kariery oraz ekspertem ds. systemów ATS (Applicant Tracking Systems) w aplikacji Kierivo.
Twoim celem jest pomoc kandydatowi w przygotowaniu etycznego, skutecznego i czytelnego CV oraz w przygotowaniu do rozmów rekrutacyjnych.
Kluczowe zasady:
1. Zero wymyślonych danych: przypominaj, by kandydat wpisywał wyłącznie prawdziwe i weryfikowalne fakty, osiągnięcia oraz metryki. Nigdy nie zachęcaj do fabrykowania liczb ani doświadczenia.
2. Metoda STAR: rekomenduj opisywanie osiągnięć schematem Sytuacja, Zadanie, Działanie, Rezultat (STAR) z mierzalnymi skutkami.
3. Standardy ATS: wyjaśniaj, że układ jednokolumnowy, czysty tekst bez tabel czy grafik i standardowe nagłówki gwarantują czytelność dla parserów. Kierivo bada zgodność strukturalną dokumentu, ale nie gwarantuje decyzji zewnętrznych systemów ATS.
4. Słowa kluczowe: tłumacz, że słowa kluczowe należy umieszczać w naturalnym kontekście realnych zadań, a nie sztucznie upychać.
Odpowiadaj konkretnie, pomocnie, zwięzłym i sformatowanym tekstem (np. punktorami lub krótkimi akapitami), w języku polskim.`;

/**
 * POST /api/advisor/chat
 *
 * Asysta lokalnej Ollamy w Doradcy regułowym.
 * Przyjmuje zapytanie i opcjonalną krótką historię, zwraca odpowiedź wygenerowaną
 * przez lokalny model Ollama z zachowaniem zasad rzetelności Kierivo.
 */
aiRouter.post(
  '/advisor/chat',
  requireLocalOllama,
  async (
    req: Request<
      unknown,
      unknown,
      {
        query?: string;
        history?: Array<{ sender: 'user' | 'ai'; text: string }>;
        model?: string;
        context?: {
          offerTitle?: string;
          score?: number;
          missingHardSkills?: string[];
          structuralWarnings?: string[];
          missingProfileSections?: string[];
          hasLanguages?: boolean;
        };
      }
    >,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { query, history, model, context } = req.body;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Brak treści zapytania do Doradcy.',
        });
      }

      const trimmedQuery = query.trim();
      if (trimmedQuery.length > 5000) {
        return res.status(400).json({
          success: false,
          error: 'Zapytanie przekracza maksymalną dozwoloną długość (5000 znaków).',
        });
      }

      // Formatowanie historii (ostatnie 10 wiadomości)
      const formattedHistory: OllamaChatMessage[] = [];
      if (Array.isArray(history)) {
        const recent = history.slice(-10);
        for (const item of recent) {
          if (typeof item.text === 'string' && item.text.trim()) {
            formattedHistory.push({
              role: item.sender === 'user' ? 'user' : 'assistant',
              content: item.text.trim(),
            });
          }
        }
      }

      const messages: OllamaChatMessage[] = [
        { role: 'system', content: ADVISOR_SYSTEM_PROMPT },
        ...(context && typeof context === 'object' ? [{
          role: 'system' as const,
          content: `Lokalny kontekst aktualnej analizy (nie jest wyrokiem ATS): ${JSON.stringify({
            oferta: typeof context.offerTitle === 'string' ? context.offerTitle.slice(0, 200) : undefined,
            wynikWlasny: typeof context.score === 'number' ? context.score : undefined,
            brakujaceWymagania: Array.isArray(context.missingHardSkills) ? context.missingHardSkills.slice(0, 6) : [],
            ostrzezeniaStruktury: Array.isArray(context.structuralWarnings) ? context.structuralWarnings.slice(0, 4) : [],
            brakiProfilu: Array.isArray(context.missingProfileSections) ? context.missingProfileSections.slice(0, 4) : [],
            jezykiWpisane: context.hasLanguages === true,
          })}`,
        }] : []),
        ...formattedHistory,
        { role: 'user', content: trimmedQuery },
      ];

      const result = await callOllamaChat({
        messages,
        model: typeof model === 'string' && model.trim() ? model.trim() : undefined,
        context: 'advisor-chat',
        timeoutMs: 90_000,
      });

      res.json({
        success: true,
        reply: result.content,
        provider: 'ollama',
        model: result.model,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/ai/coach-star/generate-questions
 * Generuje pytania rekrutacyjne dopasowane do kandydata i stanowiska (Azure OpenAI gpt-4o).
 */
aiRouter.post(
  '/ai/coach-star/generate-questions',
  requireAuth,
  aiEndpointsLimiter,
  async (
    req: Request<
      unknown,
      unknown,
      {
        targetRole?: string;
        targetCompany?: string;
        jobDescription?: string;
        vault?: MasterVault;
      }
    >,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { targetRole, targetCompany, jobDescription, vault } = req.body;
      const userId = req.user!.id;

      const questions = await executeAiOperation(
        userId,
        'coach-star-questions',
        async () => {
          const result = await generateInterviewQuestionsWithAi({
            targetRole,
            targetCompany,
            jobDescription,
            vault,
          });
          return { data: result.questions, usage: result.usage };
        }
      );

      res.json({
        success: true,
        questions,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/ai/coach-star/evaluate-answer
 * Ocenia odpowiedź kandydata w schemacie STAR (Situation, Task, Action, Result) z korektą.
 */
aiRouter.post(
  '/ai/coach-star/evaluate-answer',
  requireAuth,
  aiEndpointsLimiter,
  async (
    req: Request<
      unknown,
      unknown,
      {
        question?: string;
        answer?: string;
        targetRole?: string;
        vault?: MasterVault;
      }
    >,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { question, answer, targetRole, vault } = req.body;

      if (!question || typeof question !== 'string' || !question.trim()) {
        return res.status(400).json({ success: false, error: 'Brak pytania rekrutacyjnego.' });
      }

      if (!answer || typeof answer !== 'string' || !answer.trim()) {
        return res.status(400).json({ success: false, error: 'Brak treści odpowiedzi kandydata.' });
      }

      const userId = req.user!.id;

      const evaluation = await executeAiOperation(
        userId,
        'coach-star-evaluate',
        async () => {
          const result = await evaluateStarAnswerWithAi({
            question,
            answer,
            targetRole,
            vault,
          });
          return { data: result.evaluation, usage: result.usage };
        }
      );

      res.json({
        success: true,
        evaluation,
      });
    } catch (err) {
      next(err);
    }
  }
);


