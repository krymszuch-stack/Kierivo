import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
  'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:3045', { waitUntil: 'domcontentloaded' });
  const proof = await page.evaluate(async () => {
    const [React, ReactDOM, { ConsistencyAlertBanner }, { validateConsistency, parseDateRangeToYears }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/components/consistency/ConsistencyAlertBanner.tsx'),
      import('/src/lib/consistencyGuard/index.ts'), import('/src/lib/sampleVault.ts'),
    ]);
    const h = React.createElement ?? React.default.createElement;
    const vault = createEmptyVault();
    vault.claims = [{ id: 'synthetic-employment', sourceProject: 'Firma testowa',
      dateRange: { start: '2021-01', end: '2023-01' }, tags: [] }];
    const cases = [
      ['Monter — przesunięcie bez zmiany stażu', { start: '2018-01', end: '2020-01' }, 'DATE_MISMATCH'],
      ['Spawacz — odwrócony okres', { start: '2023-01', end: '2021-01' }, 'INVALID_DATE_RANGE'],
      ['Magazynier — nieczytelny miesiąc', { start: '2021-13', end: '2023-01' }, 'INVALID_DATE_RANGE'],
    ];
    const results = cases.map(([title, claimedDateRange, expected]) => ({ title, expected,
      result: validateConsistency(vault, { skipTimelineAudit: true, projectedItems: [{
        sectionId: 'cv', sectionName: 'CV', claimId: 'synthetic-employment', claimedDateRange,
      }] }),
    }));
    document.body.innerHTML = '<main id="date-proof" style="max-width:1180px;margin:24px auto;padding:20px"></main>';
    (ReactDOM.createRoot ?? ReactDOM.default.createRoot)(document.getElementById('date-proof')).render(
      h('div', null, h('h1', null, 'Audyt dat projekcji — dane syntetyczne'),
        h('p', null, 'Rzeczywisty walidator i komponent alertów. Źródło zatrudnienia: 2021-01 do 2023-01.'),
        ...results.map(({ title, result }) => h('section', { key: title, style: { marginTop: 24 } },
          h('h2', null, title), h(ConsistencyAlertBanner, { alerts: result.alerts }))),
      ));
    return { singleDate: parseDateRangeToYears('2020-01'), results };
  });
  assert.ok(Math.abs(proof.singleDate.durationYears - 1 / 12) < 0.00001);
  for (const { result, expected } of proof.results) {
    assert.equal(result.isConsistent, false);
    assert.equal(result.sections.cv.isConsistent, false);
    assert.equal(result.alerts[0].type, expected);
  }
  await page.getByText('Rozbieżność dat > 0.5 roku', { exact: true }).waitFor();
  assert.equal(await page.getByRole('alert').count(), 3);
  assert.equal(errors.length, 0, errors.join('; '));
  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#date-proof').screenshot({ path: 'docs/evidence/consistency-projected-dates-2026-10-05.png' });
  console.log('PASS: trzy niepoprawne projekcje nie potwierdzają zgodności; rzeczywiste alerty i pojedyncza data ISO sprawdzone.');
} finally {
  await browser.close();
}
