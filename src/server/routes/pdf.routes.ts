/**
 * Trasy generowania dwuwarstwowego PDF (Dual-Layer Semantic PDF).
 *
 * Endpoint integruje silnik `mvcv` (Python / ReportLab / pikepdf) z backendem
 * Express w Kierivo, dostarczając gotowy plik PDF z pełnym Tagged PDF,
 * semantyką /ActualText oraz metadanymi XMP JSON-LD Schema.org/Person.
 */

import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import { createHash, randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { adaptMasterVaultToSemanticProfile } from '../../lib/semanticPdfAdapter';
import { validatePdfTextForAts } from '../../lib/atsPdfValidator';
import { runAtsExtract } from '../extract/atsExtract';
import { MasterVault, TailoredResume } from '../../types';

export const pdfRouter = Router();

/**
 * Maksymalny czas oczekiwania na proces Pythona (pdfminer / mvcv).
 * 60s na PDF + 30s marginesu na zimny start kontenera.
 */
const PYTHON_TIMEOUT_MS = 90_000;

export interface PythonSpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * Bezpieczne logowanie etapów eksportu PDF.
 * Zgodnie z wytycznymi bezpieczeństwa Kierivo:
 * NIGDY nie loguje treści CV, danych osobowych (PII) ani tokenów.
 */
export function logPdfExportStage(params: {
  requestId: string;
  stage:
    | 'received'
    | 'validated'
    | 'adapted'
    | 'spawning_python'
    | 'python_finished'
    | 'ats_validated'
    | 'completed'
    | 'failed';
  theme?: string;
  layout?: string;
  targetPages?: number;
  pdfType?: string;
  pythonSpawned: boolean;
  exitCode?: number | null;
  durationMs?: number;
  statusCode?: number;
  errorMessage?: string;
}): void {
  const parts = [
    `[PDF Export] requestId=${params.requestId}`,
    `stage=${params.stage}`,
    `theme=${params.theme || 'unknown'}`,
    `layout=${params.layout || 'unknown'}`,
    `targetPages=${params.targetPages ?? 1}`,
    `pdfType=${params.pdfType || 'dual-layer'}`,
    `pythonSpawned=${params.pythonSpawned}`,
  ];
  if (params.exitCode !== undefined && params.exitCode !== null) {
    parts.push(`exitCode=${params.exitCode}`);
  }
  if (params.durationMs !== undefined) {
    parts.push(`durationMs=${params.durationMs}ms`);
  }
  if (params.statusCode !== undefined) {
    parts.push(`statusCode=${params.statusCode}`);
  }
  if (params.errorMessage) {
    const sanitizedError = params.errorMessage.replace(/[\r\n]+/g, ' ').slice(0, 300);
    parts.push(`error="${sanitizedError}"`);
  }

  console.log(parts.join(' '));
}

/**
 * Wywołuje Pythona z timeoutem i natychmiastowym odrzuceniem gdy brak interpretera.
 *
 * Zwraca { code, stdout, stderr, durationMs }. Timeout odrzuca Promise z błędem opisowym.
 * ENOENT (Python nie znaleziony) odrzuca z `Python interpreter not found`.
 */
export function spawnPythonWithTimeout(
  bin: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number = PYTHON_TIMEOUT_MS
): Promise<PythonSpawnResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(bin, args, { cwd, env });
    } catch (spawnErr) {
      if ((spawnErr as NodeJS.ErrnoException).code === 'ENOENT') {
        return reject(new Error('Python interpreter not found'));
      }
      return reject(spawnErr);
    }

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
      reject(new Error(`Proces Pythona przekroczył limit czasu (${timeoutMs}ms).`));
    }, timeoutMs);

    proc.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (killed) return;
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      resolve({ code, stdout, stderr, durationMs });
    });

    proc.on('error', (err) => {
      if (killed) return;
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('Python interpreter not found'));
      } else {
        reject(new Error(`Nie udało się uruchomić Pythona: ${err.message}`));
      }
    });
  });
}

export const pythonRunner = {
  spawn: spawnPythonWithTimeout,
};

interface CachedPdfEntry {
  buffer: Buffer;
  filename: string;
  theme: string;
  layout: string;
  timestamp: number;
}

const PDF_CACHE_MAX_ENTRIES = 50;
const PDF_CACHE_TTL_MS = 30 * 60 * 1000;
const pdfCache = new Map<string, CachedPdfEntry>();

