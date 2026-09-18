import { describe, expect, it, beforeEach, vi } from 'vitest';
import express from 'express';
import { pdfRouter } from '../routes/pdf.routes';
import { createEmptyVault } from '../../lib/sampleVault';

const authState = vi.hoisted(() => ({ authenticated: false }));

vi.mock('../config', () => ({
  loadConfig: () => ({ backendEnabled: true }),
}));

vi.mock('../middleware/requireAuth', () => ({
  requireAuth: (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!authState.authenticated) {
      res.status(401).json({ success: false, error: 'Wymagane zalogowanie.' });
      return;
    }
    next();
  },
}));

function makeApp() {
  const app = express();
  app.use(express.json({ limit: '3mb' }));
  app.use('/api', pdfRouter);
  return app;
}

async function request(
  app: express.Express,
  body: unknown,
  path = '/api/cv/validate-ats'
): Promise<Response> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address() as { port: number };
  try {
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const validBody = {
  extractedText: 'Jan Kowalski',
  vault: { personalInfo: { fullName: 'Jan Kowalski' } },
};

describe('ochrona endpointów PDF w trybie cloud', () => {
  beforeEach(() => {
    authState.authenticated = false;
  });

  it('odrzuca anonimowe żądanie', async () => {
    const response = await request(makeApp(), validBody);
    expect(response.status).toBe(401);
  });

  it('dopuszcza uwierzytelnione żądanie do walidacji ATS', async () => {
    authState.authenticated = true;
    const response = await request(makeApp(), validBody);
    expect(response.status).toBe(200);
  });

  it('odrzuca zbyt złożone dane wejściowe', async () => {
    authState.authenticated = true;
    const response = await request(makeApp(), {
      ...validBody,
      extractedText: 'A'.repeat(200_001),
    });
    expect(response.status).toBe(400);
  });

  it('sprzątа katalog tymczasowy po nieudanym procesie Pythona', async () => {
    authState.authenticated = true;
    const previousPython = process.env.PYTHON_BIN;
    process.env.PYTHON_BIN = '__kierivo_missing_python__';
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    try {
      const response = await request(
        makeApp(),
        { vault },
        '/api/cv/export-pdf'
      );
      expect(response.status).toBe(503);
    } finally {
      if (previousPython === undefined) delete process.env.PYTHON_BIN;
      else process.env.PYTHON_BIN = previousPython;
    }
  });

  it('egzekwuje dedykowany limit wywołań', async () => {
    authState.authenticated = true;
    const app = makeApp();
    const responses = await Promise.all(
      Array.from({ length: 11 }, () => request(app, validBody))
    );
    expect(responses.at(-1)?.status).toBe(429);
  });
});
