import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/drill-history-no-score-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { InterviewCockpitView }, { AuthProvider }, { createEmptyVault }, storage, { ANONYMOUS_PROFILE_ID }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/cockpit/InterviewCockpitView.tsx'),
      import('/src/context/AuthContext.tsx'),
      import('/src/lib/sampleVault.ts'),
      import('/src/lib/storage.ts'),
      import('/src/lib/localProfile.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const historyKey = storage.profileDataKeyFor(storage.StorageKeys.drillHistory, ANONYMOUS_PROFILE_ID);
    storage.writeJson(historyKey, [{
      id: 'synthetic-no-score',
      questionId: 'synthetic-question',
      questionText: 'Opisz sytuację, w której nie masz potwierdzonego wyniku.',
      transcript: '',
      durationSec: 0,
      recordedAt: '2026-10-02T00:00:00.000Z',
      scorecard: {
        structure: { hasSituation: false, hasTask: false, hasAction: false, hasResult: false, detectedElementsCount: 0, scorePercent: null },
        metrics: { hasMetrics: false, detectedMetrics: [] },
        ownership: { iCount: 0, weCount: 0, ownershipPercent: null, assessment: 'UNKNOWN', label: 'Nie oceniono' },
        overallScore: null,
        suggestions: [],
      },
    }]);
    document.body.innerHTML = '<main id="audit-drill-history" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-drill-history')).render(createElement(AuthProvider, null,
      createElement(InterviewCockpitView, { vault: createEmptyVault() }),
    ));
  });

  const cockpit = page.locator('#audit-drill-history');
  await cockpit.getByRole('tab', { name: /6\. Live Tracker/ }).click();
  const row = cockpit.locator('div.flex.items-center.justify-between').filter({ hasText: 'Opisz sytuację, w której nie masz potwierdzonego wyniku.' });
  await row.getByText('brak danych').waitFor({ state: 'visible' });
  assert.doesNotMatch(await row.innerText(), /null\/100 pkt|NaN/);
  await mkdir('docs/evidence', { recursive: true });
  await cockpit.screenshot({ path: OUTPUT, fullPage: true });
  assert.deepEqual(pageErrors, [], 'brak wyniku treningu nie może wywołać błędu widoku');
  console.log(`Historia Mock Drill wstrzymuje punkty, gdy scorecard nie ma wyniku. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
