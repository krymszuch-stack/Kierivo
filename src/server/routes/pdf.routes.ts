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
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { adaptMasterVaultToSemanticProfile } from '../../lib/semanticPdfAdapter';
import { MasterVault, TailoredResume } from '../../types';

export const pdfRouter = Router();

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

function pruneExpiredPdfCache(): void {
  const now = Date.now();
  for (const [key, entry] of pdfCache.entries()) {
    if (now - entry.timestamp > PDF_CACHE_TTL_MS) {
      pdfCache.delete(key);
    }
  }
}

export interface ExportPdfRequestBody {
  vault: MasterVault;
  tailoredResume?: TailoredResume | null;
  theme?: string;
  layout?: string;
  targetPages?: number;
  summaryOverride?: string;
  targetRole?: string;
  companyName?: string;
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
 * POST /api/cv/export-pdf
 * Generuje dwuwarstwowy plik PDF z profilu MasterVault.
 */
pdfRouter.post(
  '/cv/export-pdf',
  async (req: Request<unknown, unknown, ExportPdfRequestBody>, res: Response, next: NextFunction) => {
    let tempDir = '';
    try {
      const {
        vault,
        tailoredResume,
        theme = 'parchment',
        layout = 'sidebar',
        targetPages = 1,
        summaryOverride,
        targetRole,
        companyName,
      } = req.body;

      if (!vault || !vault.personalInfo) {
        return res.status(400).json({
          success: false,
          error: 'Brak wymaganych danych MasterVault do wygenerowania CV.',
        });
      }

      // 0. Pamięć podręczna SHA-256 (błyskawiczny response < 2ms dla tych samych parametrów)
      const cacheKey = createHash('sha256')
        .update(
          JSON.stringify({
            vault,
            tailoredResume,
            theme,
            layout,
            targetPages: Number(targetPages) || 1,
            summaryOverride,
            targetRole,
            companyName,
          })
        )
        .digest('hex');

      pruneExpiredPdfCache();
      const cached = pdfCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp <= PDF_CACHE_TTL_MS) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cached.filename)}"`);
        res.setHeader('X-CV-Theme', cached.theme);
        res.setHeader('X-CV-Layout', cached.layout);
        res.setHeader('X-CV-Cache', 'HIT');
        return res.send(cached.buffer);
      }

      // 1. Adapter: konwersja danych z Kierivo na kontrakt mvcv MasterProfile
      const profilePayload = adaptMasterVaultToSemanticProfile(vault, tailoredResume, {
        summaryOverride,
        targetRole,
        companyName,
      });

      // 2. Przygotowanie izolowanego katalogu tymczasowego
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kierivo-cv-'));
      const profileJsonPath = path.join(tempDir, 'profile.json');
      const outPdfPath = path.join(tempDir, 'cv.pdf');

      await fs.writeFile(profileJsonPath, JSON.stringify(profilePayload, null, 2), 'utf-8');

      // 3. Ścieżka do silnika `mastervault-cv`
      const engineDir = path.resolve(process.cwd(), 'mastervault-cv');
      if (!existsSync(engineDir)) {
        throw new Error('Katalog silnika mastervault-cv nie został odnaleziony.');
      }

      // 4. Uruchomienie pipeline'u Pythona
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
        String(Math.min(Math.max(Number(targetPages) || 1, 1), 2)),
      ];

      const pythonBin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

      await new Promise<void>((resolve, reject) => {
        const proc = spawn(pythonBin, args, {
          cwd: engineDir,
          env: {
            ...process.env,
            PYTHONPATH: engineDir,
            PYTHONIOENCODING: 'utf-8',
          },
        });

        let stderr = '';
        proc.stderr.on('data', (d) => {
          stderr += d.toString();
        });

        proc.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Błąd generatora PDF (kod ${code}): ${stderr}`));
          }
        });

        proc.on('error', (err) => {
          reject(new Error(`Nie udało się uruchomić środowiska Python: ${err.message}`));
        });
      });

      // 5. Odczyt wygenerowanego bufora PDF
      const pdfBuffer = await fs.readFile(outPdfPath);

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

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('X-CV-Theme', theme);
      res.setHeader('X-CV-Layout', layout);
      res.setHeader('X-CV-Cache', 'MISS');
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    } finally {
      if (tempDir) {
        fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
          // cichy cleanup
        });
      }
    }
  }
);