export function pruneExpiredPdfCache(): void {
  const now = Date.now();
  for (const [key, entry] of pdfCache.entries()) {
    if (now - entry.timestamp > PDF_CACHE_TTL_MS) {
      pdfCache.delete(key);
    }
  }
}

export function clearPdfCacheForTesting(): void {
  pdfCache.clear();
}

export interface ExportPdfRequestBody {
  vault: MasterVault;
  tailoredResume?: TailoredResume | null;
  theme?: string;
  layout?: string;
  targetPages?: number;
  avatar?: 'circle' | 'square' | 'none';
  summaryOverride?: string;
  targetRole?: string;
  companyName?: string;
  pdfType?: 'standard' | 'dual-layer';
}

export const AVAILABLE_THEMES = [
  { id: 'parchment', name: 'Parchment Warm', accent: '#7c3aed', bg: '#fbf9f5', font: 'Serif', desc: 'Klasyczna elegancja, pergaminowe tło' },
  { id: 'editorial', name: 'Editorial Slate', accent: '#1d4ed8', bg: '#fcfcfc', font: 'Serif', desc: 'Prestiżowy magazynowy layout' },
  { id: 'cobalt', name: 'Cobalt Pro', accent: '#2563eb', bg: '#f8fafc', font: 'Sans', desc: 'Nowoczesny, wyrazisty błękit inżynierski' },
  { id: 'blueprint', name: 'Blueprint Technical', accent: '#0284c7', bg: '#f0f9ff', font: 'Sans', desc: 'Techniczny, precyzyjny styl dla inżynierów' },
  { id: 'coral', name: 'Coral Modern', accent: '#ea580c', bg: '#fffaf5', font: 'Sans', desc: 'Świeży, energetyczny akcent koralowy' },
  { id: 'sand', name: 'Sand Minimal', accent: '#d97706', bg: '#faf7f2', font: 'Sans', desc: 'Ciepły minimalizm o wysokiej czytelności' },
  { id: 'classic', name: 'Classic Monochrome', accent: '#111827', bg: '#ffffff', font: 'Serif', desc: 'Tradycyjna czerń i biel (100% formalny)' },
  { id: 'graphite', name: 'Graphite Dark Tint', accent: '#059669', bg: '#f3f4f6', font: 'Sans', desc: 'Techniczny szary z akcentem szmaragdowym' },
  { id: 'ink', name: 'Ink & Paper', accent: '#0f172a', bg: '#ffffff', font: 'Serif', desc: 'Monochromatyczny krój szeryfowy z ostrym kontrastem' },
  { id: 'teal', name: 'Teal Nordic', accent: '#0d9488', bg: '#f0fdfa', font: 'Sans', desc: 'Skandynawska przejrzystość i morski akcent' },
  { id: 'navy', name: 'Corporate Navy', accent: '#1e3a8a', bg: '#ffffff', font: 'Sans', desc: 'Konserwatywny granat dla kadry zarządzającej' },
  { id: 'olive', name: 'Olive Industry', accent: '#65a30d', bg: '#f7fee7', font: 'Sans', desc: 'Spokojny, rzemieślniczy akcent oliwkowy' },
  { id: 'charlotte', name: 'Charlotte Editorial', accent: '#8b5cf6', bg: '#ffffff', font: 'Serif', desc: 'Elegancka typografia szeryfowa z fioletem' },
  { id: 'zyra', name: 'Zyra Clean', accent: '#7c4d7e', bg: '#ffffff', font: 'Serif', desc: 'Subtelny róż z fioletem i harmonijnym tłem' },
  { id: 'slate', name: 'Slate Executive', accent: '#475569', bg: '#f8fafc', font: 'Sans', desc: 'Dyskretny, formalny styl grafitowy' },
  { id: 'gridline', name: 'Gridline Engineering', accent: '#0284c7', bg: '#ffffff', font: 'Sans', desc: 'Wyraźne linie podziału i techniczny sznyt' },
];

