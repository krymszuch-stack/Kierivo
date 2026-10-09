import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
  'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:3045', { waitUntil: 'domcontentloaded' });
  const outputs = await page.evaluate(async () => {
    const [React, ReactDOM, { ConsistencyGuardView }, { createEmptyVault }, { renderHudFromClaims }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/consistency/ConsistencyGuardView.tsx'), import('/src/lib/sampleVault.ts'),
      import('/src/lib/consistencyGuard/index.ts'),
    ]);
    const h = React.createElement ?? React.default.createElement;
    const job = (id, role, startDate, endDate) => ({ id, company: 'Firma testowa', role, startDate, endDate,
      isCurrent: false, location: '', highlights: [] });
    const unknown = createEmptyVault();
    unknown.history = [job('monter', 'Monter', 'nie wiem', '2022-01')];
    const partial = createEmptyVault();
    partial.history = [job('spawacz', 'Spawacz', '2020-01', '2022-01'), job('magazynier', 'Magazynier', '2023-01', '')];
    const future = createEmptyVault();
    future.history = [job('future', 'Monter', '2020-01', '2099-01')];
    document.body.innerHTML = '<main id="timeline-proof" style="max-width:1250px;margin:24px auto;padding:20px"></main>';
    (ReactDOM.createRoot ?? ReactDOM.default.createRoot)(document.getElementById('timeline-proof')).render(
      h('div', null, h('h1', null, 'Audyt zakresu zatrudnienia — dane syntetyczne'),
        h('p', null, 'Rzeczywisty widok Kierivo. Brak czytelnego okresu nie oznacza zerowego stażu.'),
        h('section', { id: 'unknown' }, h('h2', null, 'Monter — nieczytelny początek'), h(ConsistencyGuardView, { vault: unknown })),
        h('section', { id: 'partial', style: { marginTop: 28 } }, h('h2', null, 'Spawacz i magazynier — zakres częściowy'), h(ConsistencyGuardView, { vault: partial })),
      ));
    return { unknown: renderHudFromClaims(unknown), partial: renderHudFromClaims(partial), future: renderHudFromClaims(future) };
  });
  assert.equal(outputs.unknown.timelineCoverageYears, null);
  assert.equal(outputs.future.timelineCoverageYears, null);
  assert.equal(outputs.partial.timelineCoverageYears, 2);
  assert.equal(outputs.partial.timelineExcludedEntries, 1);
  for (const id of ['unknown', 'partial']) {
    await page.locator(`#${id}`).getByRole('tab', { name: 'Renderer HUD' }).click();
  }
  await page.locator('#unknown').getByText('Brak danych do obliczenia', { exact: true }).waitFor();
  assert.equal(await page.locator('#partial').getByText('2 lat', { exact: true }).count(), 1);
  assert.equal(await page.getByText(/Pominięte wpisy.*To nie jest pełny staż profilu/).count(), 2);
  assert.equal(errors.length, 0, errors.join('; '));
  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#timeline-proof').screenshot({ path: 'docs/evidence/consistency-timeline-unknown-2026-10-06.png' });
  console.log('PASS: rzeczywisty HUD pokazuje brak danych i zakres częściowy; przyszły koniec nie potwierdza stażu.');
} finally {
  await browser.close();
}
