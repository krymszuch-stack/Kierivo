import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  execute: vi.fn(async (_userId: string, _context: string, task: () => Promise<{ data: unknown }>) => (await task()).data),
}));

vi.mock('../middleware/requireAuth', () => ({
  requireAuth: (req: { user?: { id: string } }, _res: unknown, next: () => void) => {
    req.user = { id: 'synthetic-user' };
    next();
  },
}));
vi.mock('../quota', () => ({ executeAiOperation: mocks.execute }));
vi.mock('../geminiClient', async (importOriginal) => ({
  ...await importOriginal<typeof import('../geminiClient')>(),
  generateWithUsage: mocks.generate,
  getActiveAiProvider: () => process.env.AI_PROVIDER ?? 'azure_openai',
  getActiveAiModel: () => 'synthetic-azure-deployment',
}));

import { aiRouter } from '../routes/ai.routes';
import { errorHandler } from '../middleware/errorHandler';
import { resetConfigCacheForTesting } from '../config';

describe('Doradca zaufany korzysta z Azure przez API', () => {
  let server: Server;
  let baseUrl = '';

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.BACKEND_MODE = 'cloud';
    process.env.SUPABASE_URL = 'https://synthetic.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-only';
    process.env.AI_PROVIDER = 'azure_openai';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://synthetic.openai.azure.com';
    process.env.AZURE_OPENAI_DEPLOYMENT = 'synthetic-deployment';
    resetConfigCacheForTesting();
    mocks.generate.mockReset();
    mocks.execute.mockClear();

    const app = express();
    app.use(express.json());
    app.use('/api', aiRouter);
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') baseUrl = `http://127.0.0.1:${address.port}/api`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    resetConfigCacheForTesting();
    vi.restoreAllMocks();
  });

  it('status pokazuje wyłącznie gotowość konfiguracji, bez udawania testu modelu', async () => {
    const response = await fetch(`${baseUrl}/advisor/status`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, available: true, provider: 'azure_openai' });
  });

  it('wymaga jawnego potwierdzenia i nie wysyła wtedy zapytania do modelu', async () => {
    const response = await fetch(`${baseUrl}/advisor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Jak poprawić CV?' }),
    });
    expect(response.status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('przekazuje do Azure ograniczony kontekst po pseudonimizacji i liczy wywołanie dla konta', async () => {
    mocks.generate.mockResolvedValueOnce({
      text: 'Opisz rezultat wyłącznie na podstawie prawdziwych danych.',
      usageMetadata: { promptTokenCount: 70, candidatesTokenCount: 20 },
    });
    const response = await fetch(`${baseUrl}/advisor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Mój e-mail to jan.kowalski@example.com. Jak poprawić CV?',
        context: { offerTitle: 'Specjalista IT', missingHardSkills: ['Azure'] },
        consentToAzure: true,
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, provider: 'azure_openai', reply: expect.stringContaining('prawdziwych danych') });
    expect(JSON.stringify(mocks.generate.mock.calls[0])).not.toContain('jan.kowalski@example.com');
    expect(mocks.execute).toHaveBeenCalledWith('synthetic-user', 'trusted-advisor-chat', expect.any(Function));
  });

  it('preferuje kanoniczne wymagania, także gdy lista kanoniczna jest pusta', async () => {
    mocks.generate.mockResolvedValueOnce({ text: 'Odpowiedź testowa.', usageMetadata: {} });
    const response = await fetch(`${baseUrl}/advisor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Jakie są braki?',
        context: {
          score: 71,
          missingRequirements: [],
          missingHardSkills: ['stary wynik: Azure'],
        },
        consentToAzure: true,
      }),
    });

    expect(response.status).toBe(200);
    const prompt = String(mocks.generate.mock.calls[0][0].contents);
    expect(prompt).toContain('"score":71');
    expect(prompt).toContain('"missingRequirements":[]');
    expect(prompt).not.toContain('stary wynik: Azure');
  });

  it('odrzuca cały vault przed wywołaniem Azure', async () => {
    const response = await fetch(`${baseUrl}/advisor/rewrite-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Pracowałem przy obsłudze klientów.', consentToAzure: true, vault: { secret: 'test' } }),
    });
    expect(response.status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('trener STAR nie wysyła profilu ani odpowiedzi bez jawnej zgody', async () => {
    const questions = await fetch(`${baseUrl}/ai/coach-star/generate-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileContext: { hardSkills: ['Windows 11'] } }),
    });
    const evaluation = await fetch(`${baseUrl}/ai/coach-star/evaluate-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Testowe pytanie', answer: 'Moja odpowiedź.' }),
    });

    expect(questions.status).toBe(400);
    expect(evaluation.status).toBe(400);
    expect(await questions.json()).toMatchObject({ success: false, error: expect.stringContaining('zgoda'), requestId: expect.any(String) });
    expect(await evaluation.json()).toMatchObject({ success: false, error: expect.stringContaining('zgoda'), requestId: expect.any(String) });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('pytania używają tylko przekazanego wyciągu profilu, a ocena nie dostaje całego Vaultu', async () => {
    mocks.generate
      .mockResolvedValueOnce({ text: JSON.stringify({ questions: [] }), usageMetadata: {} })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          overallScore: 6,
          verdict: 'SOLID',
          starBreakdown: {
            situation: { score: 6, feedback: 'Jasny kontekst.' },
            task: { score: 6, feedback: 'Opisano zadanie.' },
            action: { score: 6, feedback: 'Opisano działanie.' },
            result: { score: 6, feedback: 'Opisano skutek.' },
          },
          strengths: ['Konkret'],
          improvements: ['Dodaj kontekst'],
          exemplaryResponse: 'Zredagowany szkic.',
        }),
        usageMetadata: {},
      });

    const questionResponse = await fetch(`${baseUrl}/ai/coach-star/generate-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consentToAiProcessing: true,
        profileContext: {
          roleTitle: 'Specjalista wsparcia IT',
          hardSkills: ['Windows 11'],
          toolsAndTech: [],
          experience: [{ role: 'Technik IT', highlights: ['Rozwiązywałem zgłoszenia.'] }],
        },
      }),
    });
    const answerResponse = await fetch(`${baseUrl}/ai/coach-star/evaluate-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consentToAiProcessing: true,
        question: 'Opowiedz o zadaniu.',
        answer: 'Pomogłem klientowi odzyskać dostęp do konta.',
        targetRole: 'Specjalista wsparcia IT',
        vault: { personalInfo: { fullName: 'Nie powinno trafić do serwisu' } },
      }),
    });

    expect(questionResponse.status).toBe(200);
    expect(answerResponse.status).toBe(200);
    expect(String(mocks.generate.mock.calls[0][0].contents)).toContain('Windows 11');
    expect(String(mocks.generate.mock.calls[0][0].contents)).toContain('Nie podano firmy');
    const answerPrompt = String(mocks.generate.mock.calls[1][0].contents);
    expect(answerPrompt).toContain('Pomogłem klientowi odzyskać dostęp do konta.');
    expect(answerPrompt).not.toContain('Nie powinno trafić do serwisu');
    expect(answerPrompt).toContain('Kontekst kandydata: brak');
  });

  it('zwraca propozycję wyłącznie po poprawnej odpowiedzi JSON z Azure', async () => {
    mocks.generate.mockResolvedValueOnce({
      text: JSON.stringify({
        proposedText: 'Obsługiwałem klientów zgodnie z procedurami.',
        explanation: 'Usunięto zbędne słowa bez dodawania nowych faktów.',
        appliedRules: ['Zwięzłość'],
      }),
      usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 30 },
    });
    const response = await fetch(`${baseUrl}/advisor/rewrite-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Byłem odpowiedzialny za obsługę klientów.', consentToAzure: true }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, provider: 'azure_openai', proposedText: 'Obsługiwałem klientów zgodnie z procedurami.' });
  });

  it('odrzuca liczbę dopisaną przez model, której nie było w źródle', async () => {
    mocks.generate.mockResolvedValueOnce({
      text: JSON.stringify({
        proposedText: 'Obsługiwałem 40 klientów dziennie.',
        explanation: 'Dopisano konkretny wynik.',
        appliedRules: ['STAR'],
      }),
      usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 30 },
    });
    const response = await fetch(`${baseUrl}/advisor/rewrite-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Obsługiwałem klientów.', consentToAzure: true }),
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ success: false });
  });

  it('nie zastępuje awarii lub błędnego JSON-u udawaną regułową odpowiedzią', async () => {
    mocks.generate.mockResolvedValueOnce({ text: 'to nie jest JSON' });
    const response = await fetch(`${baseUrl}/advisor/rewrite-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Obsługiwałem zgłoszenia klientów.', consentToAzure: true }),
    });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ success: false });
  });
});
