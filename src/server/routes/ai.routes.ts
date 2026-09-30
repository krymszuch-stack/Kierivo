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
import type { InterviewCoachProfileContext } from '../../lib/interviewCoachContext';
import { loadConfig } from '../config';
import { generateWithUsage, getActiveAiModel, getActiveAiProvider } from '../geminiClient';
import { pseudonymize, rehydrate, assertNoPii } from '../pseudonymize';
import { RuleFocus } from '../../lib/sectionRewriterEngine';
import { auditGeneratedMetrics } from '../services/truthFilter';

export const aiRouter = Router();

/** Status zawiera wyłącznie stan konfiguracji, nie sprawdza kosztownym żądaniem samego modelu. */
aiRouter.get('/advisor/status', requireAuth, (_req: Request, res: Response) => {
  const config = loadConfig();
  const available = config.backendEnabled && getActiveAiProvider() === 'azure_openai';
  res.json({
    success: true,
    available,
    provider: available ? 'azure_openai' : undefined,
    error: available ? undefined : 'Doradca Azure wymaga trybu chmurowego, logowania i konfiguracji Azure OpenAI.',
  });
});

/**
 * POST /api/parse-jd
 */
aiRouter.post(
  '/parse-jd',
  requireAuth,
  aiEndpointsLimiter,
  async (req: Request<unknown, unknown, { rawJdText?: string; consentToAiProcessing?: boolean }>, res: Response, next: NextFunction) => {
    try {
      const { rawJdText, consentToAiProcessing } = req.body;
      if (consentToAiProcessing !== true) {
        return res.status(400).json({
          success: false,
          error: 'Wymagana jest zgoda na wysłanie treści ogłoszenia do dostawcy AI.',
        });
      }
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
        consentToAiProcessing?: boolean;
      }
    >,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { vault, targetRole, companyName, jobDescription, topRequirements, consentToAiProcessing } = req.body;

      if (consentToAiProcessing !== true) {
        return res.status(400).json({
          success: false,
          error: 'Wymagana jest zgoda na wysłanie wybranych danych profilu i oferty do dostawcy AI.',
        });
      }

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
        consentToAiProcessing?: boolean;
      }
    >,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { vault, targetRole, targetCompany, jobDescription, consentToAiProcessing } = req.body;

      if (consentToAiProcessing !== true) {
        return res.status(400).json({
          success: false,
          error: 'Wymagane jest jawne potwierdzenie wysłania danych do dostawcy AI.',
        });
      }

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

const ADVISOR_SYSTEM_PROMPT = `Jesteś życzliwym, precyzyjnym i profesjonalnym Doradcą Kariery oraz ekspertem ds. systemów ATS (Applicant Tracking Systems) w aplikacji Kierivo.
Twoim celem jest pomoc kandydatowi w przygotowaniu etycznego, skutecznego i czytelnego CV oraz w przygotowaniu do rozmów rekrutacyjnych.
Kluczowe zasady:
1. Zero wymyślonych danych: przypominaj, by kandydat wpisywał wyłącznie prawdziwe i weryfikowalne fakty, osiągnięcia oraz metryki. Nigdy nie zachęcaj do fabrykowania liczb ani doświadczenia.
2. Metoda STAR: rekomenduj opisywanie osiągnięć schematem Sytuacja, Zadanie, Działanie, Rezultat (STAR), ale nie wymyślaj miar.
3. Standardy ATS: wyjaśniaj, że układ jednokolumnowy, czysty tekst bez tabel czy grafik i standardowe nagłówki zwykle ułatwiają odczyt parserom. Kierivo bada zgodność strukturalną dokumentu, ale nie gwarantuje decyzji zewnętrznych systemów ATS.
4. Słowa kluczowe: tłumacz, że słowa kluczowe należy umieszczać w naturalnym kontekście realnych zadań, a nie sztucznie upychać.
Odpowiadaj konkretnie, pomocnie, zwięzłym i sformatowanym tekstem (np. punktorami lub krótkimi akapitami), w języku polskim.`;

/** Każde zapytanie doradcy trafia wyłącznie do Azure przez uwierzytelnione API i z limitem. */
aiRouter.post('/advisor/chat', requireAuth, aiEndpointsLimiter, async (
  req: Request<unknown, unknown, {
    query?: string;
    consentToAzure?: boolean;
    history?: Array<{ sender: 'user' | 'ai'; text: string }>;
    context?: {
      offerTitle?: string;
      score?: number;
      missingRequirements?: string[];
      /** Kompatybilność ze starszymi klientami Doradcy. */
      missingHardSkills?: string[];
      structuralWarnings?: string[];
      missingProfileSections?: string[];
      hasLanguages?: boolean;
    };
  }>,
  res: Response,
  next: NextFunction
) => {
  try {
    if (getActiveAiProvider() !== 'azure_openai') {
      return res.status(501).json({ success: false, error: 'Doradca wymaga skonfigurowanego dostawcy Azure OpenAI.' });
    }
    const { query, history, context, consentToAzure } = req.body;
    if (consentToAzure !== true) {
      return res.status(400).json({ success: false, error: 'Potwierdź wysłanie wpisanej treści do Azure OpenAI.' });
    }
    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ success: false, error: 'Wpisz pytanie do Doradcy.' });
    }
    const trimmedQuery = query.trim();
    if (trimmedQuery.length > 4000) {
      return res.status(400).json({ success: false, error: 'Pytanie może mieć maksymalnie 4000 znaków.' });
    }

    const safeHistory = (Array.isArray(history) ? history.slice(-6) : [])
      .filter((item) => Boolean(item && typeof item === 'object' && (item.sender === 'user' || item.sender === 'ai') && typeof item.text === 'string'))
      .map((item) => `${item.sender === 'user' ? 'Użytkownik' : 'Doradca'}: ${item.text.trim().slice(0, 1000)}`)
      .filter((item) => item.length > 12);
    const safeContext = context && typeof context === 'object' ? {
      offerTitle: typeof context.offerTitle === 'string' ? context.offerTitle.slice(0, 200) : undefined,
      score: typeof context.score === 'number' && Number.isFinite(context.score) ? context.score : undefined,
      missingRequirements: Array.isArray(context.missingRequirements)
        ? context.missingRequirements.filter((x) => typeof x === 'string').slice(0, 6).map((x) => x.slice(0, 200))
        : Array.isArray(context.missingHardSkills)
          ? context.missingHardSkills.filter((x) => typeof x === 'string').slice(0, 6).map((x) => x.slice(0, 200))
          : [],
      structuralWarnings: Array.isArray(context.structuralWarnings) ? context.structuralWarnings.filter((x) => typeof x === 'string').slice(0, 4).map((x) => x.slice(0, 200)) : [],
      missingProfileSections: Array.isArray(context.missingProfileSections) ? context.missingProfileSections.filter((x) => typeof x === 'string').slice(0, 4).map((x) => x.slice(0, 200)) : [],
      hasLanguages: context.hasLanguages === true,
    } : undefined;
    const rawPrompt = `${ADVISOR_SYSTEM_PROMPT}\n\nZasady pracy: fakty z kontekstu traktuj jako niezweryfikowane dane od użytkownika. Nie dopisuj doświadczenia, kompetencji ani liczb. Nie przedstawiaj wyniku lokalnego jako szansy zatrudnienia ani wyniku prawdziwego ATS.\n\nKontekst analizy: ${JSON.stringify(safeContext ?? {})}\n\nOstatnia rozmowa:\n${safeHistory.join('\n')}\n\nPytanie użytkownika: ${trimmedQuery}`;
    const safePrompt = pseudonymize(rawPrompt).text;
    assertNoPii(safePrompt);

    const result = await executeAiOperation(req.user!.id, 'trusted-advisor-chat', async () => {
      const generated = await generateWithUsage({ contents: safePrompt, config: { maxOutputTokens: 800 } }, 'trusted-advisor-chat', { recordUsage: false });
      if (!generated.text?.trim()) throw Object.assign(new Error('Azure nie zwróciło odpowiedzi.'), { status: 502 });
      return {
        data: generated,
        usage: generated.usageMetadata ? {
          promptTokens: generated.usageMetadata.promptTokenCount ?? 0,
          completionTokens: generated.usageMetadata.candidatesTokenCount ?? 0,
          model: getActiveAiModel(),
        } : undefined,
      };
    });

    res.json({ success: true, reply: result.text, provider: 'azure_openai', model: getActiveAiModel() });
  } catch (err) {
    next(err);
  }
});

