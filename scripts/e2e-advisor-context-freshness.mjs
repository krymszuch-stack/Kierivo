import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
  'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, timezoneId: 'Europe/Warsaw' });
const errors = [];
const requests = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  // Status i odpowiedź są jawnie syntetyczne. Żaden endpoint ani model chmurowy nie jest wywoływany.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname === '/api/advisor/status') return route.fulfill({ json: { success: true, available: true, connected: true } });
    if (url.pathname === '/api/advisor/chat') {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: { success: true, reply: 'Próba lokalna: odczytano pytanie.', model: 'syntetyczny endpoint audytowy' } });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 501, json: { success: false, error: 'Poza zakresem próby syntetycznej.' } });
    if (url.pathname === '/') {
      const response = await route.fetch();
      const html = (await response.text())
        .replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '')
        .replace('</head>', '<link rel="stylesheet" href="/src/index.css"></head>')
        .replace('<div id="root"></div>', '<main id="audit-preview"></main>');
      assert.ok(!html.includes('/src/main.tsx'));
      return route.fulfill({ response, body: html });
    }
    return route.continue();
  });
  await page.clock.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    const { clientEnv } = await import('/src/lib/clientEnv.ts');
    clientEnv.apiUrl = '/api';
    clientEnv.supabaseUrl = null;
    clientEnv.supabaseAnonKey = null;
    const react = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { AuthProvider } = await import('/src/context/AuthContext.tsx');
    const { GeminiAdvisorModal } = await import('/src/features/advisor/GeminiAdvisorModal.tsx');
    const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
    const { calculateJobMatch } = await import('/src/lib/jobMatcherEngine.ts');
    const createRoot = dom.createRoot ?? dom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const root = createRoot(document.getElementById('audit-preview'));
    const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
    vault.updatedAt = '2026-09-01T10:00:00.000Z';
    vault.history = [{ id: 'warehouse', company: 'Firma testowa', role: 'Magazynier', location: '',
      startDate: '2024-09', endDate: '', isCurrent: true,
      description: 'Przyjmowanie dostaw i kontrola dokumentacji magazynowej.', highlights: [] }];
    const offer = { id: 'proof', title: 'Magazynier', company: '', salary: '', location: '',
      description: 'Wymagania: maksymalnie 2 lata doświadczenia zawodowego.', requirements: [], remote: false, portal: 'synthetic', techStack: [] };
    let context = calculateJobMatch(vault, offer).advisorContext;
    window.__advisorProof = { vault, context, render(recalculate = false) {
      if (recalculate) context = calculateJobMatch(vault, offer).advisorContext;
      root.render(createElement(AuthProvider, null, createElement(GeminiAdvisorModal, {
        isOpen: true, onClose: () => {}, vault: { ...vault }, advisorContext: context,
        onNavigate: (target) => { window.__advisorNavigation = target; },
      })));
    } };
    window.__advisorProof.render();
  });
  const notice = page.getByText('Kontekst analizy wymaga odświeżenia', { exact: true });
  const suggestions = page.getByRole('region', { name: 'Najbliższe kroki po analizie CV' });
  await suggestions.waitFor();
  assert.equal(await notice.count(), 0);
  await page.getByRole('checkbox').check();
  async function send() {
    const previous = requests.length;
    await page.getByRole('textbox', { name: 'Pytanie do Doradcy zaufanego' }).fill('Jak ocenić dopasowanie?');
    await page.getByRole('button', { name: 'Wyślij', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Pytanie do Doradcy zaufanego"]')?.value === '');
    await page.getByText('Próba lokalna: odczytano pytanie.', { exact: true }).last().waitFor();
    assert.equal(requests.length, previous + 1);
    return requests.at(-1);
  }
  const current = await send();
  assert.equal(current.context.calculationMonth, '2026-09');
  assert.equal(current.context.atsScoreProvenance, 'canonical-v2');
  await page.clock.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await notice.waitFor();
  assert.equal(await suggestions.count(), 0);
  assert.equal((await send()).context, undefined);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'docs/evidence/advisor-context-month-expired-2026-10-02.png', animations: 'disabled' });
  console.log('PASS: po miesiącu UI wycofuje podpowiedzi, a rzeczywiste apiClient wysyła pytanie bez starego kontekstu.');
  await page.evaluate(() => window.__advisorProof.render(true));
  await notice.waitFor({ state: 'hidden' });
  await suggestions.waitFor();
  assert.equal((await send()).context.calculationMonth, '2026-10');
  await page.evaluate(() => {
    window.__advisorProof.vault.updatedAt = '2026-10-15T12:01:00.000Z';
    window.__advisorProof.render();
  });
  await notice.waitFor();
  await page.getByText(/Profil zmienił się po tej analizie/).waitFor();
  assert.equal((await send()).context, undefined);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'docs/evidence/advisor-context-profile-expired-2026-10-02.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Przejdź do ponownej analizy', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__advisorNavigation), 'aplikuj');
  console.log('PASS: zmiana rewizji wycofuje kontekst przy tym samym miesiącu; przycisk prowadzi do ponownej analizy.');
  assert.deepEqual(errors, []);
} catch (error) {
  console.error('Błędy strony:', errors);
  console.error((await page.locator('body').innerText()).slice(0, 2500));
  throw error;
} finally {
  await browser.close();
}
