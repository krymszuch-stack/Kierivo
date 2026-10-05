import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/malformed-historical-ats-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { HistoricalAtsReport }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/tracker/HistoricalAtsReport.tsx'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    document.body.innerHTML = '<main id="audit-malformed-history"></main>';
    createRoot(document.getElementById('audit-malformed-history')).render(
      createElement(HistoricalAtsReport, {
        // Stary, niepełny payload. Brak list nie może zostać uznany za czysty raport.
        snapshot: { keywordCoverageScore: 50 },
      })
    );
  });

  await page.waitForTimeout(500);
  const modal = page.locator('#audit-malformed-history');
  if (pageErrors.length > 0) {
    throw new Error(`Błąd renderowania: ${pageErrors.join(' | ')}; body=${await page.locator('body').innerText()}`);
  }
  await modal.getByText('Zapisany raport ATS jest niekompletny').waitFor({ state: 'visible', timeout: 5000 });
  const text = await modal.innerText();
  assert.match(text, /niepełne dane nie będą przedstawiane jako brak wykrytych wymagań/i);
  assert.doesNotMatch(text, /Nie wykryto braków w wymaganiach rozpoznanych/);
  assert.deepEqual(pageErrors, [], 'wadliwa migawka nie powinna wywołać błędu renderowania');

  await mkdir('docs/evidence', { recursive: true });
  await modal.screenshot({ path: OUTPUT });
  console.log(`Wadliwa migawka historyczna jest zachowana, ale nie jest renderowana jako wynik. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
