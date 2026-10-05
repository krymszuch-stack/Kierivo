import assert from 'node:assert/strict';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname === '/') {
      const response = await route.fetch();
      const html = (await response.text()).replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '').replace('<div id="root"></div>', '<main id="audit-preview"></main>');
      return route.fulfill({ response, body: html });
    }
    return route.continue();
  });
  await page.goto(BASE_URL);
  const results = await page.evaluate(async () => {
    const idb = await import('/src/lib/idbFallback.ts');
    const results = [];
    for (const action of ['clear', 'remove', 'newer']) {
      const key = `synthetic-audit-${action}`;
      const originalTransaction = IDBDatabase.prototype.transaction;
      const originalPut = IDBObjectStore.prototype.put;
      const held = new WeakSet();
      let release;
      let notify;
      let first = true;
      const committed = new Promise(resolve => { notify = resolve; });
      // Zapis pozostaje prawdziwą transakcją Chromium. Wstrzymujemy tylko
      // dostarczenie potwierdzenia aplikacji, aby sprawdzić jej spóźniony wynik.
      IDBObjectStore.prototype.put = function(...args) {
        if (first) { first = false; held.add(this.transaction); }
        return originalPut.apply(this, args);
      };
      IDBDatabase.prototype.transaction = function(...args) {
        const tx = originalTransaction.apply(this, args);
        Object.defineProperty(tx, 'oncomplete', { configurable: true, set(handler) {
          tx.addEventListener('complete', event => {
            if (held.has(tx)) { release = () => handler.call(tx, event); notify(); }
            else handler.call(tx, event);
          });
        } });
        return tx;
      };
      try {
        const pending = idb.idbBackupSetDurably(key, 'syntetyczny stary zapis');
        await committed;
        if (action === 'clear') await idb.idbBackupClearAllDurably();
        else if (action === 'remove') await idb.idbBackupRemoveDurably([key]);
        else await idb.idbBackupSetDurably(key, 'syntetyczny nowszy zapis');
        release();
        const accepted = await pending;
        const mirror = idb.idbBackupGetPreferred(key);
        const keys = await idb.idbBackupKeys(key);
        results.push({ action, accepted, mirror, present: keys.includes(key) });
      } finally {
        IDBDatabase.prototype.transaction = originalTransaction;
        IDBObjectStore.prototype.put = originalPut;
      }
    }
    const main = document.getElementById('audit-preview');
    main.style.cssText = 'font:18px system-ui;padding:48px;color:#e2e8f0;background:#0f172a;min-height:100vh';
    const title = document.createElement('h1');
    title.textContent = 'Audyt: spóźniony zapis IndexedDB';
    main.append(title);
    const description = document.createElement('p');
    description.textContent = 'Test diagnostyczny • dane syntetyczne • prawdziwa baza Chromium • opóźnione potwierdzenie transakcji';
    main.append(description);
    for (const row of results) {
      const p = document.createElement('p');
      p.textContent = `${row.action}: stary zapis przyjęty = ${row.accepted}; lustro = ${row.mirror ?? 'puste'}; klucz w bazie = ${row.present}`;
      main.append(p);
    }
    return results;
  });
  assert.deepEqual(results, [
    { action: 'clear', accepted: false, mirror: null, present: false },
    { action: 'remove', accepted: false, mirror: null, present: false },
    { action: 'newer', accepted: false, mirror: 'syntetyczny nowszy zapis', present: true },
  ]);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: 'docs/evidence/idb-stale-write-2026-10-04.png' });
  const duringDeletion = await page.evaluate(async () => {
    const storage = await import('/src/lib/storage.ts');
    const idb = await import('/src/lib/idbFallback.ts');
    const results = [];
    for (const action of ['clear', 'profile']) {
      const key = storage.profileDataKeyFor(storage.StorageKeys.applications, 'anonymous');
      const other = storage.profileDataKeyFor(storage.StorageKeys.applications, 'local-other');
      storage.writeJson(key, ['syntetyczne dane do usunięcia']);
      await idb.idbBackupSetDurably(key, 'syntetyczny backup');
      const originalTransaction = IDBDatabase.prototype.transaction;
      let release;
      let notify;
      let first = true;
      const committed = new Promise(resolve => { notify = resolve; });
      IDBDatabase.prototype.transaction = function(...args) {
        const tx = originalTransaction.apply(this, args);
        if (first && args[1] === 'readwrite') {
          first = false;
          Object.defineProperty(tx, 'oncomplete', { configurable: true, set(handler) {
            tx.addEventListener('complete', event => { release = () => handler.call(tx, event); notify(); });
          } });
        }
        return tx;
      };
      try {
        const deletion = action === 'clear' ? idb.idbBackupClearAllDurably() : storage.clearProfileStorageDurably('anonymous');
        await committed;
        const rawBefore = localStorage.getItem(key);
        storage.writeRaw(key, 'spóźniony autosave');
        storage.writeJson(key, ['spóźniony JSON']);
        storage.writeSessionJson(key, ['spóźniona rozmowa']);
        const accepted = await storage.writeJsonDurably(key, ['spóźniony trwały zapis']);
        const backupAccepted = await idb.idbBackupSetDurably(key, 'spóźniony backup');
        const localUnchanged = localStorage.getItem(key) === rawBefore;
        const sessionAbsent = sessionStorage.getItem(key) === null;
        let otherAllowed = null;
        if (action === 'profile') {
          otherAllowed = await storage.writeJsonDurably(other, ['inny profil']);
        }
        release();
        const deleted = await deletion;
        const backupAbsent = !(await idb.idbBackupKeys(key)).includes(key) && idb.idbBackupGetPreferred(key) === null;
        const retryAccepted = await storage.writeJsonDurably(key, ['nowa sesja']);
        results.push({ action, accepted, backupAccepted, localUnchanged, sessionAbsent, otherAllowed, deleted, backupAbsent, retryAccepted });
      } finally { IDBDatabase.prototype.transaction = originalTransaction; }
    }
    const main = document.getElementById('audit-preview');
    main.replaceChildren();
    const title = document.createElement('h1');
    title.textContent = 'Audyt: zapis podczas usuwania danych';
    main.append(title);
    const description = document.createElement('p');
    description.textContent = 'Test diagnostyczny • prawdziwe IndexedDB Chromium • dane syntetyczne • potwierdzenie usunięcia wstrzymane';
    main.append(description);
    for (const row of results) {
      const p = document.createElement('p');
      p.textContent = `${row.action}: zapis przyjęty = ${row.accepted}; backup przyjęty = ${row.backupAccepted}; LS bez zmian = ${row.localUnchanged}; sessionStorage puste = ${row.sessionAbsent}; backup usunięty = ${row.backupAbsent}; nowy zapis po zakończeniu = ${row.retryAccepted}`;
      main.append(p);
    }
    return results;
  });
  assert.deepEqual(duringDeletion, ['clear', 'profile'].map(action => ({
    action, accepted: false, backupAccepted: false, localUnchanged: true, sessionAbsent: true,
    otherAllowed: action === 'profile' ? true : null, deleted: true, backupAbsent: true, retryAccepted: true,
  })));
  assert.deepEqual(errors, []);
  await page.screenshot({ path: 'docs/evidence/idb-write-during-deletion-2026-10-04.png' });
  console.log('PASS: zapis podczas usuwania jest zablokowany; inny profil działa, a nowy zapis po zakończeniu jest dozwolony.');
  console.log('PASS: spóźnione potwierdzenie nie odtwarza usuniętych danych ani nie cofa nowszego zapisu.');
} finally { await browser.close(); }
