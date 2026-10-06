import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
  'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cases = [
    { id: 'invalid', status: 'NOT_ASSESSED', label: 'Nie oceniono' },
    { id: 'review', status: 'REVIEW_REQUIRED', label: 'Do sprawdzenia' },
    { id: 'clear', status: 'NO_SIGNALS', label: 'Bez sygnałów w sprawdzonym zakresie' },
  ];
  await mkdir('docs/evidence', { recursive: true });
  for (const item of cases) {
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:3045', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async caseId => {
      const [React, ReactDOM, { AtsLabView }, { createEmptyVault }, { simulateMultiEngineATS }] = await Promise.all([
        import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
        import('/src/features/ats/AtsLabView.tsx'), import('/src/lib/sampleVault.ts'), import('/src/lib/atsSimulator.ts'),
      ]);
      const h = React.createElement ?? React.default.createElement;
      const vault = createEmptyVault();
      const job = (id, startDate, endDate) => ({ id, company: `Firma testowa ${id}`, role: 'Monter', location: 'Kraków',
        startDate, endDate, isCurrent: false, highlights: [{ id: `hl-${id}`, text: 'Instalacje SEP G1',
          metric: '', action: '', target: '', tool: '', keywords: ['SEP G1'] }] });
      vault.personalInfo.title = 'Monter';
      vault.history = [job('a', '2020-01', '2021-01'), job('b', caseId === 'review' ? '2022-01' : '2021-02', '2023-01')];
      if (caseId === 'invalid') vault.history.push(job('c', 'nie wiem', '2024-01'));
      const jd = 'Stanowisko: Monter. Wymagania: aktualne uprawnienia SEP G1 i doświadczenie w instalacjach elektrycznych.';
      document.body.innerHTML = '<main id="ats-timeline-proof"></main>';
      (ReactDOM.createRoot ?? ReactDOM.default.createRoot)(document.getElementById('ats-timeline-proof')).render(
        h(AtsLabView, { vault, profileId: `synthetic-timeline-${caseId}`, jobOfferText: jd, targetRole: 'Monter' }));
      return simulateMultiEngineATS(vault, jd, 'Monter').engines.find(engine => engine.id === 'spojnosc_profilu');
    }, item.id);
    assert.equal(result.status, item.status);
    assert.equal(result.score, null);
    const module = page.getByRole('button').filter({ hasText: 'Strażnik spójności i ciągłości zatrudnienia' });
    await module.waitFor();
    assert.match(await module.innerText(), new RegExp(item.label));
    assert.doesNotMatch(await module.innerText(), /Wysoki wynik|Niski wynik|\d+%/);
    await module.click();
    const detail = page.locator('#szczegoly-modulu');
    await detail.getByRole('heading', { name: 'Strażnik spójności i ciągłości zatrudnienia' }).waitFor();
    await detail.getByText(item.label, { exact: true }).waitFor();
    if (item.id === 'invalid') {
      assert.match(await detail.innerText(), /Pełna chronologia niepotwierdzona/);
      assert.match(await detail.innerText(), /Nie można sprawdzić okresu/);
    }
    await detail.screenshot({ path: `docs/evidence/ats-timeline-${item.id}-2026-10-06.png`, animations: 'disabled' });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: rzeczywisty AtsLabView rozróżnia niepełną chronologię, sygnały do sprawdzenia i brak sygnałów bez fikcyjnej oceny liczbowej.');
} finally { await browser.close(); }
