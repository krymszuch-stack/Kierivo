import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/star-coach-input-limits-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [React, ReactDOM, { StarCoachSection }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/cockpit/StarCoachSection.tsx'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    document.body.innerHTML = '<main id="star-coach-proof" style="max-width:1180px;margin:24px auto;padding:20px"></main>';
    const root = createRoot(document.getElementById('star-coach-proof'));
    root.render(createElement(StarCoachSection, { vault: createEmptyVault() }));
  });

  const panel = page.locator('#star-coach-proof');
  const answer = panel.locator('textarea').first();
  await answer.waitFor({ state: 'visible' });
  assert.equal(await answer.getAttribute('maxlength'), '4000');
  await answer.fill('a'.repeat(4500));
  assert.equal((await answer.inputValue()).length, 4000);
  await panel.getByText('Znaki:').waitFor({ state: 'visible' });
  assert.match(await panel.innerText(), /4000\/4000/);
  await mkdir('docs/evidence', { recursive: true });
  await answer.scrollIntoViewIfNeeded();
  await panel.screenshot({ path: OUTPUT });
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);
  console.log(`PASS: rzeczywisty StarCoachSection ogranicza odpowiedź do 4000 znaków. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
