import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3042';
const OUTPUT = 'docs/evidence/portable-cv-malformed-record-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

function buildPdfWithMalformedPortableRecord() {
  const embedded = JSON.stringify({
    masterVaultRecord: {
      source: 'synthetic-audit-fixture',
      version: '1.0',
      resumeData: { name: 'Jan Kowalski', skills: 'SEP G1' },
    },
  });
  const content = 'BT /F1 12 Tf 72 720 Td (Jan Kowalski) Tj 0 -20 Td (Doswiadczenie zawodowe) Tj 0 -20 Td (Wsparcie IT) Tj 0 -20 Td (Obsluga zgloszen i diagnoza usterek uzytkownikow) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles 8 0 R >> >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Filespec /F (mastervault.json) /EF << /F 7 0 R >> >>',
    `<< /Type /EmbeddedFile /Subtype /application#2Fjson /Length ${Buffer.byteLength(embedded)} >>\nstream\n${embedded}\nendstream`,
    '<< /Names [(mastervault.json) 6 0 R] >>',
  ];
  let document = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document, 'binary'));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document, 'binary');
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) document += `${String(offset).padStart(10, '0')} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, 'binary');
}

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { CVParserModal }, { ToastHost }, entitlements, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/parser/CVParserModal.tsx'),
      import('/src/components/ui/ToastHost.tsx'),
      import('/src/store/useEntitlements.ts'),
      import('/src/lib/sampleVault.ts'),
    ]);
    entitlements.setAuthenticatedEntitlements({ status: 'free' }, { importUses: 1 });
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 920px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-preview')).render(
      createElement('div', null,
        createElement(CVParserModal, { currentVault: createEmptyVault(), onApplyVault: () => {} }),
        createElement(ToastHost),
      )
    );
  });

  const fileInput = page.locator('#audit-preview input[type="file"]');
  await fileInput.waitFor({ state: 'attached', timeout: 8_000 });
  await fileInput.setInputFiles({
    name: 'synthetic-malformed-portable-cv.pdf',
    mimeType: 'application/pdf',
    buffer: buildPdfWithMalformedPortableRecord(),
  });
  await page.getByRole('button', { name: 'Przeanalizuj CV i pokaż różnice' }).click();
  await page.getByRole('button', { name: 'Zastosuj i Scal do Master Vault' }).waitFor({ state: 'visible', timeout: 15_000 });
  if (await page.getByText('Wykryto profil Smart Portable CV', { exact: true }).count()) {
    throw new Error('Niepoprawny osadzony rekord został zgłoszony jako certyfikowany profil przenośny.');
  }
  if (await page.getByText('SEP G1', { exact: true }).count()) {
    throw new Error('Pole skills o nieprawidłowym typie z JSON-a zostało pokazane jako wyodrębniona umiejętność.');
  }

  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#audit-preview').screenshot({ path: OUTPUT });
  console.log(`OK: nieprawidłowy rekord osadzony w syntetycznym PDF nie został zaimportowany. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
