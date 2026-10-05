import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/ats-empty-cv-structure-unmeasured-2026-10-02.png';
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
    const [react, reactDom, { AtsSimulatorView }, { createEmptyVault }, { simulateAtsCheck }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/matcher/AtsSimulatorView.tsx'),
      import('/src/lib/sampleVault.ts'),
      import('/src/lib/atsSimulator.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.test');
    const resume = {
      targetJobTitle: '', companyName: '', summary: '', selectedHighlights: [],
      skillsMatched: { hardSkills: [], toolsAndTech: [], softSkills: [] }, atsScore: 0,
    };
    const result = simulateAtsCheck(resume, vault, '');
    document.body.innerHTML = '<main id="audit-empty-cv" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-empty-cv')).render(createElement(AtsSimulatorView, { result }));
    window.emptyCvStructureEvidence = {
      structureScore: result.structureScore,
      layoutScore: result.layer1Structure.layoutScore,
      headerNormalizationScore: result.layer1Structure.headerNormalizationScore,
    };
  });

  await page.waitForTimeout(1000);
  const evidence = await page.evaluate(() => window.emptyCvStructureEvidence);
  assert.deepEqual(evidence, { structureScore: null, layoutScore: null, headerNormalizationScore: null });
  const view = page.locator('#audit-empty-cv');
  const structureRow = view.locator('div.flex.items-center.justify-between').filter({ hasText: 'Struktura tekstu CV' });
  await structureRow.getByText('brak danych').waitFor({ state: 'visible' });
  assert.doesNotMatch(await structureRow.innerText(), /\b\d+%/);
  await mkdir('docs/evidence', { recursive: true });
  await view.screenshot({ path: OUTPUT, fullPage: true });
  assert.deepEqual(pageErrors, [], 'brak tresci CV nie moze wywolac bledu renderowania');
  console.log(`Symulator i AtsSimulatorView nie pokazuja procentu dla pustego CV. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