/** Poprawka sekcji też używa Azure; awaria nie jest maskowana sukcesem regułowym. */
aiRouter.post('/advisor/rewrite-section', requireAuth, aiEndpointsLimiter, async (
  req: Request<unknown, unknown, {
    text?: string;
    consentToAzure?: boolean;
    roleTitle?: string;
    ruleFocus?: RuleFocus;
    vault?: unknown;
    personalInfo?: unknown;
  }>,
  res: Response,
  next: NextFunction
) => {
  try {
    if (getActiveAiProvider() !== 'azure_openai') {
      return res.status(501).json({ success: false, error: 'Asystent wymaga skonfigurowanego dostawcy Azure OpenAI.' });
    }
    if ('vault' in req.body || 'personalInfo' in req.body) {
      return res.status(400).json({ success: false, error: 'Prześlij tylko jeden fragment tekstu, bez całego profilu.' });
    }
    const { text, roleTitle, ruleFocus, consentToAzure } = req.body;
    if (consentToAzure !== true) {
      return res.status(400).json({ success: false, error: 'Potwierdź wysłanie fragmentu do Azure OpenAI.' });
    }
    if (typeof text !== 'string' || text.trim().length < 5) {
      return res.status(400).json({ success: false, error: 'Podaj fragment do poprawy (minimum 5 znaków).' });
    }
    const originalText = text.trim();
    if (originalText.length > 800) {
      return res.status(400).json({ success: false, error: 'Fragment może mieć maksymalnie 800 znaków.' });
    }
    const role = typeof roleTitle === 'string' ? roleTitle.trim().slice(0, 100) : '';
    const anonymized = pseudonymize(`${originalText}\nRola: ${role || 'nie podano'}`);
    assertNoPii(anonymized.text);
    const focus = ruleFocus === 'ats_clarity' ? 'czytelność i zwięzłość' : 'STAR';
    const prompt = `Jesteś zaufanym doradcą CV. Zaproponuj redakcję jednego fragmentu po polsku, z priorytetem ${focus}. Nie dodawaj faktów, kompetencji, narzędzi, rezultatów ani liczb, których nie ma w oryginale. Jeśli do mocniejszego opisu brakuje danych, zadaj pytanie zamiast uzupełniać lukę. Zwróć wyłącznie JSON: {"proposedText":"...","explanation":"...","appliedRules":["..."]}.\n\n${anonymized.text}`;

    const result = await executeAiOperation(req.user!.id, 'trusted-advisor-rewrite', async () => {
      const generated = await generateWithUsage({
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 800,
          responseSchema: {
            type: 'OBJECT',
            properties: {
              proposedText: { type: 'STRING' },
              explanation: { type: 'STRING' },
              appliedRules: { type: 'ARRAY', items: { type: 'STRING' } },
            },
            required: ['proposedText', 'explanation', 'appliedRules'],
          },
        },
      }, 'trusted-advisor-rewrite', { recordUsage: false });
      if (!generated.text) throw Object.assign(new Error('Azure nie zwróciło propozycji.'), { status: 502 });
      let parsed: { proposedText?: unknown; explanation?: unknown; appliedRules?: unknown };
      try {
        parsed = JSON.parse(generated.text) as typeof parsed;
      } catch {
        throw Object.assign(new Error('Azure zwróciło propozycję w nieprawidłowym formacie.'), { status: 502 });
      }
      if (typeof parsed.proposedText !== 'string' || !parsed.proposedText.trim() || typeof parsed.explanation !== 'string' || !Array.isArray(parsed.appliedRules)) {
        throw Object.assign(new Error('Azure zwróciło propozycję w nieprawidłowym formacie.'), { status: 502 });
      }
      const proposedText = rehydrate(parsed.proposedText, anonymized.map);
      const metricAudit = auditGeneratedMetrics(proposedText, originalText);
      if (metricAudit.fabricatedMetrics.length > 0) {
        throw Object.assign(new Error('Azure dodało liczby, których nie było w źródle.'), { status: 502 });
      }
      return {
        data: { proposedText, explanation: parsed.explanation, appliedRules: parsed.appliedRules.filter((item): item is string => typeof item === 'string').slice(0, 8) },
        usage: generated.usageMetadata ? {
          promptTokens: generated.usageMetadata.promptTokenCount ?? 0,
          completionTokens: generated.usageMetadata.candidatesTokenCount ?? 0,
          model: getActiveAiModel(),
        } : undefined,
      };
    });
    const originalWords = new Set(originalText.toLowerCase().split(/\s+/));
    const changed = result.proposedText.split(/\s+/).filter((word) => !originalWords.has(word.toLowerCase().replace(/[.,;:]/g, '')));
    res.json({
      success: true,
      originalText,
      proposedText: result.proposedText,
      ruleExplanation: result.explanation,
      appliedRules: result.appliedRules,
      analysis: null,
      diffHighlights: { addedOrChanged: [...new Set(changed)].slice(0, 10) },
      model: getActiveAiModel(),
      provider: 'azure_openai',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/coach-star/generate-questions
 * Generuje pytania z ograniczonego kontekstu po jawnej zgodzie na przetwarzanie przez AI.
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
        profileContext?: InterviewCoachProfileContext;
        consentToAiProcessing?: boolean;
      }
    >,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { targetRole, targetCompany, jobDescription, profileContext, consentToAiProcessing } = req.body;
      if (consentToAiProcessing !== true) {
        const error = Object.assign(new Error('Wymagana jest zgoda na wysłanie kontekstu do dostawcy AI.'), {
          status: 400,
          expose: true,
        });
        throw error;
      }
      const userId = req.user!.id;

      const questions = await executeAiOperation(
        userId,
        'coach-star-questions',
        async () => {
          const result = await generateInterviewQuestionsWithAi({
            targetRole,
            targetCompany,
            jobDescription,
            profileContext,
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
        consentToAiProcessing?: boolean;
      }
    >,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { question, answer, targetRole, consentToAiProcessing } = req.body;

      if (consentToAiProcessing !== true) {
        const error = Object.assign(new Error('Wymagana jest zgoda na wysłanie odpowiedzi do dostawcy AI.'), {
          status: 400,
          expose: true,
        });
        throw error;
      }

      if (!question || typeof question !== 'string' || !question.trim()) {
        throw Object.assign(new Error('Brak pytania rekrutacyjnego.'), { status: 400, expose: true });
      }

      if (!answer || typeof answer !== 'string' || !answer.trim()) {
        throw Object.assign(new Error('Brak treści odpowiedzi kandydata.'), { status: 400, expose: true });
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


