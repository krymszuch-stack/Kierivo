import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { createEmptyVault } from '../../lib/sampleVault';
import { pdfRouter } from '../routes/pdf.routes';
import * as atsExtractModule from '../extract/atsExtract';

const SUCCESS_FIXTURE = {
  rawText: 'Adam Nowak\nTechnik Mechanik\nadam@example.pl\n+48 500 600 700\nKraków\n\nDOŚWIADCZENIE\nZremb Sp. z o.o. — Mechanik (2021-01 – 2023-12)\n- Remonty 40 przekładni zębatych rocznie\n- Diagnostyka układów pneumatycznych\n- Nadzór nad zespołem 3 osób\n\nUMIEJĘTNOŚCI\nMontaż mechaniczny, Pneumatyka, Klucze dynamometryczne\n\nWYKSZTAŁCENIE\nTechnikum Mechaniczne, Kraków (2015-2019)',
  hasActualText: true,
  hasInvisibleText: false,
};

function makeApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', pdfRouter);
  return app;
}

function startServer(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const baseUrl = `http://127.0.0.1:${(addr as { port: number }).port}`;
      resolve({ server, baseUrl });
    });
  });
}

describe('pdf.routes API Suite (unit)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { server: s, baseUrl: b } = await startServer(makeApp());
    server = s;
    baseUrl = b;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/cv/themes zwraca katalog motywów i układów', async () => {
    const res = await fetch(`${baseUrl}/api/cv/themes`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.themes)).toBe(true);
    expect(data.themes.length).toBeGreaterThanOrEqual(10);
    expect(Array.isArray(data.layouts)).toBe(true);
    expect(data.layouts.length).toBeGreaterThanOrEqual(5);
  });

  it('POST /api/cv/export-pdf odrzuca żądanie bez danych MasterVault (kod 400)', async () => {
    const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Brak wymaganych danych');
  });

  describe('POST /api/cv/export-pdf — ATS validation path', () => {
    const baseVault = () => {
      const v = createEmptyVault('Adam Nowak', 'adam@example.pl');
      v.personalInfo = {
        fullName: 'Adam Nowak',
        title: 'Technik Mechanik',
        summary: 'Doświadczony mechanik urządzeń przemysłowych.',
        email: 'adam@example.pl',
        phone: '+48 500 600 700',
        location: 'Kraków',
      };
      v.skillsMatrix = {
        hardSkills: ['Montaż mechaniczny', 'Pneumatyka'],
        toolsAndTech: ['Klucze dynamometryczne'],
        softSkills: ['Dokładność'],
        certifications: [],
      };
      v.history = [
        {
          id: 'h1',
          company: 'Zremb Sp. z o.o.',
          role: 'Mechanik',
          location: 'Kraków',
          startDate: '2021-01',
          endDate: '2023-12',
          isCurrent: false,
          highlights: [
            {
              id: 'hl1',
              text: 'Remonty 40 przekładni zębatych rocznie.',
              action: 'Remont',
              target: 'Przekładnie',
              tool: 'Narzędzia warsztatowe',
              metric: '40 szt.',
              keywords: ['Mechanika'],
            },
          ],
        },
      ];
      return v;
    };

    it('sukces 200 — runAtsExtract zwraca poprawny kształt, PDF wraca z nagłówkami ATS', async () => {
      (atsExtractModule.runAtsExtract as ReturnType<typeof vi.fn>).mockResolvedValue(SUCCESS_FIXTURE);

      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vault: baseVault(), theme: 'blueprint', layout: 'sidebar', targetPages: 1 }),
      });

      expect(res.status).toBe(200);
      // Gdy ATS validation się udaje, endpoint zwraca JSON z PDF jako base64
      expect(res.headers.get('content-type')).toContain('application/json');
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.filename).toBeDefined();
      expect(data.pdf).toBeDefined();
      expect(data.atsValidation).toBeDefined();
      expect(res.headers.get('x-ats-score')).toBeDefined();
      expect(res.headers.get('x-ats-status')).toBeDefined();
      expect(res.headers.get('x-ats-tagged')).toBeDefined();
      expect(atsExtractModule.runAtsExtract).toHaveBeenCalledTimes(1);
    });

    it('niepoprawne stdout (nie-JSON) — ATS pomijane, PDF wraca bez nagłówków ATS', async () => {
      (atsExtractModule.runAtsExtract as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ATS extraction: niepoprawny JSON na stdout: garbage'));

      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vault: baseVault(), theme: 'blueprint', layout: 'sidebar', targetPages: 1 }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('x-ats-score')).toBeNull();
      expect(res.headers.get('x-ats-status')).toBeNull();
    });

    it('non-zero exit code — ATS pomijane, PDF wraca bez nagłówków ATS', async () => {
      (atsExtractModule.runAtsExtract as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ATS extraction failed (code 1): ModuleNotFoundError'));

      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vault: baseVault(), theme: 'blueprint', layout: 'sidebar', targetPages: 1 }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('x-ats-score')).toBeNull();
    });

    it('brak Pythona (ENOENT) — 503 z komunikatem o niedostępności', async () => {
      (atsExtractModule.runAtsExtract as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Python interpreter not found'));

      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vault: baseVault(), theme: 'blueprint', layout: 'sidebar', targetPages: 1 }),
      });

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('ATS validation unavailable');
    });
  });
});

describe.skipIf(!process.env.RUN_PDF_INTEGRATION)('pdf.routes API Suite (integration)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { server: s, baseUrl: b } = await startServer(makeApp());
    server = s;
    baseUrl = b;
  }, 30_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('POST /api/cv/export-pdf generuje poprawny PDF z prawdziwym Pythonem (timeout 30s)', async () => {
    const vault = createEmptyVault('Test User', 'test@example.pl');
    vault.personalInfo = {
      fullName: 'Test User',
      title: 'Engineer',
      summary: 'Test summary',
      email: 'test@example.pl',
      phone: '+48 500 600 700',
      location: 'Warszawa',
    };
    vault.skillsMatrix = {
      hardSkills: ['TypeScript', 'Node.js'],
      toolsAndTech: ['Vitest'],
      softSkills: ['Communication'],
      certifications: [],
    };
    vault.history = [
      {
        id: 'h1',
        company: 'Test Corp',
        role: 'Engineer',
        location: 'Warszawa',
        startDate: '2022-01',
        endDate: '2024-12',
        isCurrent: false,
        highlights: [{ id: 'hl1', text: 'Built stuff.', action: 'Built', target: 'Stuff', tool: 'Code', metric: '100%', keywords: ['TypeScript'] }],
      },
    ];

    const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vault, theme: 'classic', layout: 'single', targetPages: 1 }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');

    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);
    const magic = new TextDecoder('ascii').decode(new Uint8Array(buffer.slice(0, 5)));
    expect(magic).toBe('%PDF-');
  }, 30_000);
});