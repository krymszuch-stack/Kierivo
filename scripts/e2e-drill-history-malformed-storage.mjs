import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3046';
const OUTPUT = 'docs/evidence/drill-history-malformed-storage-2026-10-02.png';
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

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { DrillModeModal }, storage, { ANONYMOUS_PROFILE_ID }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/drill/DrillModeModal.tsx'),
      import('/src/lib/storage.ts'),
      import('/src/lib/localProfile.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const key = storage.profileDataKeyFor(storage.StorageKeys.drillHistory, ANONYMOUS_PROFILE_ID);
    const validAttempt = {
      id: 'synthetic-valid-attempt', questionId: 'synthetic-q',
      questionText: 'Synthetic valid interview question', transcript: 'Synthetic answer',
      durationSec: 12, recordedAt: '2026-10-02T00:00:00.000Z',
      scorecard: {
        structure: { hasSituation: true, hasTask: false, hasAction: true, hasResult: false, detectedElementsCount: 2, scorePercent: 50 },
        metrics: { hasMetrics: false, detectedMetrics: [] },
        ownership: { iCount: 1, weCount: 0 }, overallScore: null, suggestions: [],
      },
    };
    const malformedNested = {
      id: 'synthetic-bad-scorecard', questionId: 'q', questionText: 'Malformed nested scorecard',
      transcript: 'This must not render', durationSec: 1, recordedAt: '2026-10-02T00:00:00.000Z',
      scorecard: { structure: null },
    };
    storage.writeJson(key, [validAttempt, null, malformedNested]);
    document.body.innerHTML = '<main id="audit-drill-history"></main>';
    createRoot(document.getElementById('audit-drill-history')).render(createElement(DrillModeModal, {
      isOpen: true,
      onClose: () => {},
    }));
  });

  const modal = page.locator('#audit-drill-history');
  await modal.getByRole('button', { name: /Historia/ }).click();
  await modal.getByText('Synthetic valid interview question', { exact: false }).waitFor({ state: 'visible' });
  const rendered = await modal.innerText();
  assert.match(rendered, /Historia \(1\)/);
  assert.doesNotMatch(rendered, /Malformed nested scorecard|This must not render|undefined|NaN/);
  assert.deepEqual(pageErrors, [], 'wadliwe wpisy historii nie mogą przerwać renderowania modala');
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`Modal pokazuje poprawną próbę, pomija wadliwe wpisy i nie zgłasza błędu. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
