import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
  'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: 'Europe/Warsaw' });
const errors = [];
const september = new Date('2026-09-15T12:00:00.000Z');
const october = new Date('2026-10-15T12:00:00.000Z');
const offer = 'Magazynier — syntetyczna oferta do próby audytowej\nWymagania:\nMaksymalnie 2 lata doświadczenia zawodowego.';
const profileId = 'local-analysis-month-proof';

function envelope(value) {
  const data = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i += 1) hash = Math.imul(hash ^ data.charCodeAt(i), 0x01000193);
  return JSON.stringify({ cvel: 2, crc: (hash >>> 0).toString(16).padStart(8, '0'), data });
}

async function newPage() {
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  return page;
}

async function isolate(page) {
  // Pozostawiamy preambułę React/Vite, ale główny App nie uruchamia efektów w izolowanej próbie.
  await page.route(`${BASE_URL}/`, async (route) => {
    const response = await route.fetch();
    const html = (await response.text())
      .replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '')
      .replace('</head>', '<link rel="stylesheet" href="/src/index.css"></head>')
      .replace('<div id="root"></div>', '<main id="audit-preview" style="max-width:1000px;margin:24px auto;padding:16px"></main>');
    assert.ok(!html.includes('/src/main.tsx'));
    await route.fulfill({ response, body: html });
  });
  await page.route('**/api/**', (route) => route.abort());
}

async function advanceMonth(page) {
  await page.clock.setSystemTime(october);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
}

