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
    const { AuthProvider } = await import('/src/context/AuthContext.tsx');
    const { AuthModal } = await import('/src/features/auth/AuthModal.tsx');
    const { ToastHost } = await import('/src/components/ui/ToastHost.tsx');
    const storage = await import('/src/lib/storage.ts');
    const profile = await import('/src/lib/localProfile.ts');
    const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
    profile.saveProfileVault('anonymous', createEmptyVault('Starsza wersja syntetyczna'));
    window.__profileRace = { profile, storage, race: true, success: false };
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      originalSet.call(this, key, value);
      if (window.__profileRace.race && key.startsWith(`${storage.StorageKeys.vault}:local-`)) {
        window.__profileRace.race = false;
        profile.saveProfileVault('anonymous', createEmptyVault('Nowsza wersja syntetyczna'));
      }
    };
    const e = React.createElement ?? React.default.createElement;
    function Flow() {
      const [open, setOpen] = (React.useState ?? React.default.useState)(true);
      return e(AuthProvider, null, e(AuthModal, { isOpen: open, onClose: () => setOpen(false), onSuccessVaultLoaded: () => { window.__profileRace.success = true; } }), e(ToastHost));
    }
    (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview')).render(e(Flow));
  });
  await page.getByRole('button', { name: /Korzystaj bez logowania/ }).click();
  await page.getByRole('textbox', { name: /^Jak się do Ciebie zwracać/ }).fill('Profil syntetyczny');
  await page.getByRole('button', { name: 'Zapisz profil', exact: true }).click();
  await page.getByText('Dane zmieniły się podczas tworzenia profilu. Zachowano dane źródłowe; spróbuj ponownie.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__profileRace.profile.getActiveProfile()), null);
  assert.equal(await page.evaluate(() => window.__profileRace.profile.loadProfileVault('anonymous')?.personalInfo.fullName), 'Nowsza wersja syntetyczna');
  assert.equal(await page.evaluate(() => window.__profileRace.success), false);
  await page.screenshot({ path: 'docs/evidence/local-profile-migration-race-2026-10-04.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Zapisz profil', exact: true }).click();
  await page.getByText('Profil zapisany na tym urządzeniu', { exact: true }).waitFor();
  assert.equal(await page.evaluate(async () => {
    const p = window.__profileRace.profile;
    const current = p.getActiveProfile();
    return window.__profileRace.success && p.loadProfileVault(current.id)?.personalInfo.fullName === 'Nowsza wersja syntetyczna' && (await p.listSavedLocalProfiles()).some(item => item.id === current.id);
  }), true);
  assert.deepEqual(errors, []);
  console.log('PASS: rzeczywisty formularz zachowuje nowsze źródło, odrzuca niespójną migrację i pozwala ponowić zapis.');
} catch (error) {
  console.error('Błędy strony:', errors);
  console.error('Stan formularza:', (await page.locator('body').innerText()).slice(0, 1600));
  throw error;
} finally { await browser.close(); }
