import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3042';
const OUTPUT = 'docs/evidence/interview-loop-uncertain-session-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { InterviewLoopModal }, { createEmptyVault }, storage, engine] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/loop/InterviewLoopModal.tsx'),
      import('/src/lib/sampleVault.ts'),
      import('/src/lib/storage.ts'),
      import('/src/lib/interviewLoopEngine.ts'),
    ]);
    const createElement = react.createElement ?? react.default?.createElement;
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const key = storage.profileDataKeyFor(storage.StorageKeys.interviewLoops, 'anonymous');
    const valid = engine.createInterviewSession('', '');
    window.__interviewLoopStorageKey = key;
    localStorage.setItem(key, JSON.stringify([valid, null, { id: 'synthetic-invalid-session' }]));
    document.body.innerHTML = '<main id="audit-interview-loop" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-interview-loop')).render(createElement(InterviewLoopModal, {
      isOpen: true,
      onClose: () => {},
      vault: createEmptyVault(),
    }));
  });

  const panel = page.locator('#audit-interview-loop');
  const company = panel.getByPlaceholder('Wpisz firmę, jeśli jest znana');
  const role = panel.getByPlaceholder('Wpisz stanowisko, jeśli jest znane');
  await company.waitFor({ state: 'visible', timeout: 8_000 });
  assert.equal(await company.inputValue(), '');
  assert.equal(await role.inputValue(), '');
  assert.equal(await panel.getByText('Firma Rekrutująca', { exact: true }).count(), 0);
  assert.equal(await panel.getByText('Stanowisko Docelowe', { exact: true }).count(), 0);
  assert.equal(await panel.getByText('Firma do uzupełnienia (Stanowisko do uzupełnienia)', { exact: true }).count(), 1);

  await mkdir('docs/evidence', { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUTPUT, fullPage: true });

  await company.fill('Syntetyczna Firma');
  await role.fill('Syntetyczne Stanowisko');
  const persisted = await page.evaluate(() => {
    const raw = localStorage.getItem(window.__interviewLoopStorageKey);
    const envelope = raw ? JSON.parse(raw) : null;
    return envelope?.data ? JSON.parse(envelope.data) : [];
  });
  assert.equal(persisted[0].companyName, 'Syntetyczna Firma');
  assert.equal(persisted[0].roleTitle, 'Syntetyczne Stanowisko');
  assert.equal(persisted[1], null, 'Niepoprawny stary wpis powinien zostać zachowany przy zapisie.');
  assert.equal(persisted[2].id, 'synthetic-invalid-session');
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);
  console.log(`PASS: brak niepotwierdzonych danych w nowej rozmowie; zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
