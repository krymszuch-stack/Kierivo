import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname.endsWith('/ai/verify-cv')) return route.fulfill({ json: { success: true, report: {
      hasJobDescription: false, overallScore: null, verdict: null, summary: 'Syntetyczny raport sprzecznych deklaracji.',
      atsLoop: { atsScore: null, parsedRole: '', recognizedKeywords: [], missingCriticalKeywords: [], atsFormatRisks: [] },
      recruiterLoop: { recruiterScore: 60, headlineClarity: 'AVERAGE', strengthsFound: [], weaknessesOrFluff: [], achievementMetricRatePct: null },
      logicComplianceLoop: {
        consistencyScore: 60, chronologyValid: true,
        timelineAnomalies: ['Koniec pracy poprzedza początek.'],
        logicalInconsistencies: ['Deklarowane UDT nie znajduje potwierdzenia w opisie uprawnień.'],
        rodoCompliant: null, privacyRisks: [],
      },
      actionableRecommendations: [
        { priority: 1, category: 'ATS', title: 'Dodaj brakujące słowa z niepodanej oferty', description: 'Nieuzasadniona rekomendacja fixture.' },
        { priority: 2, category: 'RECRUITER', title: 'Doprecyzuj opis działania', description: 'Opisz zakres swojego zadania.' },
      ],
    } } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 501, json: { success: false, error: 'Syntetyczny endpoint audytowy.' } });
    if (url.pathname === '/') {
      const response = await route.fetch();
      const html = (await response.text())
        .replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '')
        .replace('</head>', '<link rel="stylesheet" href="/src/index.css"></head>')
        .replace('<div id="root"></div>', '<main id="audit-preview"></main>');
      return route.fulfill({ response, body: html });
    }
    return route.continue();
  });
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    const { clientEnv } = await import('/src/lib/clientEnv.ts');
    clientEnv.apiUrl = '/api'; clientEnv.backendConfigured = false;
    const react = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { Cv360VerifierModal } = await import('/src/features/matcher/Cv360VerifierModal.tsx');
    const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
    const { setAuthenticatedEntitlements, FREE_DAILY_AI_USES } = await import('/src/store/useEntitlements.ts');
    setAuthenticatedEntitlements({ status: 'free' }, { aiUses: FREE_DAILY_AI_USES });
    const createElement = react.createElement ?? react.default.createElement;
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview'));
    const vault = createEmptyVault('Profil syntetyczny');
    vault.personalInfo.summary = 'Przyjmowanie dostaw i kompletowanie zamówień w magazynie.';
    root.render(createElement(Cv360VerifierModal, { isOpen: true, onClose: () => {}, vault, currentUser: { id: 'synthetic-owner', name: 'Profil syntetyczny' } }));
  });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Uruchom analizę profilu AI', exact: true }).click();
  await page.getByText('Syntetyczny raport sprzecznych deklaracji.', { exact: true }).waitFor();
  await page.getByRole('button', { name: /Spójność i logika/ }).click();
  assert.equal(await page.getByText('Deklarowane UDT nie znajduje potwierdzenia w opisie uprawnień.', { exact: true }).count(), 1);
  assert.doesNotMatch(await page.locator('body').innerText(), /Według AI daty nie wskazują sprzeczności/u);
  assert.equal(await page.getByText('Dodaj brakujące słowa z niepodanej oferty', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Doprecyzuj opis działania', { exact: true }).count(), 1);
  await page.screenshot({ path: 'docs/evidence/cv360-findings-2026-10-04.png', animations: 'disabled' });
  await page.getByRole('button', { name: /Czytelność treści/ }).click();
  assert.doesNotMatch(await page.locator('body').innerText(), /Profil wolny od banałów/u);
  assert.deepEqual(errors, []);
  console.log('PASS: uwagi o deklaracjach są widoczne; anomalie dat wykluczają pozytywny komunikat; bez oferty nie ma zaleceń ATS.');
} finally {
  await browser.close();
}
