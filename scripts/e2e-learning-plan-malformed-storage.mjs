import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3046';
const OUTPUT = 'docs/evidence/learning-plan-malformed-storage-2026-10-02.png';
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
    const [react, reactDom, { LearningPlanDrawer }, storage, planStorage] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/views/careerTips/LearningPlanDrawer.tsx'),
      import('/src/lib/storage.ts'),
      import('/src/lib/learningPlanStorage.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    storage.writeJson(storage.profileDataKeyFor(storage.StorageKeys.learningPlan, 'synthetic-profile'), {
      goalName: 'Plan syntetyczny',
      steps: [],
      items: [
        {
          id: 'valid-item', materialId: 'valid-material', materialTitle: 'Materiał poprawny',
          status: 'in_progress', statusLabel: 'zła etykieta', addedAt: '2026-10-01T10:00:00.000Z',
        },
        { id: 'invalid-item', materialId: 'invalid-material', status: 'nieznany' },
      ],
    });
    const plan = planStorage.getLearningPlan('synthetic-profile');
    document.body.innerHTML = '<main id="audit-learning-plan"></main>';
    createRoot(document.getElementById('audit-learning-plan')).render(createElement(LearningPlanDrawer, {
      isOpen: true,
      onClose: () => {},
      plan,
      onToggleStep: () => {},
      onUpdateStatus: () => {},
      onUpdateNotes: () => {},
      onRemoveItem: () => {},
      onOpenMaterial: () => {},
    }));
  });

  await page.getByText('Postęp checklisty:', { exact: false }).waitFor({ state: 'visible' });
  assert.equal(await page.getByText('0 / 8', { exact: true }).count(), 1);
  assert.equal(await page.getByText('0%', { exact: true }).count(), 1);
  assert.equal(await page.getByText('Materiał poprawny', { exact: true }).count(), 1);
  assert.equal(await page.getByText('invalid-material', { exact: true }).count(), 0);
  assert.deepEqual(pageErrors, [], 'wadliwy plan nauki nie może przerwać widoku');
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`Plan nauki pokazał tylko poprawne rekordy, odtworzył checklistę i wyrenderował się bez błędów. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
