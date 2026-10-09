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
  const results = await page.evaluate(async () => {
    const [React, ReactDOM, { ConsistencyAlertBanner }, engine, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/components/consistency/ConsistencyAlertBanner.tsx'),
      import('/src/lib/consistencyGuard/index.ts'), import('/src/lib/sampleVault.ts'),
    ]);
    const h = React.createElement ?? React.default.createElement;
    const job = (id, role, startDate, endDate, location = 'Kraków') => ({ id, company: `Firma testowa ${id}`,
      role, startDate, endDate, location, isCurrent: false,
      highlights: [{ id: `hl-${id}`, text: 'Wynik 20%', metric: '20%', action: '', target: '', tool: '', keywords: [] }] });
    const cases = [
      { title: 'Monter — brak końca roli', history: [job('a', 'Monter', '2020-01', ''), job('b', 'Monter', '2022-01', '2023-01')] },
      { title: 'Spawacz — wspólny miesiąc w różnych lokalizacjach', history: [job('c', 'Spawacz', '2020-01', '2021-01'), job('d', 'Spawacz', '2021-01', '2022-01', 'Warszawa')] },
      { title: 'Magazynier — odstęp między kompletnymi wpisami', history: [job('e', 'Magazynier', '2020-01', '2021-01'), job('f', 'Magazynier', '2022-01', '2023-01')] },
    ].map(item => { const vault = createEmptyVault(); vault.history = item.history;
      return { title: item.title, audit: engine.auditExperienceTimelineAndMetrics(item.history), validation: engine.validateConsistency(vault) }; });
    document.body.innerHTML = '<main id="timeline-evidence" style="max-width:1180px;margin:24px auto;padding:20px"></main>';
    (ReactDOM.createRoot ?? ReactDOM.default.createRoot)(document.getElementById('timeline-evidence')).render(
      h('div', null, h('h1', null, 'Audyt osi czasu — zakres dowodów, dane syntetyczne'),
        h('p', null, 'Rzeczywisty audyt, walidator i komponent alertów. Miesiące nie dowodzą godzin pracy ani bezrobocia.'),
        ...cases.map(item => h('section', { key: item.title, style: { marginTop: 30 } },
          h('h2', null, item.title), h('p', null, item.validation.isConsistent ? 'Nie wykryto potwierdzonej sprzeczności' : 'Brak potwierdzenia pełnej chronologii'),
          h(ConsistencyAlertBanner, { alerts: item.audit.alerts }))),
      ));
    return cases;
  });
  assert.equal(results[0].audit.careerGaps.length, 0);
  assert.equal(results[0].audit.isHealthy, false);
  assert.equal(results[0].validation.isConsistent, false);
  assert.equal(results[1].audit.locationConflicts[0].severity, 'WARNING');
  assert.equal(results[1].validation.isConsistent, true);
  assert.equal(results[2].audit.careerGaps[0].details.gapMonths, 11);
  assert.match(results[2].audit.careerGaps[0].message, /nie potwierdza/);
  await page.getByRole('heading', { name: 'Magazynier — odstęp między kompletnymi wpisami' }).waitFor();
  assert.equal(await page.getByRole('alert').count(), 3);
  assert.equal(errors.length, 0, errors.join('; '));
  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#timeline-evidence').screenshot({ path: 'docs/evidence/consistency-timeline-evidence-2026-10-06.png' });
  console.log('PASS: brak końca nie tworzy luki; miesięczne lokalizacje są ostrzeżeniem; odstęp wpisów nie udaje bezrobocia.');
} finally { await browser.close(); }
