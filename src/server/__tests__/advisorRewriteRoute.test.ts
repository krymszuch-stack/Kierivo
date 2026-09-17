import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import { Server } from 'http';
import { aiRouter } from '../routes/ai.routes';
import { errorHandler } from '../middleware/errorHandler';
import { resetConfigCacheForTesting } from '../config';

describe('POST /api/advisor/rewrite-section', () => {
  let app: Express;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.BACKEND_MODE = 'local';
    resetConfigCacheForTesting();

    app = express();
    app.use(express.json());
    app.use('/api', aiRouter);
    app.use(errorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    resetConfigCacheForTesting();
    vi.restoreAllMocks();
  });

  it('odrzuca żądanie, jeśli przekazano pole vault (twarda ochrona minimalizacji danych)', async () => {
    const res = await fetch(`${baseUrl}/api/advisor/rewrite-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Zajmowałem się montażem instalacji.',
        vault: { personalInfo: { fullName: 'Jan Kowalski' } },
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Endpoint rewritingu przyjmuje wyłącznie pojedynczy fragment tekstu');
  });

  it('odrzuca żądanie, jeśli tekst przekracza 800 znaków', async () => {
    const longText = 'A'.repeat(850);
    const res = await fetch(`${baseUrl}/api/advisor/rewrite-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: longText }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('800 znaków');
  });

  it('odrzuca pusty lub zbyt krótki tekst', async () => {
    const res = await fetch(`${baseUrl}/api/advisor/rewrite-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'abc' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('generuje ulepszoną propozycję STAR z wyjaśnieniem regułowym dla pojedynczego bulletu', async () => {
    const res = await fetch(`${baseUrl}/api/advisor/rewrite-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Byłem odpowiedzialny za montaż rur i usuwanie awarii hydraulicznych.',
        roleTitle: 'Monter instalacji sanitarnych',
        sectionType: 'bullet',
        ruleFocus: 'star',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.originalText).toContain('Byłem odpowiedzialny za montaż');
    expect(data.proposedText).toContain('Zmontowałem i uruchomiłem');
    expect(data.proposedText).not.toContain('Byłem odpowiedzialny za');
    expect(data.appliedRules).toEqual(expect.arrayContaining(['Mocny czasownik dokonany', 'Struktura STAR (Akcja + Rezultat)']));
    expect(data.ruleExplanation).toBeTruthy();
    expect(data.diffHighlights).toBeDefined();
    expect(Array.isArray(data.diffHighlights.addedOrChanged)).toBe(true);
  });
});
