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
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
    const React = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { AuthProvider } = await import('/src/context/AuthContext.tsx');
    const { AuthModal } = await import('/src/features/auth/AuthModal.tsx');
    const { ToastHost } = await import('/src/components/ui/ToastHost.tsx');
    const storage = await import('/src/lib/storage.ts');
    const profile = await import('/src/lib/localProfile.ts');
    const saved = await profile.createLocalProfile('Profil syntetyczny');
    await profile.signOutLocalProfile();
    window.__profileRace = { profile, storage, success: false, saved, fail: true };
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (window.__profileRace.fail && key === storage.StorageKeys.profile) throw new DOMException('Syntetyczna odmowa', 'QuotaExceededError'); return originalSet.call(this, key, value); };
    const e = React.createElement ?? React.default.createElement;
    function Flow() {
      const [open, setOpen] = (React.useState ?? React.default.useState)(true);
      return e(AuthProvider, null, e(AuthModal, { isOpen: open, onClose: () => setOpen(false), onSuccessVaultLoaded: () => { window.__profileRace.success = true; } }), e(ToastHost));
    }
    (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview')).render(e(Flow));
  });
  await page.getByRole('button', { name: 'Profil syntetyczny', exact: true }).click();
  await page.getByText('Nie udało się trwale wznowić profilu. Zachowano zapisane CV; sprawdź możliwość zapisu i spróbuj ponownie.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__profileRace.profile.getActiveProfile()), null);
  assert.equal(await page.evaluate(() => window.__profileRace.profile.loadProfileVault(window.__profileRace.saved.profile.id)?.personalInfo.fullName), 'Profil syntetyczny');
  assert.equal(await page.evaluate(() => window.__profileRace.success), false);
  await page.screenshot({ path: 'docs/evidence/local-profile-resume-durability-2026-10-04.png', animations: 'disabled' });
  await page.evaluate(() => { window.__profileRace.fail = false; });
  await page.getByRole('button', { name: 'Profil syntetyczny', exact: true }).click();
  await page.getByText('Profil lokalny wznowiony', { exact: true }).waitFor();
  assert.equal(await page.evaluate(async () => {
    const p = window.__profileRace.profile;
    const current = p.getActiveProfile();
    return window.__profileRace.success && current.id === window.__profileRace.saved.profile.id && p.loadProfileVault(current.id)?.personalInfo.fullName === 'Profil syntetyczny' && (await p.listSavedLocalProfiles()).some(item => item.id === current.id);
  }), true);
  assert.deepEqual(errors, []);
  console.log('PASS: formularz nie potwierdza wznowienia przy odmowie zapisu; ponowienie wznawia ten sam zapisany profil.');
} catch (error) {
  console.error('Błędy strony:', errors);
  console.error('Stan formularza:', (await page.locator('body').innerText()).slice(0, 1600));
  throw error;
} finally { await browser.close(); }
