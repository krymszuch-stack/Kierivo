import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
const pending = [];
const rewrites = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname === '/api/advisor/status') return route.fulfill({ json: { success: true, available: true, connected: true } });
    if (url.pathname === '/api/advisor/chat') {
      pending.push(route);
      return;
    }
    if (url.pathname === '/api/advisor/rewrite-section') {
      rewrites.push(route);
      return;
    }
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
    clientEnv.supabaseUrl = null;
    clientEnv.supabaseAnonKey = null;
    const react = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { AuthProvider, useAuth } = await import('/src/context/AuthContext.tsx');
    const { GeminiAdvisorModal } = await import('/src/features/advisor/GeminiAdvisorModal.tsx');
    const { readAdvisorConversation } = await import('/src/features/advisor/advisorConversationCache.ts');
    const createElement = react.createElement ?? react.default.createElement;
    function Probe() {
      const auth = useAuth();
      window.__profileProof = { auth, readAdvisorConversation };
      return createElement(GeminiAdvisorModal, { isOpen: true, onClose: () => {} });
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview'));
    window.__a11yRoot = root;
    root.render(createElement(AuthProvider, null, createElement(Probe)));
  });
  await page.getByRole('textbox', { name: 'Pytanie do Doradcy zaufanego' }).waitFor();
  await page.getByRole('button', { name: 'Asystent Rewritingu (STAR / ATS)' }).click();
  const text = page.getByRole('textbox', { name: 'Treść punktu lub sekcji do ulepszenia:', exact: true });
  assert.equal(await text.count(), 1, 'Pole redakcji musi mieć nazwę powiązaną z widoczną etykietą');
  await page.getByText('Treść punktu lub sekcji do ulepszenia:', { exact: true }).click();
  assert.equal(await text.evaluate((node) => node === document.activeElement), true);
  await text.fill('Obsługiwałem zgłoszenia klientów.');
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('textbox', { name: 'Rola / Stanowisko (kontekst)' }).evaluate((node) => node === document.activeElement), true);
  await page.keyboard.press('Tab');
  const star = page.getByRole('button', { name: 'Metoda STAR', exact: true });
  const ats = page.getByRole('button', { name: 'Standard ATS', exact: true });
  assert.equal(await star.evaluate((node) => node === document.activeElement), true);
  assert.equal(await star.getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  assert.equal(await ats.getAttribute('aria-pressed'), 'true');
  assert.equal(await star.getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  assert.equal(await page.getByRole('checkbox').isChecked(), true);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  assert.equal(rewrites.length, 1);
  assert.equal(rewrites[0].request().postDataJSON().ruleFocus, 'ats_clarity');
  await rewrites[0].fulfill({ json: { success: true, originalText: 'Obsługiwałem zgłoszenia klientów.', proposedText: 'Obsługiwałem zgłoszenia klientów.', ruleExplanation: 'Syntetyczna próba klawiatury.', appliedRules: [], model: 'syntetyczny endpoint' } });
  await page.getByText('Podgląd propozycji zmian', { exact: true }).waitFor();
  const confirmation = page.getByRole('checkbox').last();
  await confirmation.focus();
  await page.keyboard.press('Space');
  assert.equal(await confirmation.isChecked(), true);
  assert.equal(await page.getByRole('button', { name: /skopiuj/i }).isEnabled(), true);
  await page.screenshot({ path: 'docs/evidence/rewriter-keyboard-2026-10-03.png', animations: 'disabled' });
  await page.evaluate(async () => {
    const react = await import('/node_modules/.vite/deps/react.js');
    const createElement = react.createElement ?? react.default.createElement;
    const { PersonalSection } = await import('/src/features/vault/PersonalSection.tsx');
    const { AchievementEditor } = await import('/src/features/vault/AchievementEditor.tsx');
    const { ExperienceSection } = await import('/src/features/vault/ExperienceSection.tsx');
    const { CVParserModal } = await import('/src/features/parser/CVParserModal.tsx');
    const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
    const vault = createEmptyVault('Profil syntetyczny', 'synthetic@example.invalid');
    const history = [{ id: 'keyboard-work', company: 'Firma testowa', role: 'Magazynier', location: '', startDate: '2024-01', endDate: '2025-01', isCurrent: false, description: '', highlights: [] }];
    window.__a11yRoot.render(createElement(react.Fragment ?? react.default.Fragment, null,
      createElement(PersonalSection, { data: vault.personalInfo, onChange: () => {} }),
      createElement(AchievementEditor, { highlights: [{ id: 'keyboard-highlight', text: '', keywords: [] }], onChange: () => {} }),
      createElement(ExperienceSection, { history, onChange: () => {} }),
      createElement(CVParserModal, { currentVault: vault, onApplyVault: () => {} }),
    ));
  });
  const summary = page.getByRole('textbox', { name: 'Podsumowanie Profilu Zawodowego', exact: true });
  await summary.waitFor();
  await page.getByText('Podsumowanie Profilu Zawodowego', { exact: true }).click();
  assert.equal(await summary.evaluate((node) => node === document.activeElement), true);
  assert.equal(await page.getByRole('textbox', { name: 'Treść osiągnięcia 1', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Edytuj szczegóły Magazynier', exact: true }).click();
  const description = page.getByRole('textbox', { name: 'Ogólny Opis Roli i Zakres Odpowiedzialności (opcjonalne)', exact: true });
  await description.waitFor();
  await page.getByText('Ogólny Opis Roli i Zakres Odpowiedzialności (opcjonalne)', { exact: true }).click();
  assert.equal(await description.evaluate((node) => node === document.activeElement), true);
  await page.getByRole('tab', { name: 'Wklej treść', exact: true }).click();
  await page.getByRole('textbox', { name: 'Treść CV', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: etykieta nazywa i fokusuje pole; Tab/Enter/Space wybierają reguły, zgodę, generowanie i potwierdzenie faktów.');
  console.log('PASS: parser CV, osiągnięcia, podsumowanie i opis roli mają dostępne nazwy; widoczne etykiety podsumowania i opisu przenoszą fokus.');
} finally {
  await browser.close();
}
