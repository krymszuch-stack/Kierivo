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
    const { ToastHost } = await import('/src/components/ui/ToastHost.tsx');
    const storage = await import('/src/lib/storage.ts');
    const profile = await import('/src/lib/localProfile.ts');
    const saved = await profile.createLocalProfile('Profil syntetyczny');
    const idb = await import('/src/lib/idbFallback.ts');
    storage.writeJson(storage.applicationsKeyFor('anonymous'), [{ id: 'old-private', company: 'Firma osoby A', position: 'Magazynier', salary: '', date: '2026-10-04', status: 'Wysłana' }]);
    storage.writeJson(storage.cvLibraryKeyFor('anonymous'), [{ id: 'private-cv', title: 'CV osoby A' }]);
    storage.writeSessionJson(storage.profileDataKeyFor(storage.StorageKeys.advisorConversation, 'anonymous'), { draft: 'Szkic osoby A' });
    profile.saveProfileVault('anonymous', (await import('/src/lib/sampleVault.ts')).createEmptyVault('Pozostałość osoby A'));
    const profileRaw = localStorage.getItem(storage.StorageKeys.profile);
    await idb.idbBackupSetDurably(storage.StorageKeys.profile, profileRaw);
    await idb.idbBackupSetDurably(`${storage.StorageKeys.profile}:last-good`, profileRaw);

    window.__profileRace = { profile, storage, success: false, saved, fail: true };
    const originalSet = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function(key) { if (window.__profileRace.fail && key === storage.vaultKeyFor('anonymous')) throw new DOMException('Syntetyczna odmowa', 'QuotaExceededError'); return originalSet.call(this, key); };
    const e = React.createElement ?? React.default.createElement;
    function Flow() {
      const auth = useAuth();
      window.__profileRace.auth = auth;
      return e('div', null, e(Topbar, { activeTab: 'home', isAuthenticated: auth.isAuthenticated, userEmail: auth.user?.name, onOpenMobileMenu() {}, onOpenAuthModal() {} }), e('p', { id: 'auth-status' }, auth.user ? 'Profil otwarty' : 'Profil zamknięty'), e(ToastHost));
    }
    (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview')).render(e(ThemeProvider, null, e(AccessibilityProvider, null, e(AuthProvider, null, e(Flow)))));
  });
  await page.getByRole('button', { name: /Profil/ }).click();
  await page.getByRole('button', { name: 'Zamknij profil', exact: true }).click();
  await page.getByText('Nie ukończono wylogowania', { exact: true }).waitFor();
  assert.equal(await page.locator('#auth-status').innerText(), 'Profil otwarty');
  assert.equal(await page.evaluate(() => window.__profileRace.profile.getActiveProfile()?.id === window.__profileRace.saved.profile.id), true);
  await page.screenshot({ path: 'docs/evidence/anonymous-scope-logout-2026-10-04.png', animations: 'disabled' });
  await page.evaluate(() => { window.__profileRace.fail = false; });
  await page.getByRole('button', { name: 'Zamknij profil', exact: true }).click();
  await page.getByText('Profil zamknięty', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__profileRace.profile.getActiveProfile()), null);
  assert.equal(await page.evaluate(async () => {
    const keys = await (await import('/src/lib/idbFallback.ts')).idbBackupKeys(window.__profileRace.storage.StorageKeys.profile);
    return keys.length === 0;
  }), true);
  assert.equal(await page.evaluate(() => window.__profileRace.profile.loadProfileVault(window.__profileRace.saved.profile.id)?.personalInfo.fullName), 'Profil syntetyczny');
  assert.equal(await page.evaluate(() => {
    const s = window.__profileRace.storage;
    return Object.values(s.StorageKeys).every(base => s.readRaw(s.profileDataKeyFor(base, 'anonymous')) === null && sessionStorage.getItem(s.profileDataKeyFor(base, 'anonymous')) === null);
  }), true);
  await page.evaluate(async () => {
    const p = window.__profileRace.profile;
    const s = window.__profileRace.storage;
    const next = await p.createLocalProfile('Osoba B');
    if (s.readJson(s.applicationsKeyFor(next.profile.id), []).length || s.readJson(s.cvLibraryKeyFor(next.profile.id), []).length || next.vault.personalInfo.fullName !== 'Osoba B') throw new Error('Przeniesiono dane osoby A');
    if (!(await p.signOutLocalProfile())) throw new Error('Nie zamknięto profilu B');
  });
  await page.reload();
  assert.equal(await page.evaluate(async () => (await import('/src/lib/localProfile.ts')).getActiveProfile()), null);
  assert.equal(await page.evaluate(async () => {
    await (await import('/src/lib/idbFallback.ts')).preloadIdbMirror();
    const s = await import('/src/lib/storage.ts');
    return Object.values(s.StorageKeys).every(base => s.readRaw(s.profileDataKeyFor(base, 'anonymous')) === null);
  }), true);
  assert.deepEqual(errors, []);
  console.log('PASS: odmowa czyszczenia anonimowego Vaultu blokuje zamknięcie; ponowienie usuwa anonimowy zakres i osoba B nie dziedziczy danych osoby A.');
} catch (error) {
  console.error('Błędy strony:', errors);
  console.error('Stan formularza:', (await page.locator('body').innerText()).slice(0, 1600));
  throw error;
} finally { await browser.close(); }
