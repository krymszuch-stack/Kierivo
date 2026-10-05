import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/malformed-home-analysis-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { InvalidLastJobAnalysisState }, { readLastJobAnalysis }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/views/InvalidLastJobAnalysisState.tsx'),
      import('/src/lib/lastJobAnalysis.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const parsed = readLastJobAnalysis({
      position: 'Specjalista wsparcia',
      company: 'Firma testowa',
      score: 68,
      strengths: ['Windows'],
      gaps: { not: 'lista luk' },
      analyzedAt: '2026-10-02T10:00:00.000Z',
    });
    if (parsed.state !== 'invalid') throw new Error('Wadliwe podsumowanie przeszło walidację.');
    document.body.innerHTML = '<main id="audit-malformed-home-analysis"></main>';
    createRoot(document.getElementById('audit-malformed-home-analysis')).render(
      createElement(InvalidLastJobAnalysisState)
    );
  });

  const home = page.locator('#audit-malformed-home-analysis');
  await page.waitForTimeout(500);
  if (pageErrors.length > 0) {
    throw new Error(`Błąd Home: ${pageErrors.join(' | ')}; body=${await page.locator('body').innerText()}`);
  }
  await home.getByText('Zapisanej analizy nie można odczytać').waitFor({ state: 'visible', timeout: 5000 });
  const text = await home.innerText();
  assert.match(text, /nie pokazujemy ich jako wyniku ani listy dopasowań/i);
  assert.doesNotMatch(text, /Wynik Kierivo: 68%|Wynik historyczny: 68%/);
  assert.deepEqual(pageErrors, [], 'wadliwy wpis w localStorage nie może wywrócić ekranu Home');
  await mkdir('docs/evidence', { recursive: true });
  await home.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`Stan UI dla uszkodzonej historii nie przedstawia wyniku. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
