import assert from 'node:assert/strict';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname === '/src/context/AuthContext.tsx') return route.fulfill({ contentType: 'application/javascript', body: 'export const useAuth = () => window.__authAudit.auth;' });
    if (url.pathname === '/src/lib/leakedPassword.ts') return route.fulfill({ contentType: 'application/javascript', body: 'export const checkLeakedPassword = () => window.__authAudit.call("leak");' });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 501, body: '{}' });
    if (url.pathname === '/') {
      const response = await route.fetch();
      const html = (await response.text()).replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '').replace('</head>', '<link rel="stylesheet" href="/src/index.css"></head>').replace('<div id="root"></div>', '<main id="audit-preview"></main>');
      return route.fulfill({ response, body: html });
    }
    return route.continue();
  });
  async function setup(kind = 'auth') {
    await page.goto(BASE_URL);
    await page.evaluate(async kind => {
      const c = window.__authAudit = { calls: [], pending: {}, closed: 0, loaded: 0, toasts: [] };
      c.call = name => { c.calls.push(name); return new Promise((resolve, reject) => { c.pending[name] = { resolve, reject }; }); };
      const React = await import('/node_modules/.vite/deps/react.js');
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { AuthModal } = await import('/src/features/auth/AuthModal.tsx');
      const { PasswordRecoveryModal } = await import('/src/features/auth/PasswordRecoveryModal.tsx');
      const { ThemeProvider } = await import('/src/providers/ThemeProvider.tsx');
      const { useToasts } = await import('/src/store/useToastStore.ts');
      const e = React.createElement ?? React.default.createElement;
      const useState = React.useState ?? React.default.useState;
      function Flow() {
        const [open, setOpen] = useState(true);
        const [state, setState] = useState({ active: kind === 'recovery', revision: 1, owner: 'synthetic-A', error: kind === 'expired' ? 'Link wygasł' : null });
        c.setState = setState; c.setOpen = setOpen;
        c.auth = { user: null, cloudAvailable: true, oauthNotice: null, clearOAuthNotice() {},
          signInLocally: () => c.call('local'), resumeLocalProfile: () => c.call('resume'),
          signInCloud: () => c.call('login'), signUpCloud: () => c.call('signup'), signInWithProvider: () => c.call('oauth'), requestPasswordReset: () => c.call('reset'),
          session: { user: { id: state.owner, email: 'synthetic@example.invalid' } }, passwordRecoveryActive: state.active, passwordRecoveryRevision: state.revision, passwordRecoveryError: state.error,
          updateRecoveredPassword: () => c.call('update'), logout: () => c.call('logout'), clearPasswordRecoveryError: () => setState(s => ({ ...s, error: null })),
        };
        const toasts = useToasts(); c.toasts = toasts;
        return e('section', { style: { padding: 32 } }, e('h1', null, 'Audyt operacji formularzy konta'), e('p', null, 'Rzeczywiste modale • syntetyczny kontrakt Auth i sprawdzenia wycieku • brak wysyłki hasła'),
          kind === 'auth' ? e(AuthModal, { isOpen: open, onClose() { c.closed += 1; setOpen(false); }, onSuccessVaultLoaded() { c.loaded += 1; } }) : e(PasswordRecoveryModal),
          ...toasts.map(t => e('p', { key: t.id }, `${t.variant}: ${t.title}`)));
      }
      (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview')).render(e(ThemeProvider, null, e(Flow)));
    }, kind);
    await page.getByRole('dialog').waitFor();
  }
  async function settle(name, value, reject = false) {
    await page.evaluate(({ name, value, reject }) => {
      const pending = window.__authAudit.pending[name];
      if (reject) pending.reject(new Error('Syntetyczny wyjątek'));
      else pending.resolve(value);
      return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, { name, value, reject });
  }
  async function resetView() {
    await page.getByRole('button', { name: /Załóż konto lub zaloguj się/ }).click();
    await page.getByRole('button', { name: 'Nie pamiętam hasła', exact: true }).click();
    await page.getByLabel(/Adres e-mail/i).fill('synthetic@example.invalid');
  }
  await setup();
  await resetView();
  await page.getByRole('button', { name: 'Wyślij link', exact: true }).click();
  await settle('reset', { ok: false, message: 'Syntetyczny błąd resetu' });
  assert.equal(await page.getByText('Syntetyczny błąd resetu', { exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Wyślij link', exact: true }).isEnabled(), true);
  await page.screenshot({ path: 'docs/evidence/auth-reset-failure-2026-10-05.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Wyślij link', exact: true }).click();
  await settle('reset', null, true);
  await page.getByText('Nie potwierdzono wysłania linku. Spróbuj ponownie.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Wyślij link', exact: true }).isEnabled(), true);
  await page.getByRole('button', { name: 'Wyślij link', exact: true }).click();
  await page.getByRole('button', { name: 'Wróć do wyboru', exact: true }).click();
  await settle('reset', { ok: true, message: '' });
  assert.equal(await page.getByRole('heading', { name: 'Jak chcesz korzystać z Kierivo?', exact: true }).count(), 1);
  await page.getByRole('button', { name: /Zaloguj się kontem Google/ }).click();
  await settle('oauth', null, true);
  await page.getByText(/Nie udało się rozpocząć logowania u dostawcy/).waitFor();
  assert.equal(await page.getByRole('button', { name: /Zaloguj się kontem Google/ }).isEnabled(), true);
  await page.getByRole('button', { name: /Załóż konto lub zaloguj się/ }).click();
  await page.getByLabel(/Adres e-mail/i).fill('synthetic@example.invalid');
  await page.getByLabel(/^Hasło/i).fill('SyntetyczneHaslo42!');
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await settle('login', null, true);
  await page.getByText('Nie potwierdzono logowania. Spróbuj ponownie.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Zaloguj się', exact: true }).isEnabled(), true);
  await page.getByRole('tab', { name: 'Rejestracja', exact: true }).click();
  await page.getByLabel(/^Hasło/i).fill('SyntetyczneHaslo42!');
  await page.getByRole('button', { name: 'Załóż konto', exact: true }).click();
  await page.getByRole('button', { name: 'Wróć do wyboru', exact: true }).click();
  await settle('leak', { leaked: false, count: 0, unavailable: false });
  assert.equal(await page.evaluate(() => window.__authAudit.calls.includes('signup')), false);
  assert.equal(await page.evaluate(() => window.__authAudit.closed), 0);
  await setup('recovery');
  const fillPasswords = async () => {
    await page.getByLabel(/^Nowe hasło/i).fill('SyntetyczneHaslo42!');
    await page.getByLabel(/^Powtórz nowe hasło/i).fill('SyntetyczneHaslo42!');
  };
  await fillPasswords();
  await page.getByRole('button', { name: 'Zapisz nowe hasło', exact: true }).click();
  await page.evaluate(() => window.__authAudit.setState(s => ({ ...s, owner: 'synthetic-B', revision: 2 })));
  await settle('leak', { leaked: false, count: 0, unavailable: false });
  assert.equal(await page.evaluate(() => window.__authAudit.calls.includes('update')), false);
  assert.equal(await page.getByLabel(/^Nowe hasło/i).inputValue(), '');
  await fillPasswords();
  await page.getByRole('button', { name: 'Zapisz nowe hasło', exact: true }).click();
  await settle('leak', { leaked: false, count: 0, unavailable: false });
  await settle('update', null, true);
  await page.getByText(/Nie potwierdzono zmiany hasła/).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Zapisz nowe hasło', exact: true }).isEnabled(), true);
  await page.screenshot({ path: 'docs/evidence/password-recovery-failure-2026-10-05.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Zapisz nowe hasło', exact: true }).click();
  await settle('leak', { leaked: false, count: 0, unavailable: false });
  await page.evaluate(() => window.__authAudit.setState(s => ({ ...s, revision: 3 })));
  await settle('update', { ok: true, message: '' });
  assert.equal(await page.evaluate(() => window.__authAudit.toasts.length), 0);
  assert.equal(await page.getByLabel(/^Nowe hasło/i).inputValue(), '');
  await setup('expired');
  await page.getByLabel(/Adres e-mail/i).fill('synthetic@example.invalid');
  await page.getByRole('button', { name: 'Wyślij nowy link', exact: true }).click();
  await settle('reset', null, true);
  await page.getByText(/Nie potwierdzono wysłania linku/).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Wyślij nowy link', exact: true }).isEnabled(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: reset nie fabrykuje wysłania; wyjątki zwalniają blokady; zmiana widoku/linku/konta odrzuca stare wyniki i hasło, a anulowany preflight nie wywołuje rejestracji ani zmiany hasła.');
} catch (error) {
  console.error('Błędy strony:', errors);
  console.error('Widoczny stan:', (await page.locator('body').innerText()).slice(0, 2400));
  throw error;
} finally { await browser.close(); }
