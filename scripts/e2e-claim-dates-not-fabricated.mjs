import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/consistency-claim-dates-unprovided-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [React, ReactDOM, { ConsistencyGuardView }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/consistency/ConsistencyGuardView.tsx'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
    vault.history = [{
      id: 'synthetic-role-without-dates', company: 'Firma testowa', role: 'Tester', location: '',
      startDate: '', endDate: '', isCurrent: false,
      description: 'Opis syntetycznej pracy.',
      highlights: [{
        id: 'synthetic-highlight', text: 'Obsługa środowiska testowego.', action: 'Obsługa',
        target: 'środowisko', tool: 'System testowy', metric: '', keywords: ['System testowy'],
      }],
    }];
    vault.projects = [{
      id: 'synthetic-project-without-dates', name: 'Projekt testowy', role: 'Autor',
      description: 'Opis syntetycznego projektu.', techStack: ['TypeScript'],
    }];
    document.body.innerHTML = '<main id="audit-claim-dates" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-claim-dates')).render(createElement(ConsistencyGuardView, { vault }));
  });

  const panel = page.locator('#audit-claim-dates');
  await panel.getByText('Jan Testowy', { exact: true }).waitFor({ state: 'visible' });
  await panel.getByText('Daty niepodane w profilu').first().waitFor({ state: 'visible' });
  await panel.getByText('Firma testowa', { exact: true }).waitFor({ state: 'visible' });
  await panel.getByText('Projekt testowy', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(await panel.getByText(/2020|2022|Obecnie/).count(), 0);
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  await panel.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: zatrudnienie i projekt bez dat w profilu są oznaczone jako niepodane. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
