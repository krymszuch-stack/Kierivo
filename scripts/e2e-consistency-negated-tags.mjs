import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
  'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:3045', { waitUntil: 'domcontentloaded' });
  const proof = await page.evaluate(async () => {
    const [React, ReactDOM, { ConsistencyAlertBanner }, { validateConsistency }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/components/consistency/ConsistencyAlertBanner.tsx'),
      import('/src/lib/consistencyGuard/index.ts'), import('/src/lib/sampleVault.ts'),
    ]);
    const h = React.createElement ?? React.default.createElement;
    const cases = [
      ['Monter: Bez SEP', ['Bez SEP'], [], 0],
      ['Spawacz: Brak uprawnień oraz SEP G1', ['Brak uprawnień', 'SEP G1'], [], 1],
      ['Magazynier: Brak prawa jazdy', ['Brak prawa jazdy'], [], 0],
      ['Negacja SQL także w macierzy', ['Brak znajomości SQL'], ['Brak znajomości SQL'], 0],
      ['Nie znam Java; w macierzy JavaScript', ['Nie znam Java'], ['JavaScript'], 0],
    ];
    const results = cases.map(([title, tags, hardSkills, expected]) => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'synthetic-tags', sourceProject: 'Profil testowy', tags }];
      vault.skillsMatrix.hardSkills = hardSkills;
      return { title, expected, result: validateConsistency(vault, { skipTimelineAudit: true }) };
    });
    document.body.innerHTML = '<main id="tag-proof" style="max-width:1180px;margin:24px auto;padding:20px"></main>';
    (ReactDOM.createRoot ?? ReactDOM.default.createRoot)(document.getElementById('tag-proof')).render(
      h('div', null, h('h1', null, 'Audyt negacji tagów — dane syntetyczne'),
        h('p', null, 'Rzeczywisty walidator i komponent alertów. Sprawdzany zakres: sprzeczności tagów.'),
        ...results.map(({ title, result }) => h('section', { key: title, style: { marginTop: 28 } },
          h('h2', null, title), h('p', null, `Wykryte sygnały sprzeczności tagów: ${result.alerts.length}`),
          h(ConsistencyAlertBanner, { alerts: result.alerts }))),
      ));
    return results;
  });
  for (const { result, expected } of proof) {
    assert.equal(result.alerts.length, expected);
    assert.equal(result.isConsistent, expected === 0);
  }
  await page.getByText('Wykryto sprzeczność w umiejętnościach', { exact: true }).waitFor();
  assert.equal(await page.getByRole('alert').count(), 1);
  assert.equal(errors.length, 0, errors.join('; '));
  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#tag-proof').screenshot({ path: 'docs/evidence/consistency-negated-tags-2026-10-05.png' });
  console.log('PASS: negacje nie są dodatnimi dowodami, konflikt SEP pozostaje widoczny, Java nie jest JavaScript.');
} finally {
  await browser.close();
}
