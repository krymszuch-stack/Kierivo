import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3042';
const OUTPUT = 'docs/evidence/cv-latest-role-2026-10-01.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { CVParserModal }, entitlements, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/parser/CVParserModal.tsx'),
      import('/src/store/useEntitlements.ts'),
      import('/src/lib/sampleVault.ts'),
    ]);
    entitlements.setAuthenticatedEntitlements({ status: 'free' }, { importUses: 1 });
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 920px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-preview')).render(
      createElement(CVParserModal, { currentVault: createEmptyVault(), onApplyVault: () => {} })
    );
  });

  const cv = `Anna Kowalska
Doświadczenie zawodowe:
2018–2020 Specjalistka administracji — Firma Alfa Sp. z o.o.
- Prowadzenie dokumentacji.
2021–2025 Specjalistka wsparcia IT — Firma Beta Sp. z o.o.
- Obsługa zgłoszeń i diagnoza problemów użytkowników.
Umiejętności: Windows, Microsoft 365, obsługa zgłoszeń`;
  await page.locator('#audit-preview input[type="file"]').setInputFiles({
    name: 'anna-kowalska-cv.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(cv, 'utf8'),
  });
  await page.getByRole('button', { name: 'Przeanalizuj CV i pokaż różnice' }).click();

  const contactSection = page.locator('#audit-preview').getByText('NOWO SPARSOWANE Z CV (ŚCIEŻKA B)').locator('..');
  await contactSection.getByText('Specjalistka wsparcia IT', { exact: true }).waitFor({ state: 'visible' });
  if (await contactSection.getByText('Specjalistka administracji', { exact: true }).count()) {
    throw new Error('Tytuł najstarszego stanowiska został pokazany jako tytuł kandydata.');
  }

  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`OK: chronologicznie starszy-pierwszy CV pokazuje tytuł najnowszego stanowiska. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
