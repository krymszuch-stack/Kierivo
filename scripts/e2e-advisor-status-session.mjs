import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
const statuses = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname === '/api/advisor/status') { statuses.push(route); return; }
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
    const createElement = react.createElement ?? react.default.createElement;
    function Probe() {
      const auth = useAuth();
      window.__profileProof = { auth };
      return createElement(GeminiAdvisorModal, { isOpen: true, onClose: () => {} });
    }
    (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview'))
      .render(createElement(AuthProvider, null, createElement(Probe)));
  });
  await page.waitForFunction(() => Boolean(window.__profileProof));
  await page.waitForTimeout(100);
  assert.equal(statuses.length, 1);
  await page.evaluate(() => window.__profileProof.auth.signInLocally('Profil A', 'a@example.invalid'));
  await page.waitForTimeout(150);
  assert.equal(statuses.length, 2, 'Zmiana profilu musi uruchomić własne sprawdzenie statusu');
  await statuses[1].fulfill({ json: { success: true, connected: true, available: true } });
  await page.getByRole('textbox', { name: 'Pytanie do Doradcy zaufanego' }).waitFor();
  await page.evaluate(() => window.__profileProof.auth.signInLocally('Profil B', 'b@example.invalid'));
  await page.waitForTimeout(150);
  assert.equal(statuses.length, 3);
  assert.equal(await page.getByRole('textbox', { name: 'Pytanie do Doradcy zaufanego' }).count(), 0, 'Profil B nie może używać dostępności A podczas sprawdzania');
  await page.getByRole('button', { name: 'Konsultacja & FAQ', exact: true }).click();
  await statuses[2].fulfill({ status: 401, json: { success: false, error: 'Syntetyczna odmowa sesji B.' } });
  await page.getByText('Zaloguj się, aby korzystać z Doradcy Azure.', { exact: true }).waitFor();
  await statuses[0].fulfill({ json: { success: true, connected: true, available: true } });
  await page.waitForTimeout(600);
  assert.equal(await page.getByRole('textbox', { name: 'Pytanie do Doradcy zaufanego' }).count(), 0, 'Spóźniony sukces nie może nadpisać odmowy B');
  await page.getByText('Zaloguj się, aby korzystać z Doradcy Azure.', { exact: true }).waitFor();
  await page.screenshot({ path: 'docs/evidence/advisor-status-session-isolation-2026-10-02.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Sprawdź ponownie', exact: true }).click();
  await page.waitForTimeout(100);
  assert.equal(statuses.length, 4);
  await page.evaluate(() => window.__profileProof.auth.signInLocally('Profil C', 'c@example.invalid'));
  await page.waitForTimeout(150);
  assert.equal(statuses.length, 5);
  await statuses[4].fulfill({ json: { success: true, connected: true, available: true } });
  await page.getByRole('textbox', { name: 'Pytanie do Doradcy zaufanego' }).waitFor();
  await statuses[3].fulfill({ status: 401, json: { success: false, error: 'Syntetyczna spóźniona odmowa B.' } });
  await page.waitForTimeout(600);
  await page.getByRole('textbox', { name: 'Pytanie do Doradcy zaufanego' }).waitFor();
  assert.equal(await page.getByText('Zaloguj się, aby korzystać z Doradcy Azure.', { exact: true }).count(), 0);
  await page.screenshot({ path: 'docs/evidence/advisor-status-late-denial-2026-10-02.png', animations: 'disabled' });
  assert.deepEqual(errors, []);
  console.log('PASS: każda sesja sprawdza status; poprzednia dostępność i spóźniony sukces nie udostępniają rozmowy profilowi B po odmowie.');
  console.log('PASS: spóźniona odmowa B nie nadpisuje potwierdzonej dostępności C.');
} finally {
  await browser.close();
}
