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
    (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview'))
      .render(createElement(AuthProvider, null, createElement(Probe)));
  });
  await page.getByRole('textbox', { name: 'Pytanie do Doradcy zaufanego' }).waitFor();
  await page.getByRole('button', { name: 'Asystent Rewritingu (STAR / ATS)' }).click();
  const text = page.locator('textarea');
  const generate = page.getByRole('button', { name: 'Ulepsz ten punkt', exact: true });
  await text.fill('Przyjmowałem dostawy i sprawdzałem dokumentację.');
  await page.getByRole('checkbox').check();
  await generate.click();
  await page.waitForTimeout(100);
  assert.equal(rewrites.length, 1);
  await text.fill('Kontrolowałem stany magazynowe i kompletowałem zamówienia.');
  await rewrites[0].fulfill({ json: { success: true, originalText: 'Przyjmowałem dostawy i sprawdzałem dokumentację.', proposedText: 'NIEAKTUALNA_PROPOZYCJA', ruleExplanation: 'Próba syntetyczna', appliedRules: [], model: 'syntetyczny endpoint' } });
  await page.waitForTimeout(500);
  assert.equal(await page.getByText('NIEAKTUALNA_PROPOZYCJA', { exact: true }).count(), 0, 'Zmiana tekstu unieważnia spóźnioną propozycję');
  await generate.click();
  await page.waitForTimeout(100);
  assert.equal(rewrites.length, 2);
  assert.equal(rewrites[1].request().postDataJSON().text, 'Kontrolowałem stany magazynowe i kompletowałem zamówienia.');
  await rewrites[1].fulfill({ json: { success: true, originalText: 'Kontrolowałem stany magazynowe i kompletowałem zamówienia.', proposedText: 'BIEZACA_PROPOZYCJA', ruleExplanation: 'Próba syntetyczna', appliedRules: [], model: 'syntetyczny endpoint' } });
  await page.getByText('BIEZACA_PROPOZYCJA', { exact: true }).waitFor();
  await page.getByRole('checkbox').last().check();
  const copy = page.getByRole('button', { name: /skopiuj/i });
  assert.equal(await copy.isEnabled(), true);
  await page.getByRole('textbox', { name: 'Rola / Stanowisko (kontekst)' }).fill('Magazynier');
  assert.equal(await page.getByText('BIEZACA_PROPOZYCJA', { exact: true }).count(), 0, 'Zmiana roli usuwa propozycję i jej zatwierdzenie');
  assert.equal(await copy.count(), 0);
  await generate.click();
  await page.waitForTimeout(100);
  assert.equal(rewrites.length, 3);
  await rewrites[2].fulfill({ json: { success: true, originalText: await text.inputValue(), proposedText: 'PROPOZYCJA_DLA_NOWEJ_ROLI', ruleExplanation: 'Próba syntetyczna', appliedRules: [], model: 'syntetyczny endpoint' } });
  await page.getByText('PROPOZYCJA_DLA_NOWEJ_ROLI', { exact: true }).waitFor();
  assert.equal(await page.getByRole('checkbox').last().isChecked(), false, 'Nowa propozycja wymaga ponownego sprawdzenia faktów');
  assert.equal(await copy.isDisabled(), true);
  await page.getByRole('checkbox').last().check();
  await page.getByRole('button', { name: 'Standard ATS', exact: true }).click();
  assert.equal(await copy.count(), 0, 'Zmiana reguł usuwa zatwierdzoną propozycję');
  await generate.click();
  await page.waitForTimeout(100);
  assert.equal(rewrites.length, 4);
  assert.equal(rewrites[3].request().postDataJSON().ruleFocus, 'ats_clarity');
  await page.getByRole('button', { name: 'Monter', exact: true }).click();
  await rewrites[3].fulfill({ json: { success: true, originalText: 'Stara treść', proposedText: 'PROPOZYCJA_SPRZED_PRZYKLADU', ruleExplanation: 'Próba syntetyczna', appliedRules: [], model: 'syntetyczny endpoint' } });
  await page.waitForTimeout(500);
  assert.equal(await page.getByText('PROPOZYCJA_SPRZED_PRZYKLADU', { exact: true }).count(), 0);
  await page.getByText(/Treść lub kryteria zmieniły się/).waitFor();
  await page.screenshot({ path: 'docs/evidence/rewriter-input-freshness-2026-10-02.png', animations: 'disabled' });
  assert.deepEqual(errors, []);
  console.log('PASS: zmiana tekstu odrzuca spóźnioną propozycję; ponowne żądanie używa nowej treści; zmiana roli usuwa propozycję i zatwierdzenie.');
  console.log('PASS: nowa propozycja wymaga nowego sprawdzenia faktów; reguły i przykład również unieważniają wynik.');
} finally {
  await browser.close();
}
