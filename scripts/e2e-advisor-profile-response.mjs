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
  await page.waitForFunction(() => Boolean(window.__profileProof));
  await page.evaluate(() => window.__profileProof.auth.signInLocally('Profil A', 'a@example.invalid'));
  const profileA = await page.evaluate(() => window.__profileProof.auth.user.id);
  const input = page.getByRole('textbox', { name: 'Pytanie do Doradcy zaufanego' });
  const send = page.getByRole('button', { name: 'Wyślij', exact: true });
  await input.waitFor();
  await page.getByRole('checkbox').check();
  await input.fill('Pytanie profilu A');
  await send.click();
  await page.waitForTimeout(100);
  assert.equal(pending.length, 1);
  await page.evaluate(() => window.__profileProof.auth.signInLocally('Profil B', 'b@example.invalid'));
  const profileB = await page.evaluate(() => window.__profileProof.auth.user.id);
  assert.notEqual(profileA, profileB);
  await input.waitFor();
  assert.equal(await page.getByRole('checkbox').isChecked(), false, 'Nowy profil wymaga własnej zgody');
  await page.getByRole('checkbox').check();
  await input.fill('Pytanie profilu B');
  await send.click();
  await page.waitForTimeout(100);
  assert.equal(pending.length, 2);
  await pending[0].fulfill({ json: { success: true, reply: 'POUFNA_ODPOWIEDZ_A', model: 'syntetyczny endpoint' } });
  await page.waitForTimeout(700);
  assert.equal(await page.getByText('POUFNA_ODPOWIEDZ_A', { exact: true }).count(), 0, 'Odpowiedź A nie może pojawić się u B');
  const cacheB = await page.evaluate((id) => window.__profileProof.readAdvisorConversation(id), profileB);
  assert.ok(!JSON.stringify(cacheB).includes('POUFNA_ODPOWIEDZ_A'), 'Cache B nie może zawierać odpowiedzi A');
  assert.equal(await send.isDisabled(), true, 'Stare finally nie może zakończyć stanu ładowania B');
  await pending[1].fulfill({ json: { success: true, reply: 'Odpowiedź tylko dla profilu B.', model: 'syntetyczny endpoint' } });
  await page.getByText('Odpowiedź tylko dla profilu B.', { exact: true }).waitFor();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/evidence/advisor-profile-response-isolation-2026-10-02.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Asystent Rewritingu (STAR / ATS)' }).click();
  await page.locator('textarea').fill('Prywatny fragment profilu B do poprawy.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Ulepsz ten punkt', exact: true }).click();
  await page.waitForTimeout(100);
  assert.equal(rewrites.length, 1);
  await page.evaluate(() => window.__profileProof.auth.signInLocally('Profil C', 'c@example.invalid'));
  await page.waitForTimeout(150);
  assert.equal(await page.locator('textarea').inputValue(), '');
  assert.equal(await page.getByRole('checkbox').isChecked(), false);
  await rewrites[0].fulfill({ json: { success: true, originalText: 'Fragment B', proposedText: 'POUFNA_PROPOZYCJA_B', ruleExplanation: 'Próba syntetyczna', appliedRules: [], model: 'syntetyczny endpoint' } });
  await page.waitForTimeout(700);
  assert.equal(await page.getByText('POUFNA_PROPOZYCJA_B', { exact: true }).count(), 0);
  await page.screenshot({ path: 'docs/evidence/advisor-rewriter-profile-isolation-2026-10-02.png', animations: 'disabled' });
  assert.deepEqual(errors, []);
  console.log('PASS: spóźniona odpowiedź A nie trafia do widoku ani cache B; B udziela własnej zgody i otrzymuje własną odpowiedź.');
  console.log('PASS: zmiana profilu usuwa fragment i zgodę rewritingu; spóźniona propozycja poprzednika nie jest wyświetlana.');
} finally {
  await browser.close();
}
