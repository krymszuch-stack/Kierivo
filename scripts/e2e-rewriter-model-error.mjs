import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const sourceText = process.env.REWRITE_ERROR_SOURCE || 'Obsługiwałem zgłoszenia klientów.';
const evidencePath = process.env.REWRITE_ERROR_EVIDENCE || 'docs/evidence/rewriter-model-json-error-2026-10-02.png';
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
    const { ToastHost } = await import('/src/components/ui/ToastHost.tsx');
    const { readAdvisorConversation } = await import('/src/features/advisor/advisorConversationCache.ts');
    const createElement = react.createElement ?? react.default.createElement;
    function Probe() {
      const auth = useAuth();
      window.__profileProof = { auth, readAdvisorConversation };
      return createElement(react.Fragment ?? react.default.Fragment, null, createElement(GeminiAdvisorModal, { isOpen: true, onClose: () => {} }), createElement(ToastHost));
    }
    (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview'))
      .render(createElement(AuthProvider, null, createElement(Probe)));
  });
  await page.getByRole('textbox', { name: 'Pytanie do Doradcy zaufanego' }).waitFor();
  await page.getByRole('button', { name: 'Asystent Rewritingu (STAR / ATS)' }).click();
  await page.locator('textarea').fill(sourceText);
  await page.getByRole('checkbox').check();
  const generate = page.getByRole('button', { name: 'Ulepsz ten punkt', exact: true });
  await generate.click();
  await page.waitForTimeout(100);
  assert.equal(rewrites.length, 1);
  // Syntetyczna odpowiedź o kształcie errorHandler; rzeczywistą trasę z błędnym
  // JSON-em dostawcy sprawdzają trustedAdvisorRoutes.test.ts.
  await rewrites[0].fulfill({ status: 502, json: { success: false, error: 'Wystąpił nieoczekiwany błąd serwera. Spróbuj ponownie za chwilę.', requestId: 'synthetic-model-json-error' } });
  await page.getByText('Wystąpił nieoczekiwany błąd serwera. Spróbuj ponownie za chwilę.', { exact: true }).waitFor();
  assert.equal(await page.getByText('Podgląd propozycji zmian', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /skopiuj/i }).count(), 0);
  assert.equal(await generate.isEnabled(), true);
  assert.equal(await page.locator('textarea').inputValue(), sourceText);
  await page.waitForFunction(() => {
    const title = [...document.querySelectorAll('p')].find((node) => node.textContent === 'Wystąpił nieoczekiwany błąd serwera. Spróbuj ponownie za chwilę.');
    return title && Number(getComputedStyle(title.parentElement.parentElement).opacity) >= 0.99;
  });
  await page.screenshot({ path: evidencePath, animations: 'disabled' });
  await generate.click();
  await page.waitForTimeout(100);
  assert.equal(rewrites.length, 2);
  await rewrites[1].fulfill({ json: { success: true, originalText: sourceText, proposedText: sourceText, ruleExplanation: 'Syntetyczna próba odzyskania po błędzie.', appliedRules: [], model: 'syntetyczny endpoint' } });
  await page.getByText('Podgląd propozycji zmian', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /skopiuj/i }).isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: odpowiedź 502 nie tworzy propozycji ani kopiowania; formularz zachowuje tekst i umożliwia ponowienie; poprawna odpowiedź przywraca podgląd bez zatwierdzenia faktów.');
} finally {
  await browser.close();
}
