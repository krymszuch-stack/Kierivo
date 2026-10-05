import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
const forbiddenClaims = /6[- ]sekund|Parser ATS|Brak halucynacji|pełna zgodność z bazą faktów|Klauzula zgodna z RODO|Daty zatrudnienia i edukacji są spójne\./iu;
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname.endsWith('/ai/verify-cv')) return route.fulfill({ json: { success: true, report: {
      hasJobDescription: false, overallScore: null, verdict: null, summary: 'Syntetyczna opinia do kontroli opisu funkcji.',
      atsLoop: { atsScore: null, parsedRole: '', recognizedKeywords: [], missingCriticalKeywords: [], atsFormatRisks: [] },
      recruiterLoop: { recruiterScore: 60, headlineClarity: 'AVERAGE', strengthsFound: [], weaknessesOrFluff: [], achievementMetricRatePct: null },
      logicComplianceLoop: { consistencyScore: 60, chronologyValid: true, timelineAnomalies: [], logicalInconsistencies: [], rodoCompliant: null, privacyRisks: [] },
      actionableRecommendations: [],
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
    clientEnv.apiUrl = '/api';
    clientEnv.backendConfigured = false;
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
    window.__scopeAudit = { root, createElement, vault };
    root.render(createElement(Cv360VerifierModal, { isOpen: true, onClose: () => {}, vault, currentUser: { id: 'synthetic-owner', name: 'Profil syntetyczny' } }));
  });
  await page.getByRole('checkbox').waitFor();
  assert.doesNotMatch(await page.locator('body').innerText(), forbiddenClaims);
  await page.getByText(/Sprawdzenie pliku PDF, prawdziwości deklaracji i klauzuli RODO/).waitFor();
  await page.screenshot({ path: 'docs/evidence/cv360-scope-copy-2026-10-04.png', animations: 'disabled' });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Uruchom analizę profilu AI', exact: true }).click();
  await page.getByText('Syntetyczna opinia do kontroli opisu funkcji.', { exact: true }).waitFor();
  await page.getByRole('button', { name: /Spójność i logika/ }).click();
  assert.doesNotMatch(await page.locator('body').innerText(), forbiddenClaims);
  await page.getByText(/Według AI daty nie wskazują sprzeczności/).waitFor();
  await page.screenshot({ path: 'docs/evidence/cv360-scope-result-2026-10-04.png', animations: 'disabled' });
  await page.evaluate(async () => {
    const { root, createElement, vault } = window.__scopeAudit;
    const { CVExportModal } = await import('/src/components/ui/CVExportModal.tsx');
    root.render(createElement(CVExportModal, { isOpen: true, onClose: () => {}, vault, initialMode: 'audit', onAuditOpen: () => { window.__scopeAudit.opened = true; } }));
  });
  await page.getByRole('button', { name: 'Otwórz analizę profilu AI', exact: true }).waitFor();
  assert.doesNotMatch(await page.locator('body').innerText(), forbiddenClaims);
  await page.getByText(/Sprawdzenie pliku PDF, prawdziwości deklaracji i klauzuli RODO/).waitFor();
  await page.waitForFunction(() => {
    const modal = document.querySelector('.shadow-floating');
    return modal && Number(getComputedStyle(modal).opacity) >= 0.99;
  });
  await page.screenshot({ path: 'docs/evidence/cv-export-audit-scope-2026-10-04.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Otwórz analizę profilu AI', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__scopeAudit.opened), true);
  await page.evaluate(async () => {
    const { root, createElement, vault } = window.__scopeAudit;
    const { CVExportModal } = await import('/src/components/ui/CVExportModal.tsx');
    root.render(createElement(CVExportModal, { isOpen: true, onClose: () => {}, vault, initialMode: 'audit' }));
  });
  await page.getByRole('button', { name: 'Otwórz analizę profilu AI', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Otwórz analizę profilu AI', exact: true }).isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: oba ekrany opisują opinię AI o profilu i granice weryfikacji; wynik chronologii jest przypisany modelowi; przycisk otwarcia uruchamia callback.');
} finally {
  await browser.close();
}
