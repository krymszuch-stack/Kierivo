import express from 'express';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createEmptyVault } from '../src/lib/sampleVault';

// Audyt uruchamia trasę PDF na danych syntetycznych, bez konta ani integracji chmurowej.
process.env.BACKEND_MODE = 'local';
process.env.AI_PROVIDER = 'ollama';
const { pdfRouter } = await import('../src/server/routes/pdf.routes');

const outputPath = resolve('docs/evidence/pdf-long-cv-synthetic-2026-10-02.pdf');
const app = express();
app.use((req, res, next) => {
  (req as typeof req & { requestId: string }).requestId = 'req-audit-pdf-long-cv';
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use('/api', pdfRouter);

const vault = createEmptyVault('Profil testowy', 'synthetic@example.invalid');
vault.personalInfo = {
  ...vault.personalInfo,
  fullName: 'Profil testowy',
  title: 'Technik utrzymania ruchu',
  summary: 'Syntetyczny opis doświadczenia. '.repeat(18),
  location: 'Miasto testowe',
};
vault.skillsMatrix = {
  hardSkills: Array.from({ length: 12 }, (_, index) => `Syntetyczna umiejętność ${index + 1}`),
  toolsAndTech: ['Narzędzie testowe A', 'Narzędzie testowe B'],
  softSkills: ['Dokładność', 'Współpraca'],
  certifications: [],
};
vault.history = Array.from({ length: 7 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `synthetic-long-exp-${number}`,
    company: `Syntetyczny zakład ${number}`,
    role: `Testowa rola ${number}`,
    location: 'Miasto testowe',
    startDate: `${2012 + index}-01`,
    endDate: `${2012 + index}-12`,
    isCurrent: false,
    description: `Opis testowego stanowiska ${number}. ${'Syntetyczna treść obowiązków. '.repeat(8)}`,
    highlights: Array.from({ length: 3 }, (_, highlightIndex) => ({
      id: `synthetic-long-highlight-${number}-${highlightIndex + 1}`,
      text: `CVLONG_SENTINEL_${number}_${highlightIndex + 1} ${'Syntetyczny punkt doświadczenia służący do sprawdzenia łamania i kolejności treści w dokumencie. '.repeat(3)}`,
      action: '', target: '', tool: '', metric: '', keywords: [],
    })),
  };
});
vault.projects = Array.from({ length: 3 }, (_, index) => ({
  id: `synthetic-long-project-${index + 1}`,
  name: `Testowy projekt ${index + 1}`,
  role: 'uczestnik testu',
  description: `${'Syntetyczny opis projektu do weryfikacji pełnego eksportu. '.repeat(6)} PROJLONG_SENTINEL_${index + 1}`,
  techStack: ['Narzędzie testowe A'],
  metrics: '',
  link: '',
}));

const server = await new Promise<Server>((resolveServer) => {
  const started = app.listen(0, '127.0.0.1', () => resolveServer(started));
});

try {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Nie można odczytać portu testowego.');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/cv/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vault, theme: 'classic', layout: 'sidebar', targetPages: 2, avatar: 'none', pdfType: 'dual-layer' }),
  });
  const payload = await response.json() as {
    success?: boolean;
    pdf?: string;
    error?: string;
    requestId?: string;
    contentWarnings?: string[];
    atsValidation?: {
      generalRecommendations: string[];
      vendors: Array<{ vendorName: string; issues: Array<{ id: string; severity: string }>; notFoundFields: string[] }>;
    };
  };
  if (!response.ok || !payload.success || !payload.pdf) {
    throw new Error(`Eksport PDF nie powiódł się (${response.status}): ${payload.error ?? 'brak pliku'}`);
  }
  const atsIssueIds = [...new Set(payload.atsValidation?.vendors.flatMap((vendor) => vendor.issues.map((issue) => issue.id)) ?? [])];
  process.stdout.write(`Reguły ATS zgłosiły: ${atsIssueIds.join(', ') || 'brak uwag'}; pola nieznalezione: ${[...new Set(payload.atsValidation?.vendors.flatMap((vendor) => vendor.notFoundFields) ?? [])].join(', ') || 'brak'}.\n`);

  const bytes = Buffer.from(payload.pdf, 'base64');
  const loadingTask = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const pageTexts = await Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
    const content = await (await pdf.getPage(index + 1)).getTextContent();
    return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
  }));
  await loadingTask.destroy();
  await mkdir(resolve('docs/evidence'), { recursive: true });
  await writeFile(outputPath, bytes);
  const normalizedText = pageTexts.join(' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const expected = [
    ...Array.from({ length: 7 }, (_, index) => {
      const number = String(index + 1).padStart(2, '0');
      return [
        `Syntetyczny zakład ${number}`,
        ...Array.from({ length: 3 }, (_, highlightIndex) => `CVLONG_SENTINEL_${number}_${highlightIndex + 1}`),
      ];
    }).flat(),
    ...Array.from({ length: 3 }, (_, index) => `PROJLONG_SENTINEL_${index + 1}`),
  ];
  const missing = expected.filter((value) => !normalizedText.includes(value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
  const warnings = payload.contentWarnings ?? [];
  if (missing.length > 0 && warnings.length === 0) {
    throw new Error(`PDF pomija ${missing.length} znaczników, ale nie ostrzega o skróceniu: ${missing.join(', ')}`);
  }
  if (missing.length === 0 && warnings.length > 0) {
    throw new Error(`PDF nie pominął kontrolowanych znaczników, ale ostrzega o treści: ${warnings.join(' ')}`);
  }
  if (missing.length > 0) {
    const warning = warnings.join(' ');
    for (const expectedWarning of ['umiejętności: 6', 'wpisy doświadczenia: 3', 'punkty doświadczenia: 12', 'skrócono podsumowanie zawodowe']) {
      if (!warning.includes(expectedWarning)) throw new Error(`Ostrzeżenie nie opisuje pominiętej treści (${expectedWarning}): ${warning}`);
    }
  }

  process.stdout.write(`Zapisano syntetyczny PDF (${bytes.length} B, ${pdf.numPages} stron); zachowano ${expected.length - missing.length}/${expected.length} kontrolowanych znaczników i jawnie ostrzeżono o ${missing.length} pominiętych; requestId=${payload.requestId ?? 'brak'}.\n`);
  if (warnings.length > 0) process.stdout.write(`Ostrzeżenie eksportu: ${warnings.join(' ')}\n`);
} finally {
  await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}
