import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/ats-empty-heuristic-profiles-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { AtsLabView }, { createEmptyVault }, { buildAtsTelemetryReport }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/ats/AtsLabView.tsx'),
      import('/src/lib/sampleVault.ts'),
      import('/src/lib/atsScorer.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const vault = createEmptyVault();
    const report = buildAtsTelemetryReport({ vault, jobDescription: '' });
    document.body.innerHTML = '<main id="audit-empty-heuristics" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-empty-heuristics')).render(createElement(AtsLabView, {
      profileId: 'synthetic-empty-profile',
      vault,
      targetRole: '',
      jobOfferText: '',
    }));
    window.emptyTelemetryEvidence = {
      scores: report.heuristicProfiles.map(({ score }) => score),
      reasons: report.heuristicProfiles.map(({ unavailableReason }) => unavailableReason),
    };
  });

  await page.waitForTimeout(1000);
  const evidence = await page.evaluate(() => window.emptyTelemetryEvidence);
  assert.deepEqual(evidence.scores, [null, null, null]);
  assert.ok(evidence.reasons.every((reason) => reason === 'Brak treści profilu kandydata do oceny.'));
  const lab = page.locator('#audit-empty-heuristics');
  await lab.getByText('Brak danych profilu').waitFor({ state: 'visible' });
  const screenText = await lab.innerText();
  assert.doesNotMatch(screenText, /\b\d+\/100\b/);
  assert.doesNotMatch(screenText, /Waga\s+0%/);
  assert.match(screenText, /Waga\s+—/);
  await mkdir('docs/evidence', { recursive: true });
  await lab.screenshot({ path: OUTPUT, fullPage: true });
  assert.deepEqual(pageErrors, [], 'brak danych nie moze wywolac bledu renderowania');
  console.log(`Silnik zwraca null dla pustych profili; AtsLabView wstrzymuje ocene. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
