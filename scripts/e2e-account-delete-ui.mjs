import assert from 'node:assert/strict';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname === '/src/context/AuthContext.tsx') return route.fulfill({ contentType: 'application/javascript', body: 'export const useAuth = () => window.__deleteUi.auth;' });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 501, body: '{}' });
    if (url.pathname === '/') {
      const response = await route.fetch();
      const html = (await response.text()).replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '').replace('</head>', '<link rel="stylesheet" href="/src/index.css"></head>').replace('<div id="root"></div>', '<main id="audit-preview"></main>');
      return route.fulfill({ response, body: html });
    }
    return route.continue();
  });
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    const c = window.__deleteUi = { calls: 0, logoutCalls: 0, confirm: false, reloads: 0 };
    window.confirm = () => c.confirm;
    const originalTimeout = window.setTimeout;
    window.setTimeout = (fn, delay, ...args) => delay === 1200 ? (++c.reloads, 0) : originalTimeout(fn, delay, ...args);
    c.auth = {
      user: { id: 'synthetic-ui', name: 'Profil syntetyczny' }, mode: 'cloud',
      logout: async () => { c.logoutCalls += 1; return { ok: true, message: '' }; },
      deleteAccount: async () => { c.calls += 1; return new Promise((resolve, reject) => { c.resolve = resolve; c.reject = reject; }); },
    };
    const React = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { Topbar } = await import('/src/components/layout/Topbar.tsx');
    const { ThemeProvider } = await import('/src/providers/ThemeProvider.tsx');
    const { AccessibilityProvider } = await import('/src/providers/AccessibilityProvider.tsx');
    const { useToasts } = await import('/src/store/useToastStore.ts');
    const e = React.createElement ?? React.default.createElement;
    function Flow() {
      const toasts = useToasts();
      return e('div', null,
        e(Topbar, { activeTab: 'home', isAuthenticated: true, userEmail: 'synthetic@example.invalid', onOpenMobileMenu() {}, onOpenAuthModal() {} }),
        e('section', { style: { padding: 48 } },
          e('h1', null, 'Audyt obsługi usuwania konta'),
          e('p', null, 'Rzeczywisty Topbar • syntetyczny kontrakt Auth • brak połączenia z serwerem'),
          ...toasts.map(t => e('p', { key: t.id, role: 'status' }, `${t.variant}: ${t.title} ${t.message ?? ''}`))));
    }
    (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview')).render(e(ThemeProvider, null, e(AccessibilityProvider, null, e(Flow))));
  });
  await page.getByRole('button', { name: /Profil/ }).click();
  await page.getByRole('button', { name: 'Usuń konto', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__deleteUi.calls), 0);
  await page.evaluate(() => {
    window.__deleteUi.confirm = true;
    const button = [...document.querySelectorAll('button')].find(b => b.textContent === 'Usuń konto');
    // Dwa zdarzenia w jednym zadaniu sprawdzają blokadę przed renderem Reacta.
    button.click(); button.click();
  });
  assert.equal(await page.evaluate(() => window.__deleteUi.calls), 1);
  assert.equal(await page.getByRole('button', { name: 'Usuń konto', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Wyloguj się', exact: true }).isDisabled(), true);
  await page.evaluate(() => window.__deleteUi.reject(new Error('Syntetyczne odrzucenie operacji')));
  await page.getByText(/Nie potwierdzono usunięcia danych/).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Usuń konto', exact: true }).isEnabled(), true);
  assert.equal(await page.evaluate(() => window.__deleteUi.reloads), 0);
  await page.screenshot({ path: 'docs/evidence/account-delete-ui-failure-2026-10-05.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Usuń konto', exact: true }).click();
  await page.evaluate(() => window.__deleteUi.resolve({ ok: false, message: 'Serwer nie potwierdził usunięcia konta.' }));
  await page.getByText(/Serwer nie potwierdził usunięcia konta/).waitFor();
  assert.equal(await page.evaluate(() => window.__deleteUi.reloads), 0);
  await page.getByRole('button', { name: 'Usuń konto', exact: true }).click();
  await page.evaluate(() => window.__deleteUi.resolve({ ok: true, message: '' }));
  await page.getByText(/Dane zostały usunięte/).waitFor();
  assert.equal(await page.evaluate(() => window.__deleteUi.reloads), 1);
  assert.equal(await page.evaluate(() => window.__deleteUi.calls), 3);
  assert.equal(await page.evaluate(() => window.__deleteUi.logoutCalls), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: anulowanie nie wywołuje usuwania; podwójne kliknięcie daje jedno wywołanie; wyjątek i brak potwierdzenia nie przeładowują strony; retry działa, sukces planuje jeden reload.');
} catch (error) {
  console.error('Błędy strony:', errors);
  console.error('Widoczny stan:', (await page.locator('body').innerText()).slice(0, 2000));
  throw error;
} finally { await browser.close(); }
