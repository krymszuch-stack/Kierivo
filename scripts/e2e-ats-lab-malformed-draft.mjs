import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3046';
const OUTPUT = 'docs/evidence/ats-lab-malformed-draft-2026-10-02.png';
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
    const [react, reactDom, { AtsLabView }, { createEmptyVault }, storage] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/ats/AtsLabView.tsx'),
      import('/src/lib/sampleVault.ts'),
      import('/src/lib/storage.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    storage.writeJson(storage.profileDataKeyFor(storage.StorageKeys.draftAtsLab, 'synthetic-profile'), {
      jd: { unexpected: 'object' },
      role: 'Support Engineer',
    });
    document.body.innerHTML = '<main id="audit-ats-draft"></main>';
    createRoot(document.getElementById('audit-ats-draft')).render(createElement(AtsLabView, {
      profileId: 'synthetic-profile',
      vault: createEmptyVault(),
    }));
  });

  const roleInput = page.locator('#ats-lab-role-input');
  const jdInput = page.locator('#ats-lab-jd-textarea');
  await roleInput.waitFor({ state: 'visible' });
  await jdInput.waitFor({ state: 'visible' });
  assert.equal(await roleInput.inputValue(), 'Support Engineer');
  assert.equal(await jdInput.inputValue(), '');
  await page.getByText('Wymaga wklejenia oferty', { exact: true }).waitFor({ state: 'visible' });
  assert.deepEqual(pageErrors, [], 'wadliwy szkic oferty nie może przerwać widoku ATS Lab');
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: OUTPUT });
  console.log(`The ATS Lab recovered the valid role, discarded the malformed offer field, and rendered without errors. Screenshot: ${OUTPUT}`);
} finally {
  await browser.close();
}
