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
  const proof = await page.evaluate(async () => {
    const [React, ReactDOM, { ConsistencyAlertBanner }, engine, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/components/consistency/ConsistencyAlertBanner.tsx'),
      import('/src/lib/consistencyGuard/index.ts'), import('/src/lib/sampleVault.ts'),
    ]);
    const h = React.createElement ?? React.default.createElement;
    const vault = createEmptyVault();
    vault.claims = [{ id: 'real-source', sourceProject: 'Wpis testowy montera', tags: ['SEP'], metric: '20%' }];
    const results = ['cv', 'hud', 'pitch'].map(sectionId => ({ sectionId,
      result: engine.validateConsistency(vault, { skipTimelineAudit: true, projectedItems: [{
        sectionId, sectionName: sectionId, claimId: 'missing-source',
      }] }),
    }));
    const hud = engine.renderHudFromClaims(vault, ['real-source', 'real-source', 'missing-source']);
    const linkedin = engine.renderLinkedInFromClaims(vault);
    document.body.innerHTML = '<main id="missing-proof" style="max-width:1180px;margin:24px auto;padding:20px"></main>';
    (ReactDOM.createRoot ?? ReactDOM.default.createRoot)(document.getElementById('missing-proof')).render(
      h('div', null, h('h1', null, 'Audyt brakujących źródeł — dane syntetyczne'),
        h('p', null, 'Rzeczywisty walidator, renderery i komponent alertów. Brak faktu uniemożliwia potwierdzenie.'),
        ...results.map(({ sectionId, result }) => h('section', { key: sectionId, style: { marginTop: 22 } },
          h('h2', null, sectionId.toUpperCase()),
          h('p', null, result.isConsistent ? 'Spójność potwierdzona' : 'Brak potwierdzenia spójności'),
          h(ConsistencyAlertBanner, { alerts: result.alerts }))),
        h('h2', { style: { marginTop: 26 } }, 'HUD — duplikat i brakujące ID'),
        h('p', null, `Unikalne odnalezione fakty: ${hud.activeClaimsCount}. Metryki wpisów: ${hud.verifiedMetrics.length}.`),
        h('h2', { style: { marginTop: 26 } }, 'Szkic LinkedIn z jednego wpisu'),
        h('p', null, linkedin.headline), h('p', null, linkedin.about),
      ));
    return { results, hud, linkedin };
  });
  for (const { result, sectionId } of proof.results) {
    assert.equal(result.isConsistent, false);
    assert.equal(result.sections[sectionId].isConsistent, false);
  }
  assert.equal(proof.hud.activeClaimsCount, 1);
  assert.equal(proof.hud.verifiedMetrics.length, 1);
  assert.equal('consistencyScore' in proof.hud, false);
  assert.equal(proof.linkedin.headline, 'Profil zawodowy');
  assert.doesNotMatch(proof.linkedin.about, /zweryfikowan|kluczowych wdrożeniach/);
  await page.getByRole('heading', { name: 'Szkic LinkedIn z jednego wpisu' }).waitFor();
  assert.equal(await page.getByRole('alert').count(), 3);
  assert.equal(errors.length, 0, errors.join('; '));
  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#missing-proof').screenshot({ path: 'docs/evidence/consistency-missing-sources-2026-10-06.png' });
  console.log('PASS: brak źródła nie potwierdza spójności, duplikaty nie mnożą faktów, LinkedIn nie deklaruje weryfikacji.');
} finally {
  await browser.close();
}
