import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

export interface AtsExtractResult {
  rawText: string;
  hasActualText: boolean;
  hasInvisibleText: boolean;
}

const ENGINE_DIR = path.resolve(process.cwd(), 'mastervault-cv');

/** Maksymalny czas oczekiwania na proces Pythona (ats_extract). */
const ATS_EXTRACT_TIMEOUT_MS = 60_000;

function getPythonBin(): string {
  return process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
}

function getEngineDir(): string {
  return ENGINE_DIR;
}

/**
 * Uruchamia `python -m mvcv tools ats_extract <pdfPath>` i zwraca sparsowany JSON.
 * Wyrzuca błąd, gdy interpreter nie znaleziony lub proces kończy się kodem != 0.
 */
export async function runAtsExtract(pdfPath: string): Promise<AtsExtractResult> {
  const pythonBin = getPythonBin();
  const engineDir = getEngineDir();

  if (!existsSync(engineDir)) {
    throw new Error('Katalog silnika mastervault-cv nie został odnaleziony.');
  }

  const args = ['-m', 'mvcv', 'tools', 'ats_extract', pdfPath];

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonBin, args, {
      cwd: engineDir,
      env: {
        ...process.env,
        PYTHONPATH: engineDir,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
      reject(new Error(`ATS extraction timed out after ${ATS_EXTRACT_TIMEOUT_MS}ms`));
    }, ATS_EXTRACT_TIMEOUT_MS);

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (killed) return;
      clearTimeout(timer);
      if (code === 0) {
        try {
          const parsed = JSON.parse(stdout);
          resolve({
            rawText: parsed.rawText ?? '',
            hasActualText: Boolean(parsed.hasActualText),
            hasInvisibleText: Boolean(parsed.hasInvisibleText),
          });
        } catch (e) {
          reject(new Error(`ATS extraction: niepoprawny JSON na stdout: ${stdout.slice(0, 200)}`));
        }
      } else {
        reject(new Error(`ATS extraction failed (code ${code}): ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      if (killed) return;
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('Python interpreter not found'));
      }
      reject(new Error(`Nie udało się uruchomić środowiska Python: ${err.message}`));
    });
  });
}

export function resetEngineDirForTesting(): void {
  // NOOP - ENGINE_DIR is const, but tests can mock getEngineDir
}

export function setPythonBinForTesting(bin: string): void {
  process.env.PYTHON_BIN = bin;
}