export const AVAILABLE_LAYOUTS = [
  { id: 'sidebar', name: 'Sidebar lewy (32/68)', kind: 'sidebar', desc: 'Rekomendowany standard dla 1-stronicowego CV' },
  { id: 'sidebar-right', name: 'Sidebar prawy (65/35)', kind: 'sidebar', desc: 'Główna treść z lewej, dane kontaktowe i skille z prawej' },
  { id: 'banner-sidebar', name: 'Banner + Sidebar', kind: 'sidebar', desc: 'Pełny nagłówek na całą szerokość u góry strony' },
  { id: 'two-column', name: 'Dwie równe kolumny', kind: 'sidebar', desc: 'Zbalansowany podział 48% / 52%' },
  { id: 'single', name: 'Jedna kolumna (Strict ATS)', kind: 'single', desc: 'Tradycyjny układ liniowy bez podziału na kolumny' },
];

/**
 * GET /api/cv/themes
 * Katalog motywów wizualnych i layoutów A4.
 */
pdfRouter.get('/cv/themes', (_req: Request, res: Response) => {
  res.json({
    success: true,
    themes: AVAILABLE_THEMES,
    layouts: AVAILABLE_LAYOUTS,
  });
});

/**
 * POST /api/cv/validate-ats
 * Waliduje wyekstrahowany tekst PDF pod kątem kompatybilności z 5 ATS-ami.
 * Nie generuje PDF — przyjmuje surowy tekst i dane MasterVault.
 */
