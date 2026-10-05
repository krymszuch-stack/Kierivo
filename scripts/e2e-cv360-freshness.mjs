import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const pending = [];
const errors = [];
const report = {
  hasJobDescription: false, overallScore: null, verdict: null, summary: 'Raport syntetyczny bieżącego ćwiczenia.',
  atsLoop: { atsScore: null, parsedRole: '', recognizedKeywords: [], missingCriticalKeywords: [], atsFormatRisks: [] },
  recruiterLoop: { recruiterScore: 60, headlineClarity: 'AVERAGE', strengthsFound: [], weaknessesOrFluff: [], achievementMetricRatePct: null },
  logicComplianceLoop: { consistencyScore: 60, chronologyValid: true, timelineAnomalies: [], logicalInconsistencies: [], rodoCompliant: null, privacyRisks: [] },
  actionableRecommendations: [],
};
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname.endsWith('/ai/verify-cv')) { pending.push(route); return; }
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
    vault.personalInfo.summary = 'Obsługa zgłoszeń i diagnoza usterek stanowisk pracy.';
    const props = { isOpen: true, onClose: () => {}, vault, targetRole: 'Technik wsparcia', currentUser: { id: 'synthetic-owner-a', name: 'Profil A syntetyczny' } };
    window.__cvAudit = { props, root, createElement, Cv360VerifierModal, render: () => root.render(createElement(Cv360VerifierModal, window.__cvAudit.props)) };
    window.__cvAudit.render();
  });
  const summary = page.getByText(report.summary, { exact: true });
  const start = page.getByRole('button', { name: 'Uruchom analizę profilu AI', exact: true });
  async function run() {
    await page.getByRole('checkbox').check();
    const count = pending.length;
    await start.click();
    while (pending.length === count) await page.waitForTimeout(20);
    return pending.at(-1);
  }
  async function update(patch) {
    await page.evaluate(value => {
      window.__cvAudit.props = { ...window.__cvAudit.props, ...value };
      window.__cvAudit.render();
    }, patch);
    await page.waitForTimeout(50);
  }
  let request = await run();
  await request.fulfill({ json: { success: true, report } });
  await summary.waitFor();
  await update({ targetRole: 'Magazynier' });
  assert.equal(await summary.count(), 0, 'Zmiana stanowiska wycofuje ukończony raport');
  assert.equal(await page.getByRole('checkbox').isChecked(), false);
  await page.screenshot({ path: 'docs/evidence/cv360-report-freshness-2026-10-03.png', animations: 'disabled' });

  const stale = await run();
  await update({ targetCompany: 'Firma testowa' });
  const current = await run();
  await stale.fulfill({ json: { success: true, report: { ...report, summary: 'NIEAKTUALNY_RAPORT' } } });
  await page.waitForTimeout(100);
  assert.equal(await page.getByText('NIEAKTUALNY_RAPORT', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Analiza profilu AI w toku...', { exact: true }).count(), 1, 'Stary finally nie kończy nowego audytu');
  assert.equal(current.request().postDataJSON().targetCompany, 'Firma testowa');
  await current.fulfill({ json: { success: true, report } });
  await summary.waitFor();

  await page.evaluate(() => {
    const a = window.__cvAudit;
    a.props = { ...a.props, vault: { ...a.props.vault, updatedAt: '2026-10-03T12:00:00.000Z' } };
    a.render();
  });
  await page.waitForTimeout(50);
  assert.equal(await summary.count(), 1, 'Sam zapis bez zmiany treści zachowuje raport');
  await update({ jobDescription: 'Wymagania: przyjmowanie dostaw w magazynie.' });
  assert.equal(await summary.count(), 0);
  request = await run();
  await request.fulfill({ json: { success: true, report } });
  await summary.waitFor();
  await page.evaluate(() => {
    const a = window.__cvAudit;
    a.props = { ...a.props, vault: { ...a.props.vault, personalInfo: { ...a.props.vault.personalInfo, summary: 'Przyjmowanie dostaw i kompletowanie zamówień.' } } };
    a.render();
  });
  await page.waitForTimeout(50);
  assert.equal(await summary.count(), 0, 'Zmiana treści CV wycofuje wynik');
  const profileA = await run();
  await update({ currentUser: { id: 'synthetic-owner-b', name: 'Profil B syntetyczny' } });
  await profileA.fulfill({ json: { success: true, report: { ...report, summary: 'RAPORT_PROFILU_A' } } });
  await page.waitForTimeout(100);
  assert.equal(await page.getByText('RAPORT_PROFILU_A', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('checkbox').isChecked(), false);
  request = await run();
  await update({ isOpen: false });
  await request.fulfill({ json: { success: true, report } });
  await update({ isOpen: true });
  assert.equal(await summary.count(), 0, 'Zamknięty audyt nie przywraca starego raportu po otwarciu');
  assert.equal(await page.getByRole('checkbox').isChecked(), false);
  const cancelled = await run();
  await page.getByRole('checkbox').uncheck();
  await cancelled.fulfill({ json: { success: true, report } });
  await page.waitForTimeout(100);
  assert.equal(await summary.count(), 0, 'Cofnięcie zgody nie przywraca oczekującego raportu');
  assert.equal(await start.isDisabled(), true);
  await page.screenshot({ path: 'docs/evidence/cv360-consent-withdrawn-2026-10-03.png', animations: 'disabled' });
  const oldError = await run();
  await update({ targetRole: 'Spawacz' });
  const newest = await run();
  await oldError.fulfill({ status: 502, json: { success: false, error: 'NIEAKTUALNY_BLAD', requestId: 'synthetic-old-error' } });
  await page.waitForTimeout(100);
  assert.equal(await page.getByText('NIEAKTUALNY_BLAD', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Analiza profilu AI w toku...', { exact: true }).count(), 1);
  await newest.fulfill({ json: { success: true, report } });
  await summary.waitFor();
  await page.getByRole('checkbox').uncheck();
  assert.equal(await summary.count(), 0, 'Cofnięcie zgody wycofuje ukończony raport');
  assert.deepEqual(errors, []);
  console.log('PASS: raport zależy od aktualnej roli, firmy, oferty, CV i właściciela; spóźniony wynik/finally nie zmienia nowego audytu; zamknięcie resetuje raport i zgodę.');
} finally {
  await browser.close();
}
