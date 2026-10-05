import { mkdir, writeFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3043';
const OUTPUT = 'docs/evidence';
const profileId = 'local-pdf-preview-proof';
const profile = {
  id: profileId,
  name: 'Synthetic PDF Preview Proof',
  type: 'local',
  createdAt: '2026-10-01T00:00:00.000Z',
};
const vault = {
  version: '1.0.0',
  updatedAt: '2026-10-01T00:00:00.000Z',
  profiler: {
    flags: [],
    experienceLevel: 'MID',
    location: { city: 'Krakow', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
    languages: [{ id: 'pdf-preview-lang-en', language: 'Angielski', level: 'B2', context: 'techniczny' }],
    licenses: ['sep_g1_e_1kv'],
  },
  personalInfo: {
    fullName: 'Adam Nowak',
    email: 'adam@example.invalid',
    phone: '+48 500 600 700',
    location: 'Krakow',
    linkedin: 'https://example.invalid/in/adam-nowak',
    github: 'https://example.invalid/adam-nowak',
    website: 'https://example.invalid/portfolio',
    title: 'Technik Mechanik',
    summary: 'Mechanik urzadzen przemyslowych z doswiadczeniem w diagnostyce i naprawach.',
  },
  skillsMatrix: {
    hardSkills: ['Montaz mechaniczny', 'Pneumatyka'],
    toolsAndTech: ['Klucze dynamometryczne'],
    softSkills: ['Dokladnosc'],
    certifications: [{ id: 'pdf-preview-cert-1', name: 'Diagnostyka maszyn', issuer: 'Centrum Techniczne', date: '2024' }],
  },
  history: [{
    id: 'pdf-preview-exp-1',
    company: 'Zremb Polska',
    role: 'Mechanik utrzymania ruchu',
    location: 'Krakow',
    startDate: '2021-01',
    endDate: '2023-12',
    isCurrent: false,
    description: 'Diagnostyka i konserwacja maszyn produkcyjnych.',
    highlights: [{
      id: 'pdf-preview-highlight-1',
      text: 'Remonty 40 przekladni zebatych rocznie.',
      action: '', target: '', tool: '', metric: '', keywords: [],
    }],
  }],
  education: [{
    id: 'pdf-preview-education-1', institution: 'Technikum Mechaniczne', degree: 'Technik mechanik',
    fieldOfStudy: 'mechanika', startDate: '2017', endDate: '2021', description: 'Eksploatacja maszyn.',
  }],
  projects: [{
    id: 'pdf-preview-project-1', name: 'Modernizacja prasy P-12', role: 'koordynator',
    description: 'Ograniczenie przestojów linii produkcyjnej.', techStack: ['Diagnostyka'], metrics: '20% mniej przestojów',
    link: 'https://example.invalid/projects/prasa-p12',
  }],
};

function fnv1a(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function envelope(value) {
  const data = JSON.stringify(value);
  return JSON.stringify({ cvel: 2, crc: fnv1a(data), data });
}

function compact(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

let chromium;
try {
  const modulePath = process.env.PLAYWRIGHT_MODULE ||
    'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
  ({ chromium } = await import(modulePath));
} catch {
  console.error('Brak Playwright. Ustaw PLAYWRIGHT_MODULE na lokalny modul Playwright.');
  process.exit(2);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
const page = await context.newPage();

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ profileEnvelope, vaultEnvelope }) => {
    localStorage.setItem('cvelocity:profile', profileEnvelope);
    localStorage.setItem(`cvelocity:vault:${'local-pdf-preview-proof'}`, vaultEnvelope);
  }, { profileEnvelope: envelope(profile), vaultEnvelope: envelope(vault) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'CV', exact: true }).click();
  await page.getByText('Technik Mechanik', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });

  const previewText = await page.locator('body').innerText();
  const expected = [
    'Adam Nowak', 'Technik Mechanik', 'Mechanik urzadzen przemyslowych z doswiadczeniem w diagnostyce i naprawach.',
    'adam@example.invalid', '+48 500 600 700', 'Krakow', 'https://example.invalid/in/adam-nowak',
    'https://example.invalid/adam-nowak', 'https://example.invalid/portfolio', 'Zremb Polska', 'Mechanik utrzymania ruchu',
    'Diagnostyka i konserwacja maszyn produkcyjnych.', 'Remonty 40 przekladni zebatych rocznie.',
    'Montaz mechaniczny', 'Pneumatyka', 'Klucze dynamometryczne', 'Dokladnosc',
    'Technik mechanik', 'mechanika', 'Technikum Mechaniczne',
    'SEP G1 E1 do 1 kV', 'Diagnostyka maszyn', 'Centrum Techniczne', 'Angielski', 'B2',
    'Modernizacja prasy P-12', 'koordynator', 'Ograniczenie przestojów linii produkcyjnej.',
    'Diagnostyka', '20% mniej przestojów', 'https://example.invalid/projects/prasa-p12',
  ];
  for (const fact of expected) {
    if (!compact(previewText).includes(compact(fact))) {
      throw new Error(`Podglad CV nie pokazuje faktu z Vaultu: ${fact}`);
    }
  }
  const consentPhrase = 'Wyrażam zgodę na przetwarzanie moich danych osobowych';
  if (previewText.includes(consentPhrase)) {
    throw new Error('Podgląd CV dopisał klauzulę zgody, której użytkownik nie zapisał w profilu.');
  }
  await mkdir(OUTPUT, { recursive: true });
  await page.screenshot({ path: `${OUTPUT}/cv-preview-synthetic-2026-10-01.png`, fullPage: true });

  const response = await page.request.post(`${BASE_URL}/api/cv/export-pdf`, {
    data: { vault, theme: 'classic', layout: 'sidebar', targetPages: 1, avatar: 'none', pdfType: 'dual-layer' },
    headers: { 'X-Request-Id': 'req-audit-pdf-preview-parity' },
  });
  const result = await response.json();
  if (!response.ok() || !result.success || !result.pdf) {
    throw new Error(`Eksport PDF nie powiodl sie (${response.status()}): ${result.error ?? 'brak pliku'}`);
  }

  const pdfBytes = Buffer.from(result.pdf, 'base64');
  const loadingTask = getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const extractedText = (await Promise.all(
    Array.from({ length: pdf.numPages }, async (_, index) => {
      const content = await (await pdf.getPage(index + 1)).getTextContent();
      return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    })
  )).join('\n');
  await loadingTask.destroy();
  const compactPdfText = compact(extractedText);
  if (extractedText.includes(consentPhrase)) {
    throw new Error('Eksport PDF dopisał klauzulę zgody, której użytkownik nie zapisał w profilu.');
  }
  for (const fact of expected) {
    if (!compactPdfText.includes(compact(fact))) {
      throw new Error(`PDF rozni sie od podgladu lub pomija fakt Vaultu: ${fact}.`);
    }
  }

  await writeFile(`${OUTPUT}/cv-preview-export-match-2026-10-01.pdf`, pdfBytes);
  console.log(`Podglad CV i PDF zawieraja te same ${expected.length} kontrolowane fakty ze wszystkich sekcji; klauzula nie pojawia sie bez zgody w profilu; PDF ma ${pdf.numPages} stron.`);

  const customClause = 'Zgadzam się na przetwarzanie danych w celu tej rekrutacji.';
  const vaultWithClause = { ...vault, personalInfo: { ...vault.personalInfo, rodoClause: customClause } };
  const customProfile = { ...profile, id: 'local-pdf-custom-clause-proof' };
  const customContext = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const customPage = await customContext.newPage();
  await customPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await customPage.evaluate(({ profileEnvelope, vaultEnvelope }) => {
    localStorage.setItem('cvelocity:profile', profileEnvelope);
    localStorage.setItem('cvelocity:vault:local-pdf-custom-clause-proof', vaultEnvelope);
  }, { profileEnvelope: envelope(customProfile), vaultEnvelope: envelope(vaultWithClause) });
  await customPage.reload({ waitUntil: 'domcontentloaded' });
  await customPage.getByRole('button', { name: 'CV', exact: true }).click();
  await customPage.getByText(customClause, { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
  const customResponse = await customPage.request.post(`${BASE_URL}/api/cv/export-pdf`, {
    data: { vault: vaultWithClause, theme: 'classic', layout: 'sidebar', targetPages: 1, avatar: 'none', pdfType: 'dual-layer' },
    headers: { 'X-Request-Id': 'req-audit-pdf-preview-custom-consent' },
  });
  const customResult = await customResponse.json();
  if (!customResponse.ok() || !customResult.success || !customResult.pdf) {
    throw new Error(`PDF z własną klauzulą nie powiódł się (${customResponse.status()}): ${customResult.error ?? 'brak pliku'}`);
  }
  const customLoadingTask = getDocument({ data: new Uint8Array(Buffer.from(customResult.pdf, 'base64')), useSystemFonts: true });
  const customPdf = await customLoadingTask.promise;
  const customPageText = (await Promise.all(
    Array.from({ length: customPdf.numPages }, async (_, index) => {
      const content = await (await customPdf.getPage(index + 1)).getTextContent();
      return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    })
  )).join('\n');
  await customLoadingTask.destroy();
  if (!compact(customPageText).includes(compact(customClause))) {
    throw new Error(`PDF pomija klauzulę wpisaną jawnie przez użytkownika, widoczną w podglądzie. Tekst PDF: ${customPageText}`);
  }
  await writeFile(`${OUTPUT}/cv-preview-export-explicit-consent-2026-10-01.pdf`, Buffer.from(customResult.pdf, 'base64'));
  await customContext.close();
  console.log('Jawna klauzula z Vaultu jest widoczna zarówno w podglądzie, jak i w PDF.');
  console.log(`Zrzut: ${OUTPUT}/cv-preview-synthetic-2026-10-01.png`);
  console.log(`PDF: ${OUTPUT}/cv-preview-export-match-2026-10-01.pdf`);
} catch (error) {
  await page.screenshot({ path: `${OUTPUT}/cv-preview-debug-2026-10-01.png`, fullPage: true }).catch(() => {});
  console.error('Tekst widoczny na ekranie:', (await page.locator('body').innerText().catch(() => '')).slice(0, 1800));
  throw error;
} finally {
  await context.close();
  await browser.close();
}
