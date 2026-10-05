import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createEmptyVault } from '../../lib/sampleVault';
import {
  pdfRouter,
  pythonRunner,
  clearPdfCacheForTesting,
  AVAILABLE_LAYOUTS,
} from '../routes/pdf.routes';
import { pdfEndpointsLimiter } from '../middleware/rateLimiter';
import * as atsExtractModule from '../extract/atsExtract';

const SUCCESS_FIXTURE = {
  rawText:
    'Adam Nowak\nTechnik Mechanik\nadam@example.pl\n+48 500 600 700\nKraków\n\nDOŚWIADCZENIE\nZremb Sp. z o.o. — Mechanik (2021-01 – 2023-12)\n- Remonty 40 przekładni zębatych rocznie\n- Diagnostyka układów pneumatycznych\n- Nadzór nad zespołem 3 osób\n\nUMIEJĘTNOŚCI\nMontaż mechaniczny, Pneumatyka, Klucze dynamometryczne\n\nWYKSZTAŁCENIE\nTechnikum Mechaniczne, Kraków (2015-2019)',
  hasActualText: true,
  hasInvisibleText: false,
};

function makeApp() {
  const app = express();
  app.use((req, res, next) => {
    const incomingId = req.headers['x-request-id'];
    const requestId =
      typeof incomingId === 'string' && incomingId.trim().length > 0
        ? incomingId.trim()
        : 'req-test-uuid-1234';
    (req as unknown as { requestId: string }).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });
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
    pdfEndpointsLimiter.reset();
    clearPdfCacheForTesting();
    vi.clearAllMocks();
  });

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

  describe('Kody błędów i rozróżnienie (400, 503, 504, 500)', () => {
    it('400 — odrzuca brak danych MasterVault lub brak personalInfo', async () => {
      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-missing-vault-400',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.requestId).toBe('req-missing-vault-400');
      expect(data.error).toContain('Brak wymaganych danych MasterVault');
    });

    it('400 — odrzuca nieprawidłowy motyw PDF', async () => {
      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-invalid-theme-400',
        },
        body: JSON.stringify({
          vault: baseVault(),
          theme: 'nieistniejacy-motyw-xyz',
          layout: 'sidebar',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.requestId).toBe('req-invalid-theme-400');
      expect(data.error).toContain('Nieprawidłowy motyw PDF');
    });

    it('400 — odrzuca nieprawidłowy układ PDF', async () => {
      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-invalid-layout-400',
        },
        body: JSON.stringify({
          vault: baseVault(),
          theme: 'parchment',
          layout: 'nieistniejacy-layout-xyz',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.requestId).toBe('req-invalid-layout-400');
      expect(data.error).toContain('Nieprawidłowy układ PDF');
    });

    it('503 — gdy interpreter Pythona jest niedostępny (ENOENT)', async () => {
      vi.spyOn(pythonRunner, 'spawn').mockRejectedValueOnce(
        new Error('Python interpreter not found')
      );

      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-no-python-503',
        },
        body: JSON.stringify({
          vault: baseVault(),
          theme: 'parchment',
          layout: 'sidebar',
        }),
      });

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.requestId).toBe('req-no-python-503');
      expect(data.error).toContain('brak interpretera Pythona');
    });

    it('503 — gdy proces zakończy się brakiem zależności (ModuleNotFoundError)', async () => {
      vi.spyOn(pythonRunner, 'spawn').mockResolvedValueOnce({
        code: 1,
        stdout: '',
        stderr: "ModuleNotFoundError: No module named 'reportlab'",
        durationMs: 40,
      });

      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-missing-dep-503',
        },
        body: JSON.stringify({
          vault: baseVault(),
          theme: 'parchment',
          layout: 'sidebar',
        }),
      });

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.requestId).toBe('req-missing-dep-503');
      expect(data.error).toContain('brak wymaganych modułów Pythona');
      expect(data.error).toContain('reportlab');
    });

    it('504 — gdy proces Pythona przekroczy dopuszczalny limit czasu', async () => {
      vi.spyOn(pythonRunner, 'spawn').mockRejectedValueOnce(
        new Error('Proces Pythona przekroczył limit czasu (90000ms).')
      );

      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-timeout-504',
        },
        body: JSON.stringify({
          vault: baseVault(),
          theme: 'parchment',
          layout: 'sidebar',
        }),
      });

      expect(res.status).toBe(504);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.requestId).toBe('req-timeout-504');
      expect(data.error).toContain('limit czasu');
    });

    it('500 — gdy renderer zgłosi błąd wykonania (kod != 0, np. syntax/crash)', async () => {
      vi.spyOn(pythonRunner, 'spawn').mockResolvedValueOnce({
        code: 2,
        stdout: '',
        stderr: 'ReportLab Canvas Error: Page layout overflow exception at line 44',
        durationMs: 80,
      });

      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-renderer-crash-500',
        },
        body: JSON.stringify({
          vault: baseVault(),
          theme: 'parchment',
          layout: 'sidebar',
        }),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.requestId).toBe('req-renderer-crash-500');
      expect(data.error).toContain('Błąd silnika renderowania PDF');
      expect(data.error).toContain('Page layout overflow');
    });
  });

  describe('Sukces (200) i poprawny format odpowiedzi', () => {
    // Osobny krok CI ustawia tę flagę po instalacji silnika; pozostałe
    // workflowy testują kontrakt trasy bez wymagania środowiska Python.
    it.runIf(process.env.RUN_PDF_INTEGRATION === '1')('rzeczywisty renderer zwraca PDF z ręcznie poprawionym nagłówkiem i podsumowaniem', async () => {
      // ATS jest tu odizolowany od testu renderowania. Trasa, adapter oraz
      // proces Python/ReportLab/pikepdf pozostają prawdziwe.
      vi.spyOn(atsExtractModule, 'runAtsExtract').mockResolvedValueOnce(SUCCESS_FIXTURE);

      const vault = baseVault();
      const tailoredResume = {
        targetJobTitle: 'Ręczny tytuł testowy',
        companyName: '',
        summary: 'Ręczne podsumowanie testowe bez dopisanych osiągnięć.',
        selectedHighlights: [],
        skillsMatched: { hardSkills: [], toolsAndTech: [], softSkills: [] },
        atsScore: 0,
      };

      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req-real-pdf-manual-edit' },
        body: JSON.stringify({ vault, tailoredResume, theme: 'classic', layout: 'sidebar' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json() as { success: boolean; pdf: string; filename: string };
      expect(data.success).toBe(true);
      expect(data.filename).toBe('CV_Adam_Nowak.pdf');

      const pdfBytes = Buffer.from(data.pdf, 'base64');
      expect(pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      const loadingTask = getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true });
      const parsed = await loadingTask.promise;
      const extracted = (await Promise.all(
        Array.from({ length: parsed.numPages }, async (_, index) => {
          const page = await parsed.getPage(index + 1);
          const content = await page.getTextContent();
          return content.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ');
        })
      )).join('\n');
      await loadingTask.destroy();

      // Wybrany motyw drukuje nagłówki z odstępem między glifami; porównujemy
      // znormalizowaną formę tytułu, a podsumowanie zachowuje zwykłe odstępy.
      expect(extracted.replace(/\s+/g, '').toLocaleLowerCase('pl-PL'))
        .toContain('ręcznytytułtestowy');
      expect(extracted).toContain('Ręczne podsumowanie testowe bez dopisanych osiągnięć.');
      expect(extracted).not.toContain('Doświadczony mechanik urządzeń przemysłowych.');
    }, 30_000);

    it('sukces 200 ze zmockowanym procesem Pythona — zwraca JSON z base64 i requestId', async () => {
      vi.spyOn(atsExtractModule, 'runAtsExtract').mockResolvedValueOnce(SUCCESS_FIXTURE);

      vi.spyOn(pythonRunner, 'spawn').mockImplementationOnce(async (_bin, args) => {
        // args[4] to ścieżka pliku outPdfPath (-o <path>)
        const outPdfIndex = args.indexOf('-o');
        const outPdfPath = args[outPdfIndex + 1];
        await fs.writeFile(outPdfPath, Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Test CV) >>\nendobj\n%%EOF'));
        return { code: 0, stdout: 'OK', stderr: '', durationMs: 25 };
      });

      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-success-200',
        },
        body: JSON.stringify({
          vault: baseVault(),
          theme: 'parchment',
          layout: 'sidebar',
          targetPages: 1,
        }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(res.headers.get('x-request-id')).toBe('req-success-200');
      expect(res.headers.has('x-ats-score')).toBe(false);
      expect(res.headers.has('x-ats-status')).toBe(false);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.requestId).toBe('req-success-200');
      expect(data.filename).toBe('CV_Adam_Nowak.pdf');
      expect(typeof data.pdf).toBe('string');

      // Dekodujemy base64 i sprawdzamy nagłówek %PDF
      const pdfText = Buffer.from(data.pdf, 'base64').toString('ascii');
      expect(pdfText.startsWith('%PDF-')).toBe(true);
      expect(data.atsValidation).toBeDefined();
      expect(data.atsValidation).not.toHaveProperty('overallScore');
      expect(data.atsValidation).not.toHaveProperty('overallStatus');
      expect(data.atsValidation.vendors.every((vendor: Record<string, unknown>) =>
        !Object.hasOwn(vendor, 'parseScore') && !Object.hasOwn(vendor, 'status')
      )).toBe(true);
    });

    it('zwraca i zachowuje w cache ostrzeżenie o treści pominiętej przez limit stron', async () => {
      vi.spyOn(atsExtractModule, 'runAtsExtract').mockResolvedValue(SUCCESS_FIXTURE);
      const spawn = vi.spyOn(pythonRunner, 'spawn').mockImplementationOnce(async (_bin, args) => {
        const outPdfPath = args[args.indexOf('-o') + 1];
        await fs.writeFile(outPdfPath, Buffer.from('%PDF-1.4\n%%EOF'));
        await fs.writeFile(outPdfPath.replace(/\.pdf$/, '.semantic.json'), JSON.stringify({
          governance: {
            summary_truncated: true,
            skills_dropped: 2,
            exp_dropped: 3,
            bullets_dropped: 4,
          },
        }));
        return { code: 0, stdout: 'OK', stderr: '', durationMs: 25 };
      });
      const body = JSON.stringify({ vault: baseVault(), theme: 'parchment', layout: 'sidebar', targetPages: 2 });
      const request = () => fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const first = await request();
      const firstData = await first.json();
      expect(first.status).toBe(200);
      expect(firstData.contentWarnings).toEqual([
        'Silnik dopasował CV do limitu 2 stron i pominął część treści (umiejętności: 2, wpisy doświadczenia: 3, punkty doświadczenia: 4, skrócono podsumowanie zawodowe). Sprawdź pobrany dokument przed wysłaniem.',
      ]);
      expect(first.headers.get('x-cv-content-warnings')).toBe(encodeURIComponent(firstData.contentWarnings[0]));

      const cached = await request();
      const cachedData = await cached.json();
      expect(cached.headers.get('x-cv-cache')).toBe('HIT');
      expect(cached.headers.get('x-cv-content-warning-count')).toBe('1');
      expect(cached.headers.get('x-cv-content-warnings')).toBe(encodeURIComponent(firstData.contentWarnings[0]));
      expect(cachedData.contentWarnings).toEqual(firstData.contentWarnings);
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('nie używa pliku z cache bez wybranego zdjęcia przy eksporcie z avatarem', async () => {
      vi.spyOn(atsExtractModule, 'runAtsExtract').mockResolvedValue(SUCCESS_FIXTURE);
      const spawn = vi.spyOn(pythonRunner, 'spawn').mockImplementation(async (_bin, args) => {
        const outPdfPath = args[args.indexOf('-o') + 1];
        await fs.writeFile(outPdfPath, Buffer.from(`%PDF-1.4\n% avatar=${args.includes('--avatar')}\n%%EOF`));
        return { code: 0, stdout: 'OK', stderr: '', durationMs: 10 };
      });
      const vault = baseVault();
      const exportPdf = (avatar?: 'circle' | 'square' | 'none') => fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vault,
          theme: 'parchment',
          layout: 'sidebar',
          ...(avatar ? { avatar } : {}),
        }),
      });

      const withoutAvatar = await exportPdf('none');
      const withAvatar = await exportPdf('circle');
      const firstPdf = Buffer.from(((await withoutAvatar.json()) as { pdf: string }).pdf, 'base64').toString();
      const secondPdf = Buffer.from(((await withAvatar.json()) as { pdf: string }).pdf, 'base64').toString();

      expect(withoutAvatar.headers.get('x-cv-cache')).toBe('MISS');
      expect(withAvatar.headers.get('x-cv-cache')).toBe('MISS');
      expect(spawn).toHaveBeenCalledTimes(2);
      expect(spawn.mock.calls[1]?.[1]).toContain('--avatar');
      expect(firstPdf).toContain('avatar=false');
      expect(secondPdf).toContain('avatar=true');
    });

    it('do silnika PDF przekazuje umiejętności bez dopisanych twierdzeń o doświadczeniu', async () => {
      vi.spyOn(atsExtractModule, 'runAtsExtract').mockResolvedValueOnce(SUCCESS_FIXTURE);
      const vault = baseVault();
      vault.skillsMatrix.hardSkills = ['SQL'];
      vault.skillsMatrix.toolsAndTech = ['Docker'];
      vault.skillsMatrix.softSkills = ['Komunikacja techniczna'];
      vault.skillsMatrix.certifications = [{ id: 'cert-1', name: 'Certyfikat XYZ', issuer: '', date: '' }];

      vi.spyOn(pythonRunner, 'spawn').mockImplementationOnce(async (_bin, args) => {
        // Czytamy payload przed sprzątnięciem katalogu tymczasowego w finally trasy.
        const profile = JSON.parse(await fs.readFile(args[3], 'utf8')) as {
          skills: Array<{ label: string; semantic: string }>;
          certifications: Array<{ name: string; semantic: string }>;
        };
        expect(profile.skills.map((skill) => skill.semantic)).toEqual(['SQL', 'Docker', 'Komunikacja techniczna']);
        expect(profile.certifications[0]).toMatchObject({ name: 'Certyfikat XYZ', semantic: 'Certyfikat XYZ' });

        const outPdfPath = args[args.indexOf('-o') + 1];
        await fs.writeFile(outPdfPath, Buffer.from('%PDF-1.4\n%%EOF'));
        return { code: 0, stdout: 'OK', stderr: '', durationMs: 10 };
      });

      const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req-truthful-semantic-pdf' },
        body: JSON.stringify({ vault, theme: 'parchment', layout: 'sidebar' }),
      });

      expect(res.status).toBe(200);
    });
  });

  describe('Smoke test — każdy dostępny layout zwraca poprawny PDF z nagłówkiem %PDF', () => {
    for (const layout of AVAILABLE_LAYOUTS) {
      it(`smoke: layout "${layout.id}" (${layout.name}) daje PDF z nagłówkiem %PDF-`, async () => {
        vi.spyOn(atsExtractModule, 'runAtsExtract').mockResolvedValueOnce(SUCCESS_FIXTURE);

        vi.spyOn(pythonRunner, 'spawn').mockImplementationOnce(async (_bin, args) => {
          const outPdfIndex = args.indexOf('-o');
          const outPdfPath = args[outPdfIndex + 1];
          // Generujemy weryfikowalny bufor PDF
          await fs.writeFile(
            outPdfPath,
            Buffer.from(`%PDF-1.4\n% layout=${layout.id}\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF`)
          );
          return { code: 0, stdout: 'Smoke layout OK', stderr: '', durationMs: 15 };
        });

        const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': `req-smoke-layout-${layout.id}`,
          },
          body: JSON.stringify({
            vault: baseVault(),
            theme: 'classic',
            layout: layout.id,
            targetPages: 1,
          }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.requestId).toBe(`req-smoke-layout-${layout.id}`);
        expect(typeof data.pdf).toBe('string');

        const pdfHeader = Buffer.from(data.pdf, 'base64').toString('ascii', 0, 5);
        expect(pdfHeader).toBe('%PDF-');
      });
    }
  });
});
