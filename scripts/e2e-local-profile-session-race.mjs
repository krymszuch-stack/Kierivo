import assert from 'node:assert/strict';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
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
    const React = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { AuthProvider, useAuth } = await import('/src/context/AuthContext.tsx');
    const { Topbar } = await import('/src/components/layout/Topbar.tsx');
    const { ThemeProvider } = await import('/src/providers/ThemeProvider.tsx');
    const { AccessibilityProvider } = await import('/src/providers/AccessibilityProvider.tsx');
    const profile = await import('/src/lib/localProfile.ts');
    const saved = await profile.createLocalProfile('Profil syntetyczny A');
    window.__sessionRace = { profile, saved, loaded: 0, results: [] };
    const e = React.createElement ?? React.default.createElement;
    const useState = React.useState ?? React.default.useState;
    function Flow() {
      const auth = useAuth();
      const [status, setStatus] = useState('Gotowy');
      window.__sessionRace.auth = auth;
      const race = async kind => {
        setStatus('Trwa próba');
        const pending = kind === 'create' ? auth.signInLocally('Profil syntetyczny B') : auth.resumeLocalProfile(saved.profile.id);
        const observed = pending.then(value => ({ returned: value !== null }), error => ({ error: error.message }));
        const closed = await auth.logout();
        const result = await observed;
        window.__sessionRace.results.push({ kind, closed: closed.ok, ...result });
        setStatus(`${kind}: zakończono`);
      };
      return e('div', null,
        e(Topbar, { activeTab: 'home', isAuthenticated: auth.isAuthenticated, userEmail: auth.user?.name, onOpenMobileMenu() {}, onOpenAuthModal() {} }),
        e('section', { style: { padding: 40 } },
          e('h1', null, 'Audyt: aktywacja profilu i zamknięcie sesji'),
          e('p', null, 'Próba diagnostyczna • rzeczywisty AuthProvider • dane syntetyczne • równoczesne wywołania'),
          e('p', { id: 'auth-status' }, auth.user ? 'Profil otwarty' : 'Profil zamknięty'),
          e('button', { onClick: () => race('create') }, 'Twórz profil i zamknij sesję'),
          e('button', { onClick: () => race('resume') }, 'Wznów profil i zamknij sesję'),
          e('p', { id: 'race-status' }, status),
          e('pre', null, JSON.stringify(window.__sessionRace.results, null, 2))));
    }
    (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview')).render(e(ThemeProvider, null, e(AccessibilityProvider, null, e(AuthProvider, { onVaultLoaded() { window.__sessionRace.loaded += 1; } }, e(Flow)))));
  });
  await page.getByRole('button', { name: 'Twórz profil i zamknij sesję', exact: true }).click();
  await page.getByText('create: zakończono', { exact: true }).waitFor();
  assert.equal(await page.locator('#auth-status').innerText(), 'Profil zamknięty');
  const first = await page.evaluate(() => window.__sessionRace.results[0]);
  assert.equal(first.closed, true);
  assert.match(first.error, /Sesja zmieniła się/);
  assert.equal(await page.evaluate(() => window.__sessionRace.profile.getActiveProfile()), null);
  await page.getByRole('button', { name: 'Wznów profil i zamknij sesję', exact: true }).click();
  await page.getByText('resume: zakończono', { exact: true }).waitFor();
  assert.equal(await page.locator('#auth-status').innerText(), 'Profil zamknięty');
  assert.deepEqual(await page.evaluate(() => window.__sessionRace.results[1]), { kind: 'resume', closed: true, returned: false });
  assert.equal(await page.evaluate(() => window.__sessionRace.loaded), 0);
  assert.equal(await page.evaluate(() => window.__sessionRace.profile.getActiveProfile()), null);
  assert.deepEqual(await page.evaluate(async () => (await window.__sessionRace.profile.listSavedLocalProfiles()).map(p => p.name)), ['Profil syntetyczny A']);
  await page.screenshot({ path: 'docs/evidence/local-profile-session-race-2026-10-04.png', animations: 'disabled' });
  assert.equal(await page.evaluate(async () => (await window.__sessionRace.auth.resumeLocalProfile(window.__sessionRace.saved.profile.id)) !== null), true);
  await page.getByText('Profil otwarty', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__sessionRace.loaded), 1);
  await page.getByRole('button', { name: /Profil/ }).click();
  await page.getByRole('button', { name: 'Zamknij profil', exact: true }).click();
  await page.getByText('Profil zamknięty', { exact: true }).waitFor();
  await page.reload();
  assert.equal(await page.evaluate(async () => (await import('/src/lib/localProfile.ts')).getActiveProfile()), null);
  assert.deepEqual(errors, []);
  console.log('PASS: tworzenie i wznowienie nie otwierają zamkniętej sesji; anulowany Vault nie jest publikowany, a późniejsze wznowienie działa.');
} catch (error) {
  console.error('Błędy strony:', errors);
  console.error('Widoczny stan:', (await page.locator('body').innerText()).slice(0, 2000));
  throw error;
} finally { await browser.close(); }
