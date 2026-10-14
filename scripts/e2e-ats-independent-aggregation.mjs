import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(15_000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname === '/') {
      const response = await route.fetch();
      return route.fulfill({ response, body: (await response.text()).replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '') });
    }
    return route.continue();
  });
  await page.goto(BASE_URL);
  const result = await page.evaluate(async () => {
    const [React, dom, { AtsLabView }, { createEmptyVault }, { simulateMultiEngineATS }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/ats/AtsLabView.tsx'), import('/src/lib/sampleVault.ts'), import('/src/lib/atsSimulator.ts'),
      import('/src/index.css'),
    ]);
    const vault = createEmptyVault('Profil syntetyczny D17', 'd17@example.invalid');
    vault.personalInfo.title = 'Programista Python';
    vault.personalInfo.summary = 'Programista automatyzujący raporty i procesy operacyjne w Python i AWS.';
    vault.skillsMatrix.hardSkills = ['Python', 'AWS'];
    vault.history = [{ id: 'synthetic-role', company: 'Firma syntetyczna', role: 'Programista Python', location: 'Warszawa', startDate: '2020-01', endDate: '2024-01', isCurrent: false,
      description: 'Rozwijałem aplikacje Python i wdrażałem usługi AWS.',
      highlights: [{ id: 'synthetic-metric', text: 'Automatyzowałem raporty Python, skracając czas o 30%.', action: 'Automatyzowałem', target: 'raporty', tool: 'Python', metric: '30%', keywords: ['Python'] }] }];
    const jobOfferText = 'Programista Python. Wymagane: Python, AWS, Terraform. Minimum 2 lata doświadczenia.';
    const result = simulateMultiEngineATS(vault, jobOfferText, vault.personalInfo.title);
    const e = React.createElement ?? React.default.createElement;
    document.body.innerHTML = '<main id="d17"></main>';
    (dom.createRoot ?? dom.default.createRoot)(document.getElementById('d17')).render(e(AtsLabView, { profileId: 'synthetic-d17', vault, jobOfferText, targetRole: vault.personalInfo.title }));
    return result;
  });
  const derived = new Set(['przesiew_wymagan', 'konsensus_cvelocity']);
  assert.equal(result.engines.filter(engine => derived.has(engine.id) && engine.score !== null).length, 2);
  const scores = result.engines.filter(engine => !derived.has(engine.id) && engine.score !== null).map(engine => engine.score).sort((a, b) => a - b);
  assert.ok(scores.length > 0);
  const middle = Math.floor(scores.length / 2);
  const median = scores.length % 2 ? scores[middle] : Math.round((scores[middle - 1] + scores[middle]) / 2);
  assert.equal(result.assessedEngineCount, scores.length);
  assert.equal(result.medianScore, median);
  await page.getByText(`Mediana kontrolnych wskaznikow (${scores.length} modulow; nie ocena dopasowania): ${median}%`, { exact: true }).waitFor();
  await page.getByText(/Nie potwierdzono wymagań: terraform/).waitFor();
  await page.locator('#ocena-dopasowania').getByText(/Nie potwierdzono obowiązkowego wymogu: terraform/).waitFor();
  assert.equal(await page.getByText('Wysokie dopasowanie', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/ats-independent-aggregation.png', fullPage: true });
  // Drugi konsument: pełny onboarding z parserem, bez podmiany modułów.
  const onboarding = await browser.newPage();
  onboarding.on('pageerror', error => errors.push(error.message));
  await onboarding.goto(BASE_URL);
  await onboarding.getByRole('button', { name: 'Wklej ofertę pracy' }).click();
  await onboarding.locator('#onboarding-cv').fill([
    'Profil syntetyczny D17', 'Programista Python', 'd17@example.invalid',
    'Podsumowanie zawodowe', 'Rozwijałem aplikacje i automatyzowałem raporty w Python oraz AWS.',
    'Doświadczenie zawodowe', 'Programista Python — Firma syntetyczna | 2020–2024',
    'Rozwijałem aplikacje Python i wdrażałem usługi AWS.',
    'Umiejętności', 'Python, AWS',
  ].join('\n'));
  await onboarding.locator('#onboarding-jd').fill('Programista Python. Wymagane: Python, AWS, Terraform. Minimum 2 lata doświadczenia.');
  await onboarding.getByRole('button', { name: 'Sprawdź', exact: true }).click();
  const status = onboarding.getByTestId('quick-onboarding-status');
  await status.waitFor();
  assert.match(await status.innerText(), /Wymóg obowiązkowy niepotwierdzony/);
  assert.match(await status.innerText(), /terraform/i);
  assert.equal(await onboarding.getByText('Wysokie dopasowanie', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  await onboarding.screenshot({ path: 'docs/evidence/ats-mandatory-skill-onboarding.png', fullPage: true });
  console.log(`PASS: rzeczywisty AtsLabView pokazuje medianę ${median}% z ${scores.length} modułów źródłowych; dwa agregaty nie mają dodatkowego głosu.`);
  console.log('PASS: laboratorium i pełny onboarding wskazują brak wymaganego Terraform bez etykiety wysokiego dopasowania.');
} finally { await browser.close(); }
