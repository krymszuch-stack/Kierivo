import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT_SITUATION = 'docs/evidence/drill-no-inferred-situation-2026-10-02.png';
const OUTPUT_EMPTY = 'docs/evidence/drill-empty-no-score-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { DrillScorecardView }, { analyzeDrillResponse }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/components/drill/DrillScorecardView.tsx'),
      import('/src/lib/drillEngine.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    document.body.innerHTML = '<main id="audit-drill-score" style="max-width: 1080px; margin: 24px auto; padding: 18px"></main>';
    const root = createRoot(document.getElementById('audit-drill-score'));
    window.renderDrillCase = (transcript) => root.render(createElement(DrillScorecardView, {
      scorecard: analyzeDrillResponse(transcript),
    }));
    window.renderDrillCase('Pracowałem nad zadaniem i wdrożyłem poprawkę dla zespołu.');
  });

  const report = page.locator('#audit-drill-score');
  await report.getByText('2/4', { exact: true }).waitFor({ state: 'visible' });
  await report.getByText('Ocena całościowa: nie jest mierzona', { exact: true }).waitFor({ state: 'visible' });
  let text = await report.innerText();
  assert.doesNotMatch(text, /Wynik Jako|\b\d+%|undefined/);
  await mkdir('docs/evidence', { recursive: true });
  await report.screenshot({ path: OUTPUT_SITUATION, fullPage: true });

  await page.evaluate(() => window.renderDrillCase('W 2020 opisaĹ‚em 3 wersje formularza.'));
  await report.getByText(/Brak wykrytych liczb/).waitFor({ state: 'visible' });
  await report.getByText('Ocena całościowa: nie jest mierzona', { exact: true }).waitFor({ state: 'visible' });
  text = await report.innerText();
  assert.doesNotMatch(text, /2020|3 wersje/);

  await page.evaluate(() => window.renderDrillCase('   '));
  await report.getByText('Brak tekstu odpowiedzi').waitFor({ state: 'visible' });
  text = await report.innerText();
  assert.doesNotMatch(text, /\b\d+(?:\.\d+)?%|Wynik Jakości/);
  assert.doesNotMatch(text, /50% „Ja”/);
  assert.deepEqual(pageErrors, [], 'niepewne dane ćwiczenia nie mogą wywołać błędu renderowania');
  await report.screenshot({ path: OUTPUT_EMPTY, fullPage: true });
  console.log(`Długość tekstu nie dopisuje sytuacji, a pusta odpowiedź nie dostaje punktacji. Zrzuty: ${OUTPUT_SITUATION}, ${OUTPUT_EMPTY}`);
} finally {
  await browser.close();
}