try {
  const page = await newPage();
  await page.clock.setSystemTime(september);
  await page.goto(BASE_URL);
  const fixture = await page.evaluate(async () => {
    const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
    const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
    vault.updatedAt = '2026-09-01T10:00:00.000Z';
    vault.personalInfo.title = 'Magazynier';
    vault.history = [{ id: 'current-warehouse', company: 'Firma testowa', role: 'Magazynier', location: '',
      startDate: '2024-09', endDate: '', isCurrent: true,
      description: 'Przyjmowanie dostaw i kontrola dokumentacji magazynowej.', highlights: [] }];
    return vault;
  });
  await page.evaluate(({ profileRaw, vaultRaw, id }) => {
    localStorage.setItem('cvelocity:profile', profileRaw);
    localStorage.setItem(`cvelocity:vault:${id}`, vaultRaw);
  }, { id: profileId, profileRaw: envelope({ id: profileId, name: 'Syntetyczny profil audytowy', type: 'local', createdAt: '2026-09-01T10:00:00.000Z' }), vaultRaw: envelope(fixture) });
  await page.reload();
  async function analyze() {
    await page.getByRole('button', { name: /Wklej ofert/ }).click();
    await page.locator('#saved-profile-job-description').fill(offer);
    await page.getByRole('button', { name: /Sprawd/ }).click();
    await page.getByRole('tab', { name: /Dopasowanie.*Rachunek/ }).waitFor();
  }
  async function snapshot() {
    return page.evaluate(async ({ id, jd }) => {
      const { scoreCanonicalAts } = await import('/src/lib/canonicalAts.ts');
      const { getAnalysisFreshness } = await import('/src/lib/analysisFreshness.ts');
      const raw = localStorage.getItem(`cvelocity:last-job-analysis:${id}`);
      const vaultRaw = localStorage.getItem(`cvelocity:vault:${id}`);
      const summary = JSON.parse(JSON.parse(raw).data);
      const vault = JSON.parse(JSON.parse(vaultRaw).data);
      return { raw, vaultRaw, summary, result: scoreCanonicalAts(vault, jd, 'Magazynier'), freshness: getAnalysisFreshness(summary, vault.updatedAt) };
    }, { id: profileId, jd: offer });
  }
  await analyze();
  const before = await snapshot();
  assert.equal(before.result.components.experience, 100);
  assert.equal(before.summary.calculationMonth, '2026-09');
  assert.equal(before.freshness, 'current');
  await advanceMonth(page);
  await page.getByText('Analiza wymaga odświeżenia', { exact: true }).waitFor();
  assert.equal(await page.getByRole('tab', { name: /Dopasowanie.*Rachunek/ }).count(), 0);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'docs/evidence/analysis-month-matcher-expired-2026-10-02.png', fullPage: true, animations: 'disabled' });
  const after = await snapshot();
  assert.equal(after.raw, before.raw);
  assert.equal(after.vaultRaw, before.vaultRaw);
  assert.equal(after.result.components.experience, 0);
  assert.notEqual(after.result.score, before.result.score);
  assert.equal(after.freshness, 'stale');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByText(/Od tej analizy zmienił się miesiąc/).waitFor();
  await page.getByText(`Wynik historyczny: ${before.summary.score}%`, { exact: true }).waitFor();
  await page.getByText('Mocne strony w zapisanej analizie', { exact: true }).waitFor();
  await page.getByText('Braki w zapisanej analizie', { exact: true }).waitFor();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'docs/evidence/home-analysis-month-expired-2026-10-02.png', fullPage: true, animations: 'disabled' });
  await analyze();
  const refreshed = await snapshot();
  assert.equal(refreshed.summary.calculationMonth, '2026-10');
  assert.equal(refreshed.freshness, 'current');
  assert.equal(refreshed.vaultRaw, before.vaultRaw);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByText('Ostatnia analiza', { exact: true }).waitFor();
  assert.equal(await page.getByText(/Od tej analizy zmienił się miesiąc/).count(), 0);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'docs/evidence/home-analysis-month-refreshed-2026-10-02.png', fullPage: true, animations: 'disabled' });
  console.log(`PASS: rzeczywisty Matcher i Start; staż 100 → 0, wynik ${before.result.score} → ${after.result.score}; profil i zapis niezmienione do ponownej analizy.`);

  const cv = 'Jan Testowy\njan@example.invalid\nMagazynier\nDoświadczenie zawodowe\n2024-09 - obecnie\nMagazynier, Firma testowa\nPrzyjmowanie dostaw i kontrola dokumentacji magazynowej.\nUmiejętności\nOrganizacja pracy, obsługa magazynu.';
  for (const component of ['QuickAtsCheck', 'QuickOnboardingFlow']) {
    const quick = await newPage();
    await isolate(quick);
    await quick.clock.setSystemTime(september);
    await quick.goto(BASE_URL);
    await quick.evaluate(async ({ component, cv, offer }) => {
      const react = await import('/node_modules/.vite/deps/react.js');
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const module = await import(component === 'QuickAtsCheck' ? '/src/features/quickcheck/QuickAtsCheck.tsx' : '/src/features/onboarding/QuickOnboardingFlow.tsx');
      const createRoot = dom.createRoot ?? dom.default?.createRoot;
      const createElement = react.createElement ?? react.default?.createElement;
      createRoot(document.getElementById('audit-preview')).render(createElement(module[component],
        component === 'QuickAtsCheck' ? { onSaveProfile: () => {}, onOpenEditor: () => {} }
          : { onShowDetails: () => {}, initialCvText: cv, initialJdText: offer }));
    }, { component, cv, offer });
    if (component === 'QuickAtsCheck') {
      await quick.locator('textarea').nth(0).fill(cv);
      await quick.locator('textarea').nth(1).fill(offer);
    }
    await quick.getByRole('button', { name: /Sprawdź/ }).first().click();
    await quick.getByTestId(component === 'QuickAtsCheck' ? 'quick-ats-result' : 'quick-onboarding-result').waitFor();
    await advanceMonth(quick);
    await quick.getByText('Analiza wymaga odświeżenia', { exact: true }).waitFor();
    await quick.waitForTimeout(1300);
    await quick.screenshot({ path: `docs/evidence/analysis-month-${component}-expired-2026-10-02.png`, fullPage: true, animations: 'disabled' });
    await quick.getByRole('button', { name: 'Przelicz analizę', exact: true }).click();
    await quick.getByText('Analiza wymaga odświeżenia', { exact: true }).waitFor({ state: 'hidden' });
    console.log(`PASS: ${component}; otwarty wynik wymaga przeliczenia po zmianie miesiąca, przeliczenie usuwa ostrzeżenie.`);
    await quick.close();
  }

  const timer = await newPage();
  await isolate(timer);
  await timer.clock.install({ time: new Date('2026-09-30T21:59:59.000Z') });
  await timer.goto(BASE_URL);
  await timer.evaluate(async () => {
    const react = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { useAnalysisClock } = await import('/src/hooks/useAnalysisClock.ts');
    const { getAnalysisMonth } = await import('/src/lib/analysisPeriod.ts');
    const createRoot = dom.createRoot ?? dom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    function ClockProof() { return createElement('p', null, getAnalysisMonth(useAnalysisClock())); }
    createRoot(document.getElementById('audit-preview')).render(createElement(ClockProof));
  });
  await timer.getByText('2026-09', { exact: true }).waitFor();
  await timer.clock.runFor(2000);
  await timer.getByText('2026-10', { exact: true }).waitFor();
  console.log('PASS: rzeczywisty hook zmienia miesiąc na lokalnej północy bez visibilitychange i bez przeładowania.');
  assert.deepEqual(errors, [], 'Błędy przeglądarki');
} finally {
  await browser.close();
}
