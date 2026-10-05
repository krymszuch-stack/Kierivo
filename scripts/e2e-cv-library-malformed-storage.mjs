import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3042';
const OUTPUT = 'docs/evidence/cv-library-malformed-storage-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 820 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { CVLibraryView }, { createEmptyVault }, storage] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/library/CVLibraryView.tsx'),
      import('/src/lib/sampleVault.ts'),
      import('/src/lib/storage.ts'),
    ]);
    const createElement = react.createElement ?? react.default?.createElement;
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const key = storage.cvLibraryKeyFor('anonymous');
    const valid = {
      schemaVersion: 1,
      id: 'synthetic-valid-cv',
      title: 'Syntetyczne CV',
      tags: ['IT'],
      theme: 'cobalt',
      layout: 'sidebar',
      targetPages: 1,
      vault: createEmptyVault('Jan Kowalski', ''),
      createdAt: '2026-10-02T08:00:00.000Z',
      updatedAt: '2026-10-02T08:00:00.000Z',
      downloadCount: 0,
    };
    const malformed = { ...valid, id: 'synthetic-invalid-cv', title: 'Niepoprawne CV', tags: null };
    localStorage.setItem(key, JSON.stringify([valid, malformed, null]));
    document.body.innerHTML = '<main id="audit-library" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-library')).render(createElement(CVLibraryView, {}));
  });

  const panel = page.locator('#audit-library');
  try {
    await panel.getByText('Biblioteka CV', { exact: true }).waitFor({ state: 'visible', timeout: 8_000 });
  } catch (error) {
    console.error(`Treść ekranu: ${(await panel.innerText().catch(() => 'brak DOM')).slice(0, 1000)}`);
    console.error(`Błędy strony: ${pageErrors.join('; ')}`);
    await page.screenshot({ path: 'docs/evidence/cv-library-malformed-storage-debug.png', fullPage: true });
    throw error;
  }
  await panel.getByText('Syntetyczne CV', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(await panel.getByText('Niepoprawne CV', { exact: true }).count(), 0);
  assert.deepEqual(pageErrors, [], `Błędy strony: ${pageErrors.join('; ')}`);
  await mkdir('docs/evidence', { recursive: true });
  await panel.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: Biblioteka pokazuje poprawny wpis i pomija wadliwy JSON. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
