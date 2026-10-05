import express from 'express';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createEmptyVault } from '../src/lib/sampleVault';

// Ten jednorazowy serwer działa na syntetycznym payloadzie w trybie lokalnym.
process.env.BACKEND_MODE = 'local';
process.env.AI_PROVIDER = 'ollama';
const { pdfRouter } = await import('../src/server/routes/pdf.routes');

const outputPath = resolve('docs/evidence/pdf-export-synthetic-2026-10-01.pdf');
const app = express();
app.use((req, res, next) => {
  const requestId = 'req-audit-pdf-preview';
  (req as typeof req & { requestId: string }).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use('/api', pdfRouter);

const vault = createEmptyVault('Adam Nowak', 'adam@example.invalid');
vault.personalInfo = {
  ...vault.personalInfo,
  fullName: 'Adam Nowak',
  title: 'Technik Mechanik',
  summary: 'Mechanik urzadzen przemyslowych z doswiadczeniem w diagnostyce i naprawach.',
  phone: '+48 500 600 700',
  location: 'Krakow',
};
vault.skillsMatrix = {
  hardSkills: ['Montaż mechaniczny', 'Pneumatyka'],
  toolsAndTech: ['Klucze dynamometryczne'],
  softSkills: ['Dokładność'],
  certifications: [],
};
vault.history = [
  {
    id: 'audit-exp-1',
    company: 'Zremb Polska',
    role: 'Mechanik utrzymania ruchu',
    location: 'Krakow',
    startDate: '2021-01',
    endDate: '2023-12',
    isCurrent: false,
    description: 'Diagnostyka i konserwacja maszyn produkcyjnych.',
    highlights: [
      {
        id: 'audit-highlight-1',
        text: 'Remonty 40 przekladni zebatych rocznie.',
        action: '', target: '', tool: '', metric: '', keywords: [],
      },
    ],
  },
];

const tailoredResume = {
  targetJobTitle: 'Technik serwisu maszyn',
  companyName: 'FirmaTylkoDoMetadanych',
  summary: 'Mechanik z doswiadczeniem w diagnozowaniu usterek i serwisie maszyn.',
  selectedHighlights: [],
  skillsMatched: {
    hardSkills: ['Montaż mechaniczny', 'Pneumatyka'],
    toolsAndTech: ['Klucze dynamometryczne'],
    softSkills: ['Dokładność'],
  },
  atsScore: 0,
};

const server = await new Promise<Server>((resolveServer) => {
  const started = app.listen(0, '127.0.0.1', () => resolveServer(started));
});

try {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Nie można odczytać portu testowego.');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/cv/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vault, tailoredResume, theme: 'classic', layout: 'sidebar', pdfType: 'dual-layer' }),
  });
  const responseText = await response.text();
  let data: { success?: boolean; pdf?: string; error?: string; requestId?: string };
  try {
    data = JSON.parse(responseText) as typeof data;
  } catch {
    throw new Error(`Odpowiedz eksportera nie jest JSON (${response.status}, ${response.headers.get('content-type')}): ${responseText.slice(0, 300)}`);
  }
  if (!response.ok || !data.success || !data.pdf) {
    throw new Error(`Eksport PDF nie powiódł się (${response.status}): ${data.error ?? 'brak pliku'}`);
  }

  const bytes = Buffer.from(data.pdf, 'base64');
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Odpowiedź nie zawiera poprawnego nagłówka PDF.');

  const loadingTask = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const extractedText = (await Promise.all(
    Array.from({ length: pdf.numPages }, async (_, index) => {
      const page = await pdf.getPage(index + 1);
      const content = await page.getTextContent();
      return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    })
  )).join('\n');
  await loadingTask.destroy();
  // Tytuł jest celowo rozstrzelony typograficznie, więc porównanie usuwa
  // spacje i znaki diakrytyczne zamiast uznawać taki PDF za brak tytułu.
  const compactText = (value: string) => value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
  const normalizedText = compactText(extractedText);
  for (const expected of [
    'Adam Nowak',
    'Technik serwisu maszyn',
    'Mechanik z doswiadczeniem w diagnozowaniu usterek i serwisie maszyn.',
    'Mechanik utrzymania ruchu',
    'Zremb Polska',
  ]) {
    if (!normalizedText.includes(compactText(expected))) {
      throw new Error(`W wygenerowanym PDF brakuje potwierdzonej treści: ${expected}`);
    }
  }
  if (normalizedText.includes(compactText('FirmaTylkoDoMetadanych'))) {
    throw new Error('Nazwa firmy z metadanych oferty trafiła do treści CV.');
  }
  await mkdir(resolve('docs/evidence'), { recursive: true });
  await writeFile(outputPath, bytes);
  process.stdout.write(`Zapisano rzeczywisty PDF: ${outputPath} (${bytes.length} B, ${data.requestId ?? 'bez requestId'}).\n`);
} finally {
  await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}