pdfRouter.post(
  '/cv/validate-ats',
  async (
    req: Request<unknown, unknown, { extractedText: string; vault: MasterVault; vendorIds?: string[] }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { extractedText, vault, vendorIds } = req.body;

      if (!extractedText || typeof extractedText !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Wymagany jest extractedText (surowy tekst ekstrahowany z PDF).',
        });
      }

      if (!vault || !vault.personalInfo) {
        return res.status(400).json({
          success: false,
          error: 'Wymagany jest vault (MasterVault) do porównania.',
        });
      }

      const report = await validatePdfTextForAts(extractedText, vault, { vendorIds });

      res.json({
        success: true,
        report,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/cv/export-pdf
 * Generuje dwuwarstwowy plik PDF z profilu MasterVault.
 */
pdfRouter.post(
  '/cv/export-pdf',
  async (req: Request<unknown, unknown, ExportPdfRequestBody>, res: Response) => {
    const reqWithId = req as unknown as { requestId?: string };
    const requestId =
      reqWithId.requestId ||
      (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].trim().length > 0
        ? req.headers['x-request-id'].trim()
        : randomUUID());

    let tempDir = '';
    const {
      vault,
      tailoredResume,
      theme = 'parchment',
      layout = 'sidebar',
      targetPages = 1,
      avatar,
      summaryOverride,
      targetRole,
      companyName,
      pdfType = 'dual-layer',
    } = req.body || {};

    const safeTargetPages = Math.min(Math.max(Number(targetPages) || 1, 1), 2);

    logPdfExportStage({
      requestId,
      stage: 'received',
      theme,
      layout,
      targetPages: safeTargetPages,
      pdfType,
      pythonSpawned: false,
    });

    try {
      // 1. Walidacja danych wejściowych (KOD 400)
      if (!vault || typeof vault !== 'object' || !vault.personalInfo || typeof vault.personalInfo !== 'object') {
        const errorMsg = 'Brak wymaganych danych MasterVault do wygenerowania CV.';
        logPdfExportStage({
          requestId,
          stage: 'failed',
          theme,
          layout,
          targetPages: safeTargetPages,
          pythonSpawned: false,
          statusCode: 400,
          errorMessage: errorMsg,
        });
        return res.status(400).json({
          success: false,
          requestId,
          error: errorMsg,
        });
      }

      const validThemeIds = new Set(AVAILABLE_THEMES.map((t) => t.id));
      const validLayoutIds = new Set(AVAILABLE_LAYOUTS.map((l) => l.id));

      if (theme && !validThemeIds.has(theme)) {
        const errorMsg = `Nieprawidłowy motyw PDF: ${theme}. Dostępne motywy: ${AVAILABLE_THEMES.map((t) => t.id).join(', ')}`;
        logPdfExportStage({
          requestId,
          stage: 'failed',
          theme,
          layout,
          targetPages: safeTargetPages,
          pythonSpawned: false,
          statusCode: 400,
          errorMessage: errorMsg,
        });
        return res.status(400).json({
          success: false,
          requestId,
          error: errorMsg,
        });
      }

      if (layout && !validLayoutIds.has(layout)) {
        const errorMsg = `Nieprawidłowy układ PDF: ${layout}. Dostępne układy: ${AVAILABLE_LAYOUTS.map((l) => l.id).join(', ')}`;
        logPdfExportStage({
          requestId,
          stage: 'failed',
          theme,
          layout,
          targetPages: safeTargetPages,
          pythonSpawned: false,
          statusCode: 400,
          errorMessage: errorMsg,
        });
        return res.status(400).json({
          success: false,
          requestId,
          error: errorMsg,
        });
      }

      logPdfExportStage({
        requestId,
        stage: 'validated',
        theme,
        layout,
        targetPages: safeTargetPages,
        pythonSpawned: false,
      });

      // 2. Pamięć podręczna SHA-256 (błyskawiczny response < 2ms dla tych samych parametrów)
      const cacheKey = createHash('sha256')
        .update(
          JSON.stringify({
            vault,
            tailoredResume,
            theme,
            layout,
            targetPages: safeTargetPages,
            summaryOverride,
            targetRole,
            companyName,
            pdfType,
          })
        )
        .digest('hex');

      pruneExpiredPdfCache();
      const cached = pdfCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp <= PDF_CACHE_TTL_MS) {
        logPdfExportStage({
          requestId,
          stage: 'completed',
          theme: cached.theme,
          layout: cached.layout,
          targetPages: safeTargetPages,
          pythonSpawned: false,
          statusCode: 200,
        });

        res.setHeader('X-Request-Id', requestId);
        res.setHeader('X-CV-Theme', cached.theme);
        res.setHeader('X-CV-Layout', cached.layout);
        res.setHeader('X-CV-Cache', 'HIT');

        if (req.headers.accept === 'application/pdf') {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cached.filename)}"`);
          return res.send(cached.buffer);
        }

        res.setHeader('Content-Type', 'application/json');
        return res.json({
          success: true,
          requestId,
          filename: cached.filename,
          pdf: cached.buffer.toString('base64'),
          atsValidation: null,
        });
      }

      // 3. Adapter: konwersja danych z Kierivo na kontrakt mvcv MasterProfile
      const profilePayload = adaptMasterVaultToSemanticProfile(vault, tailoredResume, {
        summaryOverride,
        targetRole,
        companyName,
      });

      logPdfExportStage({
        requestId,
        stage: 'adapted',
        theme,
        layout,
        targetPages: safeTargetPages,
        pythonSpawned: false,
      });

      // 4. Przygotowanie izolowanego katalogu tymczasowego
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kierivo-cv-'));
      const profileJsonPath = path.join(tempDir, 'profile.json');
      const outPdfPath = path.join(tempDir, 'cv.pdf');

      // Obsługa zdjęcia kandydata (dekodowanie data URI / base64 do pliku tymczasowego)
      if (profilePayload.photo && typeof profilePayload.photo === 'string') {
        const rawPhoto = profilePayload.photo.trim();
        const dataUriMatch = rawPhoto.match(/^data:([A-Za-z-+/]+);base64,(.+)$/s);
        if (dataUriMatch) {
          const mime = dataUriMatch[1].toLowerCase();
          const ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
          const photoPath = path.join(tempDir, `avatar${ext}`);
          try {
            const photoBuffer = Buffer.from(dataUriMatch[2], 'base64');
            await fs.writeFile(photoPath, photoBuffer);
            profilePayload.photo = photoPath;
          } catch {
            profilePayload.photo = '';
          }
        } else if (!existsSync(rawPhoto)) {
          profilePayload.photo = '';
        }
      }

      await fs.writeFile(profileJsonPath, JSON.stringify(profilePayload, null, 2), 'utf-8');

      // 5. Ścieżka do silnika `mastervault-cv` (KOD 503 gdy katalog nie istnieje)
      const engineDir = path.resolve(process.cwd(), 'mastervault-cv');
      if (!existsSync(engineDir)) {
        const errorMsg = 'Eksport PDF niedostępny: silnik renderowania mastervault-cv nie został odnaleziony w systemie.';
        logPdfExportStage({
          requestId,
          stage: 'failed',
          theme,
          layout,
          targetPages: safeTargetPages,
          pythonSpawned: false,
          statusCode: 503,
          errorMessage: errorMsg,
        });
        return res.status(503).json({
          success: false,
          requestId,
          error: errorMsg,
        });
      }

      // 6. Uruchomienie pipeline'u Pythona
      const args = [
        '-m',
        'mvcv',
        'export',
        profileJsonPath,
        '-o',
        outPdfPath,
        '--theme',
        theme,
        '--layout',
        layout,
        '--target-pages',
        String(safeTargetPages),
      ];

      if (avatar && avatar !== 'none') {
        args.push('--avatar', avatar);
      }

      const pythonBin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

      logPdfExportStage({
        requestId,
        stage: 'spawning_python',
        theme,
        layout,
        targetPages: safeTargetPages,
        pythonSpawned: true,
      });

      let pythonResult: PythonSpawnResult;
      try {
        pythonResult = await pythonRunner.spawn(
          pythonBin,
          args,
          engineDir,
          { ...process.env, PYTHONPATH: engineDir, PYTHONIOENCODING: 'utf-8' }
        );
      } catch (spawnErr: unknown) {
        const errMessage = spawnErr instanceof Error ? spawnErr.message : String(spawnErr);
        const isNotFound = errMessage.includes('Python interpreter not found') || errMessage.includes('ENOENT');
        const isTimeout = errMessage.includes('limit czasu') || errMessage.includes('timeout') || errMessage.includes('ETIMEDOUT');

        // Rozróżnienie kodów HTTP:
        // 503 — Python/dependency niedostępne
        // 504 — timeout procesu
        // 500 — pozostałe błędy uruchomienia
        const statusCode = isNotFound ? 503 : isTimeout ? 504 : 500;
        const clientErrorMsg = isNotFound
          ? 'Eksport PDF jest chwilowo niedostępny w tym środowisku (brak interpretera Pythona).'
          : isTimeout
            ? 'Generowanie PDF przekroczyło limit czasu. Spróbuj wybrać 1 stronę lub prostszy układ.'
            : `Błąd podczas uruchamiania generatora PDF: ${errMessage}`;

        logPdfExportStage({
          requestId,
          stage: 'failed',
          theme,
          layout,
          targetPages: safeTargetPages,
          pythonSpawned: !isNotFound,
          statusCode,
          errorMessage: errMessage,
        });

        return res.status(statusCode).json({
          success: false,
          requestId,
          error: clientErrorMsg,
        });
      }

      const { code, stderr, durationMs } = pythonResult;

      logPdfExportStage({
        requestId,
        stage: 'python_finished',
        theme,
        layout,
        targetPages: safeTargetPages,
        pythonSpawned: true,
        exitCode: code,
        durationMs,
      });

      // Jeśli proces zakończył się błędem
      if (code !== 0) {
        const isDepMissing =
          stderr.includes('ModuleNotFoundError') ||
          stderr.includes('No module named') ||
          stderr.includes('ImportError');

        // 503 — brak zależności Pythona
        // 500 — błąd renderera (np. ReportLab syntax error, formatting crash)
        const statusCode = isDepMissing ? 503 : 500;
        const errorMsg = isDepMissing
          ? `Eksport PDF niedostępny (brak wymaganych modułów Pythona): ${stderr.trim()}`
          : `Błąd silnika renderowania PDF (kod ${code}): ${stderr.trim() || 'Nieznany błąd generatora.'}`;

        logPdfExportStage({
          requestId,
          stage: 'failed',
          theme,
          layout,
          targetPages: safeTargetPages,
          pythonSpawned: true,
          exitCode: code,
          durationMs,
          statusCode,
          errorMessage: errorMsg,
        });

        return res.status(statusCode).json({
          success: false,
          requestId,
          error: errorMsg,
        });
      }

      // 7. Weryfikacja pliku wyjściowego
      if (!existsSync(outPdfPath)) {
        const errorMsg = 'Błąd silnika renderowania PDF: plik wyjściowy PDF nie został utworzony.';
        logPdfExportStage({
          requestId,
          stage: 'failed',
          theme,
          layout,
          targetPages: safeTargetPages,
          pythonSpawned: true,
          exitCode: code,
          durationMs,
          statusCode: 500,
          errorMessage: errorMsg,
        });
        return res.status(500).json({
          success: false,
          requestId,
          error: errorMsg,
        });
      }

      const pdfBuffer = await fs.readFile(outPdfPath);
      if (pdfBuffer.length === 0) {
        const errorMsg = 'Błąd silnika renderowania PDF: wygenerowany dokument jest pusty (0 bajtów).';
        logPdfExportStage({
          requestId,
          stage: 'failed',
          theme,
          layout,
          targetPages: safeTargetPages,
          pythonSpawned: true,
          exitCode: code,
          durationMs,
          statusCode: 500,
          errorMessage: errorMsg,
        });
        return res.status(500).json({
          success: false,
          requestId,
          error: errorMsg,
        });
      }

      // 8. Walidacja ATS: ekstrakcja tekstu z PDF i porównanie z MasterVault
      let atsValidation = null;
      try {
        const atsExtractData = await runAtsExtract(outPdfPath);
        atsValidation = await validatePdfTextForAts(atsExtractData.rawText, vault, {
          hasActualText: atsExtractData.hasActualText,
          hasInvisibleText: atsExtractData.hasInvisibleText,
        });
        logPdfExportStage({
          requestId,
          stage: 'ats_validated',
          theme,
          layout,
          targetPages: safeTargetPages,
          pythonSpawned: true,
          exitCode: 0,
          durationMs,
        });
      } catch (atsErr) {
        // Brak interpretera Pythona to błąd środowiska — zwracamy 503
        if (atsErr instanceof Error && atsErr.message.includes('Python interpreter not found')) {
          const errorMsg = 'Eksport PDF niedostępny w tym środowisku (brak interpretera Pythona dla walidatora ATS).';
          logPdfExportStage({
            requestId,
            stage: 'failed',
            theme,
            layout,
            targetPages: safeTargetPages,
            pythonSpawned: true,
            statusCode: 503,
            errorMessage: errorMsg,
          });
          return res.status(503).json({
            success: false,
            requestId,
            error: errorMsg,
          });
        }
        // Inne błędy ATS są niekrytyczne — nie blokują samego eksportu PDF
        atsValidation = null;
      }

      // Przygotowanie bezpiecznej nazwy pliku
      const safeName = profilePayload.name
        .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ_-]/g, '_')
        .substring(0, 40);
      const filename = `CV_${safeName}.pdf`;

      // Zapis do cache SHA-256 (LRU/FIFO)
      if (pdfCache.size >= PDF_CACHE_MAX_ENTRIES) {
        const oldestKey = pdfCache.keys().next().value;
        if (oldestKey) {
          pdfCache.delete(oldestKey);
        }
      }
      pdfCache.set(cacheKey, {
        buffer: pdfBuffer,
        filename,
        theme,
        layout,
        timestamp: Date.now(),
      });

      logPdfExportStage({
        requestId,
        stage: 'completed',
        theme,
        layout,
        targetPages: safeTargetPages,
        pythonSpawned: true,
        exitCode: 0,
        durationMs,
        statusCode: 200,
      });

      res.setHeader('X-Request-Id', requestId);
      res.setHeader('X-CV-Theme', theme);
      res.setHeader('X-CV-Layout', layout);
      res.setHeader('X-CV-Cache', 'MISS');

      if (atsValidation) {
        res.setHeader('X-ATS-Score', String(atsValidation.overallScore));
        res.setHeader('X-ATS-Status', atsValidation.overallStatus);
        res.setHeader('X-ATS-Tagged', String(atsValidation.taggedPdfPresent));
      }

      // Jeśli klient jawnie oczekuje binarnego pliku PDF
      if (req.headers.accept === 'application/pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        return res.send(pdfBuffer);
      }

      // Domyślna odpowiedź REST/JSON
      res.setHeader('Content-Type', 'application/json');
      return res.json({
        success: true,
        requestId,
        filename,
        pdf: pdfBuffer.toString('base64'),
        atsValidation,
      });
    } catch (unexpectedErr: unknown) {
      const errMessage = unexpectedErr instanceof Error ? unexpectedErr.message : String(unexpectedErr);
      logPdfExportStage({
        requestId,
        stage: 'failed',
        theme,
        layout,
        targetPages: safeTargetPages,
        pythonSpawned: false,
        statusCode: 500,
        errorMessage: errMessage,
      });

      return res.status(500).json({
        success: false,
        requestId,
        error: `Wystąpił nieoczekiwany błąd serwera podczas eksportu PDF: ${errMessage}`,
      });
    } finally {
      if (tempDir) {
        fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
          // cichy cleanup
        });
      }
    }
  }
);
