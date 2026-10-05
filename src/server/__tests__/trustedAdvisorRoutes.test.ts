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
import { aiEndpointsLimiter } from '../middleware/rateLimiter';
import { getAnalysisMonth } from '../../lib/analysisPeriod';
import { CANONICAL_ATS_SCORE_PROVENANCE } from '../../types';

describe('Doradca zaufany korzysta z Azure przez API', () => {
  let server: Server;
  let baseUrl = '';
  let analysisMetadata: { calculatedAt: string; calculationMonth: string; atsScoreProvenance: typeof CANONICAL_ATS_SCORE_PROVENANCE };

  beforeEach(async () => {
    // Każda próba uruchamia nowy serwer; licznik modułu nie może dziedziczyć
    // ruchu z poprzednich przypadków i maskować walidacji odpowiedzi modelu.
    aiEndpointsLimiter.reset();
    const now = new Date();
    analysisMetadata = { calculatedAt: now.toISOString(), calculationMonth: getAnalysisMonth(now)!, atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE };
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
    vi.useRealTimers();
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
          ...analysisMetadata, score: 71,
          scoreEvidence: { ...analysisMetadata, detectedRequirementCount: 3, profileCompleteness: 86, careerEvidenceAvailable: true, unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0, scoreContextVersion: 5, careerEvidenceVersion: 2 },
          missingRequirements: [],
          missingHardSkills: ['stary wynik: Azure'],
        },
        consentToAzure: true,
      }),
    });

    expect(response.status).toBe(200);
    const prompt = String(mocks.generate.mock.calls[0][0].contents);
    expect(prompt).toContain('"score":71');
    expect(prompt).toContain('"scope":"sufficient"');
    expect(prompt).toContain('"missingRequirements":[]');
    expect(prompt).not.toContain('stary wynik: Azure');
  });

  it('nie wysyła liczby, gdy zapisany wymóg doświadczenia ma status nieznany', async () => {
    mocks.generate.mockResolvedValueOnce({ text: 'Wynik ma ograniczony zakres.', usageMetadata: {} });
    const response = await fetch(`${baseUrl}/advisor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Jak ocenic to CV?',
        context: {
          ...analysisMetadata, score: 98,
          scoreEvidence: { ...analysisMetadata, detectedRequirementCount: 5, profileCompleteness: 86, careerEvidenceAvailable: true, unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 1, scoreContextVersion: 5, careerEvidenceVersion: 2 },
          missingRequirements: [],
        },
        consentToAzure: true,
      }),
    });

    expect(response.status).toBe(200);
    const prompt = String(mocks.generate.mock.calls[0][0].contents);
    expect(prompt).not.toContain('"score":98');
    expect(prompt).toContain('"unconfirmedRequirementCount":1');
    expect(prompt).toContain('"scope":"limited"');
    expect(prompt).toContain('scoreEvidence.scope=limited');
  });

  it('odrzuca niespojny zakres licznikow dowodow z niezaufanego zadania', async () => {
    for (const scoreEvidence of [
      { detectedRequirementCount: 2, unmetBlockingRequirementCount: 3, unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0 },
      { detectedRequirementCount: 2, unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 1, unconfirmedRequirementCount: 3 },
      { detectedRequirementCount: 3, unmetBlockingRequirementCount: 2, unconfirmedBlockingRequirementCount: 1, unconfirmedRequirementCount: 2 },
    ]) {
      mocks.generate.mockResolvedValueOnce({ text: 'Nie uĹĽywajÄ™ niespĂłjnego kontekstu.', usageMetadata: {} });
      const response = await fetch(`${baseUrl}/advisor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Jaki mam wynik?',
          context: {
            score: 98,
            scoreEvidence: { ...scoreEvidence, profileCompleteness: 86, careerEvidenceAvailable: true, scoreContextVersion: 5, careerEvidenceVersion: 2 },
          },
          consentToAzure: true,
        }),
      });

      expect(response.status).toBe(200);
      const prompt = String(mocks.generate.mock.calls.at(-1)?.[0].contents);
      expect(prompt).not.toContain('"score":98');
      expect(prompt).toContain('scoreEvidence nie ma');
    }
  });

  it('odrzuca surowy wynik od starszego klienta bez zakresu dowodow', async () => {
    mocks.generate.mockResolvedValueOnce({ text: 'Brak podstaw do przytoczenia liczby.', usageMetadata: {} });
    const response = await fetch(`${baseUrl}/advisor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Jaki mam wynik?', context: { score: 84 }, consentToAzure: true }),
    });

    expect(response.status).toBe(200);
    const prompt = String(mocks.generate.mock.calls[0][0].contents);
    expect(prompt).not.toContain('"score":84');
    expect(prompt).toContain('scoreEvidence nie ma');
  });

  it.each([
    { calculatedAt: '2026-09-15T12:00:00.000Z', calculationMonth: '2026-09' },
    { calculatedAt: '2026-10-16T12:00:00.000Z', calculationMonth: '2026-10' },
    { calculatedAt: undefined, calculationMonth: '2026-10' },
    { calculatedAt: '2026-10-02T12:00:00.000Z', calculationMonth: '2026-10', atsScoreProvenance: 'canonical-v1' },
    { calculatedAt: '2026-10-02T12:00:00.000Z', calculationMonth: '2026-13' },
    { calculatedAt: '2026-10-02T12:00:00.000Z', calculationMonth: '2026-09' },
  ])('nie przekazuje nieaktualnej oceny ani braków do modelu: %j', async (metadata) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
    mocks.generate.mockResolvedValueOnce({ text: 'Uruchom analizę ponownie.', usageMetadata: {} });
    const response = await fetch(`${baseUrl}/advisor/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Jaki mam wynik?', consentToAzure: true, context: {
        atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE, ...metadata,
        score: 98, missingRequirements: ['nieaktualny wymóg testowy'],
        scoreEvidence: { detectedRequirementCount: 4, profileCompleteness: 86, careerEvidenceAvailable: true,
          unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0,
          scoreContextVersion: 5, careerEvidenceVersion: 2 },
      } }),
    });
    expect(response.status).toBe(200);
    const prompt = String(mocks.generate.mock.calls[0][0].contents);
    expect(prompt).not.toContain('"score":98');
    expect(prompt).not.toContain('nieaktualny wymóg testowy');
    vi.useRealTimers();
  });

  it('nie cytuje wyniku, którego czas dowodu różni się od czasu kontekstu', async () => {
    mocks.generate.mockResolvedValueOnce({ text: 'Brak spójnego dowodu wyniku.', usageMetadata: {} });
    const response = await fetch(`${baseUrl}/advisor/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Jaki mam wynik?', consentToAzure: true, context: {
        ...analysisMetadata, score: 98,
        scoreEvidence: { ...analysisMetadata, calculatedAt: '2020-01-01T12:00:00.000Z',
          detectedRequirementCount: 4, profileCompleteness: 86, careerEvidenceAvailable: true,
          unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0,
          scoreContextVersion: 5, careerEvidenceVersion: 2 },
      } }),
    });
    expect(response.status).toBe(200);
    expect(String(mocks.generate.mock.calls[0][0].contents)).not.toContain('"score":98');
  });

  it('odrzuca liczbe wyniku poza kanonicznym zakresem 0-100', async () => {
    mocks.generate.mockResolvedValueOnce({ text: 'Nie moge uzyc nieprawidlowej liczby.', usageMetadata: {} });
    const response = await fetch(`${baseUrl}/advisor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Jaki mam wynik?',
        context: {
          ...analysisMetadata, score: 101,
          scoreEvidence: { ...analysisMetadata, detectedRequirementCount: 4, profileCompleteness: 86, careerEvidenceAvailable: true, unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0, scoreContextVersion: 5, careerEvidenceVersion: 2 },
        },
        consentToAzure: true,
      }),
    });

    expect(response.status).toBe(200);
    const prompt = String(mocks.generate.mock.calls[0][0].contents);
    expect(prompt).not.toContain('"score":101');
    expect(prompt).toContain('"scope":"sufficient"');
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

  it('odrzuca przekraczający limit profil Trenera STAR przed pobraniem kwoty AI', async () => {
    const response = await fetch(`${baseUrl}/ai/coach-star/generate-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consentToAiProcessing: true,
        targetRole: 'r'.repeat(121),
        profileContext: { hardSkills: [], toolsAndTech: [], experience: [] },
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      error: expect.stringContaining('przekraczają dozwoloną długość'),
    });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('odrzuca błędny kształt profilu zamiast kończyć błędem serwera', async () => {
    const response = await fetch(`${baseUrl}/ai/coach-star/generate-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consentToAiProcessing: true,
        profileContext: { hardSkills: ['Windows 11'] },
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false });
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

  it.each([
    ['Zmiana wyniku -20%.', 'Zmiana wyniku +20%.'],
    ['Obsługiwałem 1 000 klientów.', 'Obsługiwałem 1 klienta.'],
  ])('odrzuca zmianę znaku lub użycie części liczby ze źródła: %s', async (source, proposed) => {
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify({ proposedText: proposed, explanation: 'Syntetyczna zmiana.', appliedRules: [] }) });
    const response = await fetch(`${baseUrl}/advisor/rewrite-section`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: source, consentToAzure: true }),
    });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ success: false });
  });

  it.each([
    ['Obsługiwałem 1000 klientów.', 'Obsługiwałem 1 000 klientów.'],
    ['Zmiana wyniku -20,5%.', 'Zmiana wyniku −20.5 %.'],
    ['Zmiana wyniku 20%.', 'Zmiana wyniku +20%.'],
  ])('zachowuje tę samą ilość przy zmianie zapisu: %s', async (source, proposed) => {
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify({ proposedText: proposed, explanation: 'Zmieniono wyłącznie zapis.', appliedRules: [] }) });
    const response = await fetch(`${baseUrl}/advisor/rewrite-section`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: source, consentToAzure: true }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, proposedText: proposed });
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

  it.each([
    null, [], true, 12, 'tekst', {},
    { proposedText: '   ', explanation: 'Opis', appliedRules: [] },
    { proposedText: 'Poprawiony punkt', explanation: '   ', appliedRules: [] },
    { proposedText: 'Poprawiony punkt', explanation: 'Opis', appliedRules: [null] },
    { proposedText: 'Poprawiony punkt', explanation: 'Opis', appliedRules: [12] },
    { proposedText: 'Poprawiony punkt', explanation: 'Opis', appliedRules: ['   '] },
  ])('odrzuca nieprawidłową strukturę JSON propozycji: %j', async (payload) => {
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify(payload) });
    const response = await fetch(`${baseUrl}/advisor/rewrite-section`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Obsługiwałem zgłoszenia klientów.', consentToAzure: true }),
    });
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, error: expect.any(String), requestId: expect.any(String) });
    expect(body).not.toHaveProperty('proposedText');
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
