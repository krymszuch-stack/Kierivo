import assert from 'node:assert/strict';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
let blockedProbeRequests = 0;
page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/api/audit-session')) blockedProbeRequests += 1; });
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname === '/src/lib/supabaseClient.ts') return route.fulfill({ contentType: 'application/javascript', body: 'export const getSupabaseBrowserClient = () => window.__cloudLogout.client; export const isCloudBackendAvailable = () => true;' });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 501, body: '{}' });
    if (url.pathname === '/') {
      const response = await route.fetch();
      const html = (await response.text()).replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '').replace('<div id="root"></div>', '<main id="audit-preview"></main>');
      return route.fulfill({ response, body: html });
    }
    return route.continue();
  });
  async function setup(options = {}) {
    await page.goto(BASE_URL);
    await page.evaluate(async options => {
      const listeners = new Set();
      const makeSession = id => ({ access_token: `synthetic-token-${id}`, user: { id, email: `${id}@example.invalid`, created_at: '2026-10-04T00:00:00Z', user_metadata: { full_name: `Profil ${id}` } } });
      const control = window.__cloudLogout = { session: makeSession('synthetic-A'), calls: 0, release: null, releaseDelete: null, result: null, refuse: false };
      control.emit = (id, event = id ? 'SIGNED_IN' : 'SIGNED_OUT') => {
        control.session = id ? makeSession(id) : null;
        for (const listener of listeners) listener(event, control.session);
      };
      control.client = { functions: { invoke: async () => new Promise((resolve, reject) => {
        control.releaseDelete = () => options.deleteThrows
          ? reject(new Error('Syntetyczny wyjątek wywołania usuwania'))
          : resolve({ data: Object.hasOwn(options, 'deleteData') ? options.deleteData : { success: true }, error: null });
      }) }, auth: {
        getSession: async () => ({ data: { session: control.session } }),
        onAuthStateChange: listener => { listeners.add(listener); return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } }; },
        updateUser: async () => {
          const owner = control.session.user.id;
          return new Promise(resolve => { control.releaseUpdate = () => {
            if (options.updateEvent) control.emit(owner, 'USER_UPDATED');
            resolve({ data: { user: { id: owner } }, error: null });
          }; });
        },
        signOut: async () => {
          control.calls += 1;
          if (options.signOutError === 'throw') throw new Error('Syntetyczny wyjątek zamknięcia sesji');
          if (options.signOutError) return { error: { message: 'Syntetyczna odmowa zamknięcia sesji', status: 500 } };
          control.emit(null);
          return new Promise(resolve => { control.release = () => resolve({ error: null }); });
        },
      } };
      const React = await import('/node_modules/.vite/deps/react.js');
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { AuthProvider, useAuth } = await import('/src/context/AuthContext.tsx');
      const storage = await import('/src/lib/storage.ts');
      const idb = await import('/src/lib/idbFallback.ts');
      const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
      control.profile = await import('/src/lib/localProfile.ts');
      if (options.seedLocal) control.legacyLocal = await control.profile.createLocalProfile('Starszy profil lokalny');
      control.storage = storage;
      control.idb = idb;
      control.key = storage.vaultKeyFor('synthetic-A');
      storage.writeJson(control.key, createEmptyVault('Syntetyczny profil A'));
      const raw = localStorage.getItem(control.key);
      await idb.idbBackupSetDurably(control.key, raw);
      await idb.idbBackupSetDurably(`${control.key}:last-good`, raw);
      const originalRemove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function(key) {
        if (control.refuse && key === control.key) throw new Error('Syntetyczna odmowa usunięcia');
        return originalRemove.call(this, key);
      };
      const e = React.createElement ?? React.default.createElement;
      const useState = React.useState ?? React.default.useState;
      function Flow() {
        const auth = useAuth();
        const [status, setStatus] = useState('Gotowy');
        control.auth = auth;
        return e('section', { style: { padding: 48, font: '18px system-ui' } },
          e('h1', null, 'Audyt wylogowania chmurowego'),
          e('p', null, 'Rzeczywisty AuthProvider • syntetyczny klient Auth • lokalne IndexedDB Chromium'),
          e('p', { id: 'owner' }, auth.user?.id ?? 'brak sesji'),
          e('p', { id: 'recovery' }, `Recovery: ${auth.passwordRecoveryActive}`),
          e('button', { onClick: async () => { control.result = await auth.updateRecoveredPassword('SyntetyczneHaslo42!'); setStatus(JSON.stringify(control.result)); } }, 'Zmień hasło syntetyczne'),
          e('button', { onClick: async () => { control.result = await auth.logout(); setStatus(JSON.stringify(control.result)); } }, 'Wyloguj'),
          e('button', { onClick: async () => { control.result = await auth.deleteAccount(); setStatus(JSON.stringify(control.result)); } }, 'Usuń konto syntetyczne'),
          e('p', { id: 'result' }, status));
      }
      (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview')).render(e(AuthProvider, null, e(Flow)));
    }, options);
    await page.getByText('synthetic-A', { exact: true }).waitFor();
  }
  await setup();
  await page.evaluate(() => window.__cloudLogout.emit('synthetic-A', 'PASSWORD_RECOVERY'));
  await page.getByText('Recovery: true', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Zmień hasło syntetyczne', exact: true }).click();
  await page.evaluate(() => window.__cloudLogout.emit('synthetic-B', 'PASSWORD_RECOVERY'));
  await page.evaluate(() => window.__cloudLogout.releaseUpdate());
  await page.waitForFunction(() => window.__cloudLogout.result !== null);
  assert.equal(await page.evaluate(() => window.__cloudLogout.result.ok), false);
  assert.equal(await page.locator('#owner').innerText(), 'synthetic-B');
  assert.equal(await page.locator('#recovery').innerText(), 'Recovery: true');
  await page.screenshot({ path: 'docs/evidence/password-recovery-new-session-2026-10-05.png' });
  await setup({ updateEvent: true });
  await page.evaluate(() => window.__cloudLogout.emit('synthetic-A', 'PASSWORD_RECOVERY'));
  await page.getByText('Recovery: true', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Zmień hasło syntetyczne', exact: true }).click();
  await page.evaluate(() => window.__cloudLogout.releaseUpdate());
  await page.waitForFunction(() => window.__cloudLogout.result !== null);
  assert.equal(await page.evaluate(() => window.__cloudLogout.result.ok), true);
  assert.equal(await page.locator('#recovery').innerText(), 'Recovery: false');
  for (const deleteData of [null, {}, [], 'ok', false, { success: false }, { success: 1 }, { success: true, error: 'Odmowa' }]) {
    await setup({ deleteData, signOutError: true });
    await page.getByRole('button', { name: 'Usuń konto syntetyczne', exact: true }).click();
    await page.waitForFunction(() => window.__cloudLogout.releaseDelete !== null);
    await page.evaluate(() => window.__cloudLogout.releaseDelete());
    await page.waitForFunction(() => window.__cloudLogout.result !== null);
    assert.equal(await page.evaluate(() => window.__cloudLogout.result.ok), false);
    assert.equal(await page.evaluate(() => window.__cloudLogout.calls), 0);
    assert.equal(await page.evaluate(() => window.__cloudLogout.storage.isPrivacyWipeInProgress()), false);
    assert.notEqual(await page.evaluate(() => window.__cloudLogout.storage.readRaw(window.__cloudLogout.key)), null);
    assert.notEqual(await page.evaluate(async () => window.__cloudLogout.idb.idbBackupGet(window.__cloudLogout.key)), null);
    assert.equal(await page.locator('#owner').innerText(), 'synthetic-A');
  }
  await page.screenshot({ path: 'docs/evidence/cloud-delete-unconfirmed-response-2026-10-05.png' });
  await setup({ deleteThrows: true });
  await page.getByRole('button', { name: 'Usuń konto syntetyczne', exact: true }).click();
  await page.waitForFunction(() => window.__cloudLogout.releaseDelete !== null);
  await page.evaluate(() => window.__cloudLogout.releaseDelete());
  await page.waitForFunction(() => window.__cloudLogout.result !== null);
  assert.equal(await page.evaluate(() => window.__cloudLogout.result.ok), false);
  assert.equal(await page.evaluate(() => window.__cloudLogout.calls), 0);
  assert.equal(await page.evaluate(() => window.__cloudLogout.storage.isPrivacyWipeInProgress()), false);
  assert.notEqual(await page.evaluate(() => window.__cloudLogout.storage.readRaw(window.__cloudLogout.key)), null);
  assert.equal(await page.locator('#owner').innerText(), 'synthetic-A');
  await setup();
  await page.getByRole('button', { name: 'Wyloguj', exact: true }).click();
  await page.waitForFunction(() => window.__cloudLogout.calls === 1);
  await page.evaluate(() => window.__cloudLogout.emit('synthetic-B'));
  await page.getByText('synthetic-B', { exact: true }).waitFor();
  await page.evaluate(() => window.__cloudLogout.release());
  await page.waitForFunction(() => window.__cloudLogout.result !== null);
  assert.equal(await page.locator('#owner').innerText(), 'synthetic-B');
  assert.equal(await page.evaluate(() => window.__cloudLogout.result.ok), false);
  await page.screenshot({ path: 'docs/evidence/cloud-logout-new-session-2026-10-04.png' });

  await page.reload();
  await setup();
  await page.getByRole('button', { name: 'Wyloguj', exact: true }).click();
  await page.waitForFunction(() => window.__cloudLogout.calls === 1);
  await page.evaluate(async () => {
    const c = window.__cloudLogout;
    c.emit('synthetic-A');
    const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
    c.storage.writeJson(c.key, createEmptyVault('Nowsza sesja tego samego konta'));
    c.release();
  });
  await page.waitForFunction(() => window.__cloudLogout.result !== null);
  assert.equal(await page.locator('#owner').innerText(), 'synthetic-A');
  assert.equal(await page.evaluate(() => window.__cloudLogout.result.ok), false);
  assert.match(await page.evaluate(() => window.__cloudLogout.storage.readRaw(window.__cloudLogout.key)), /Nowsza sesja/);

  await page.reload();
  await setup();
  await page.evaluate(() => {
    const control = window.__cloudLogout;
    const original = IDBDatabase.prototype.transaction;
    let first = true;
    IDBDatabase.prototype.transaction = function(...args) {
      const tx = original.apply(this, args);
      if (first && args[1] === 'readwrite') {
        first = false;
        Object.defineProperty(tx, 'oncomplete', { configurable: true, set(handler) {
          tx.addEventListener('complete', event => {
            control.releaseCleanup = () => { IDBDatabase.prototype.transaction = original; handler.call(tx, event); };
          });
        } });
      }
      return tx;
    };
  });
  await page.getByRole('button', { name: 'Wyloguj', exact: true }).click();
  await page.waitForFunction(() => typeof window.__cloudLogout.releaseCleanup === 'function');
  await page.evaluate(() => {
    window.__cloudLogout.emit('synthetic-B');
    window.__cloudLogout.releaseCleanup();
  });
  await page.waitForFunction(() => window.__cloudLogout.result !== null);
  assert.equal(await page.locator('#owner').innerText(), 'synthetic-B');
  assert.equal(await page.evaluate(() => window.__cloudLogout.calls), 0);
  assert.equal(await page.evaluate(() => window.__cloudLogout.result.ok), false);

  await page.reload();
  await setup();
  await page.getByRole('button', { name: 'Usuń konto syntetyczne', exact: true }).click();
  await page.waitForFunction(() => window.__cloudLogout.releaseDelete !== null);
  await page.evaluate(() => {
    const c = window.__cloudLogout;
    c.emit('synthetic-B');
    c.storage.writeJson(c.storage.vaultKeyFor('synthetic-B'), { marker: 'dane nowszego konta' });
    c.releaseDelete();
  });
  await page.waitForFunction(() => window.__cloudLogout.result !== null);
  assert.equal(await page.locator('#owner').innerText(), 'synthetic-B');
  assert.equal(await page.evaluate(() => window.__cloudLogout.result.ok), false);
  assert.equal(await page.evaluate(() => window.__cloudLogout.calls), 0);
  assert.equal(await page.evaluate(() => window.__cloudLogout.storage.isPrivacyWipeInProgress()), false);
  assert.equal(await page.evaluate(() => window.__cloudLogout.storage.readJson(window.__cloudLogout.storage.vaultKeyFor('synthetic-B'), null)?.marker), 'dane nowszego konta');
  await page.screenshot({ path: 'docs/evidence/cloud-delete-new-session-2026-10-04.png' });

  await page.reload();
  await setup();
  await page.evaluate(() => { window.__cloudLogout.refuse = true; });
  await page.getByRole('button', { name: 'Wyloguj', exact: true }).click();
  await page.waitForFunction(() => window.__cloudLogout.result !== null);
  assert.equal(await page.evaluate(() => window.__cloudLogout.result.ok), false);
  assert.equal(await page.evaluate(() => window.__cloudLogout.calls), 0);
  assert.equal(await page.locator('#owner').innerText(), 'synthetic-A');
  assert.notEqual(await page.evaluate(() => localStorage.getItem(window.__cloudLogout.key)), null);
  assert.equal(await page.evaluate(async () => (await window.__cloudLogout.idb.idbBackupKeys(window.__cloudLogout.key)).includes(window.__cloudLogout.key)), true);
  await page.screenshot({ path: 'docs/evidence/cloud-logout-cleanup-refused-2026-10-04.png' });
  await page.evaluate(() => { window.__cloudLogout.refuse = false; });
  await page.getByRole('button', { name: 'Wyloguj', exact: true }).click();
  await page.waitForFunction(() => window.__cloudLogout.calls === 1);
  await page.evaluate(() => window.__cloudLogout.release());
  await page.waitForFunction(() => window.__cloudLogout.result?.ok === true);
  assert.equal(await page.locator('#owner').innerText(), 'brak sesji');
  assert.equal(await page.evaluate(() => window.__cloudLogout.storage.readRaw(window.__cloudLogout.key)), null);
  assert.deepEqual(await page.evaluate(async () => window.__cloudLogout.idb.idbBackupKeys(window.__cloudLogout.key)), []);

  await page.reload();
  await setup({ seedLocal: true });
  await page.getByRole('button', { name: 'Wyloguj', exact: true }).click();
  await page.waitForFunction(() => window.__cloudLogout.calls === 1);
  await page.evaluate(() => window.__cloudLogout.release());
  await page.waitForFunction(() => window.__cloudLogout.result?.ok === true);
  assert.equal(await page.evaluate(() => window.__cloudLogout.profile.getActiveProfile()), null);
  assert.notEqual(await page.evaluate(() => window.__cloudLogout.profile.loadProfileVault(window.__cloudLogout.legacyLocal.profile.id)), null);
  await page.screenshot({ path: 'docs/evidence/cloud-logout-old-local-profile-2026-10-05.png' });
  await page.reload();
  assert.equal(await page.evaluate(async () => (await import('/src/lib/localProfile.ts')).getActiveProfile()), null);

  for (const failure of [true, 'throw']) {
    await setup({ signOutError: failure });
    await page.getByRole('button', { name: 'Usuń konto syntetyczne', exact: true }).click();
    await page.waitForFunction(() => window.__cloudLogout.releaseDelete !== null);
    await page.evaluate(() => window.__cloudLogout.releaseDelete());
    await page.waitForFunction(() => window.__cloudLogout.result !== null);
    assert.equal(await page.evaluate(() => window.__cloudLogout.result.ok), false);
    assert.match(await page.locator('#result').innerText(), /sesji/);
    assert.equal(await page.evaluate(() => window.__cloudLogout.storage.readRaw(window.__cloudLogout.key)), null);
    assert.deepEqual(await page.evaluate(async () => window.__cloudLogout.idb.idbBackupKeys(window.__cloudLogout.key)), []);
    const apiStatus = await page.evaluate(async () => {
      const { api } = await import('/src/lib/apiClient.ts');
      try { await api.get('/api/audit-session'); return 200; }
      catch (error) {
        const proof = document.createElement('p');
        proof.textContent = `API po wymazaniu: blokada przed wysyłką, status ${error.status}`;
        document.getElementById('audit-preview').append(proof);
        return error.status;
      }
    });
    assert.equal(apiStatus, 403);
    assert.equal(blockedProbeRequests, 0);
    await page.screenshot({ path: 'docs/evidence/cloud-delete-signout-failure-2026-10-05.png' });
  }
  await setup();
  await page.getByRole('button', { name: 'Usuń konto syntetyczne', exact: true }).click();
  await page.waitForFunction(() => window.__cloudLogout.releaseDelete !== null);
  await page.evaluate(() => window.__cloudLogout.releaseDelete());
  await page.waitForFunction(() => window.__cloudLogout.calls === 1);
  await page.evaluate(() => window.__cloudLogout.release());
  await page.waitForFunction(() => window.__cloudLogout.result !== null);
  assert.equal(await page.evaluate(() => window.__cloudLogout.result.ok), true);
  assert.equal(await page.evaluate(() => window.__cloudLogout.storage.readRaw(window.__cloudLogout.key)), null);
  assert.deepEqual(await page.evaluate(async () => window.__cloudLogout.idb.idbBackupKeys(window.__cloudLogout.key)), []);
  assert.deepEqual(errors, []);
  console.log('PASS: niepotwierdzona odpowiedź i wyjątek usun-konto zachowują CV; nowsza sesja zachowana; starszy profil lokalny nie wraca po reload; błędy signOut nie dają fałszywego sukcesu, a API po wymazaniu nie wysyła żądań.');
} catch (error) {
  console.error('Błędy strony:', errors);
  console.error('Widoczny stan:', (await page.locator('body').innerText()).slice(0, 2000));
  throw error;
} finally { await browser.close(); }
