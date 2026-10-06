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
    const [React, ReactDOM, { ConsistencyAlertBanner }, { validateConsistency, extractClaimsFromVault }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/components/consistency/ConsistencyAlertBanner.tsx'),
      import('/src/lib/consistencyGuard/index.ts'), import('/src/lib/sampleVault.ts'),
    ]);
    const h = React.createElement ?? React.default.createElement;
    const cases = [
      ['Monter — zmieniona wartość wyniku', '20%', '40%'],
      ['Spawacz — zmieniona jednostka', '20 sekund', '20 kilogramów'],
      ['Magazynier — dopisany wynik bez źródła', undefined, '20 zamówień dziennie'],
    ];
    const results = cases.map(([title, metric, claimedMetric]) => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'synthetic-metric', sourceProject: 'Profil testowy', tags: [], metric }];
      return { title, result: validateConsistency(vault, { skipTimelineAudit: true, projectedItems: [{
        sectionId: 'cv', sectionName: 'CV', claimId: 'synthetic-metric', claimedMetric,
      }] }) };
    });
    const versionVault = createEmptyVault();
    versionVault.history = [{ id: 'version-role', company: 'Firma testowa', role: 'Tester', location: '',
      startDate: '', endDate: '', isCurrent: false, highlights: [{ id: 'version-highlight',
        text: 'Obsługa Windows 11 od 2022 roku.', metric: '', keywords: [], action: '', target: '', tool: '',
      }] }];
    const inferredMetric = extractClaimsFromVault(versionVault).find(claim => claim.id === 'version-highlight')?.metric ?? null;
    document.body.innerHTML = '<main id="metric-proof" style="max-width:1180px;margin:24px auto;padding:20px"></main>';
    (ReactDOM.createRoot ?? ReactDOM.default.createRoot)(document.getElementById('metric-proof')).render(
      h('div', null, h('h1', null, 'Audyt metryk podglądu — dane syntetyczne'),
        h('p', null, 'Rzeczywisty walidator i komponent alertów. Porównanie zapisu wyniku ze źródłem.'),
        ...results.map(({ title, result }) => h('section', { key: title, style: { marginTop: 24 } },
          h('h2', null, title), h(ConsistencyAlertBanner, { alerts: result.alerts }))),
        h('h2', { style: { marginTop: 28 } }, 'Obsługa Windows 11 od 2022 roku.'),
        h('p', null, `Metryka claimu: ${inferredMetric ?? 'niepodana — wersja i data nie są wynikiem osiągnięcia'}`),
      ));
    return { results, inferredMetric };
  });
  for (const { result } of proof.results) {
    assert.equal(result.isConsistent, false);
    assert.equal(result.sections.cv.isConsistent, false);
    assert.equal(result.alerts[0].type, 'METRIC_MISMATCH');
  }
  assert.equal(proof.inferredMetric, null);
  await page.getByRole('heading', { name: 'Obsługa Windows 11 od 2022 roku.' }).waitFor();
  assert.equal(await page.getByRole('alert').count(), 3);
  assert.equal(errors.length, 0, errors.join('; '));
  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#metric-proof').screenshot({ path: 'docs/evidence/consistency-projected-metrics-2026-10-06.png' });
  console.log('PASS: zmieniona wartość, jednostka i dopisany wynik dają alert; Windows 11 nie jest metryką.');
} finally {
  await browser.close();
}
