import assert from 'node:assert/strict';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 501, body: '{}' });
    if (url.pathname === '/') {
      const response = await route.fetch();
      const html = (await response.text()).replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '').replace('</head>', '<link rel="stylesheet" href="/src/index.css"></head>').replace('<div id="root"></div>', '<main id="audit-preview" style="max-width:1180px;margin:24px auto;padding:20px"></main>');
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
    const { CVLibraryView } = await import('/src/features/library/CVLibraryView.tsx');
    const { ApplicationTracker } = await import('/src/features/tracker/ApplicationTracker.tsx');
    const { ToastHost } = await import('/src/components/ui/ToastHost.tsx');
    const storage = await import('/src/lib/storage.ts');
    const library = await import('/src/lib/cvLibraryStorage.ts');
    const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
    const vault = createEmptyVault('Profil syntetyczny');
    storage.writeJson(storage.StorageKeys.profile, { id: 'local-claim-audit', name: 'Profil syntetyczny' });
    const doc = library.saveCV('synthetic-source', { title: 'CV syntetyczne', tags: [], theme: 'classic', layout: 'sidebar', targetPages: 1, vault });
    storage.writeJson(storage.StorageKeys.cvLibrary, [doc]);
    storage.writeJson(storage.StorageKeys.applications, [{ id: 'legacy-synthetic', company: 'Firma syntetyczna', position: 'Magazynier', salary: '', date: '2026-10-04', status: 'Wysłana' }]);
    storage.writeJson(storage.cvLibraryKeyFor('local-claim-audit'), [{ ...doc, title: 'Inna wersja CV' }]);
    storage.writeJson(storage.applicationsKeyFor('local-claim-audit'), [{ id: 'legacy-synthetic', company: 'Firma syntetyczna', position: 'Magazynier', salary: '', date: '2026-10-04', status: 'Wysłana', notes: 'Notatka w celu' }]);
    window.__claimAudit = { storage, fail: true, sources: [storage.StorageKeys.cvLibrary, storage.StorageKeys.applications].map(key => localStorage.getItem(key)) };
    window.__claimAudit.targets = [storage.cvLibraryKeyFor('local-claim-audit'), storage.applicationsKeyFor('local-claim-audit')].map(key => localStorage.getItem(key));
    window.confirm = () => true;
    const e = React.createElement ?? React.default.createElement;
    (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview')).render(e(AuthProvider, null,
      e('section', { id: 'claim-library' }, e(CVLibraryView, {})),
      e('section', { id: 'claim-pipeline' }, e(ApplicationTracker, { vault })), e(ToastHost)));
  });
  for (const panel of ['claim-library', 'claim-pipeline']) {
    await page.locator(`#${panel}`).getByRole('button', { name: 'Przypisz do bieżącego profilu', exact: true }).click();
    await page.getByText('Nie ukończono przypisania', { exact: true }).waitFor();
    assert.equal(await page.getByText(/została przypisana/, { exact: false }).count(), 0);
    assert.equal(await page.evaluate(() => {
      const a = window.__claimAudit;
      return [a.storage.StorageKeys.cvLibrary, a.storage.StorageKeys.applications].every((key, index) => localStorage.getItem(key) === a.sources[index]) && [a.storage.cvLibraryKeyFor('local-claim-audit'), a.storage.applicationsKeyFor('local-claim-audit')].every((key, index) => localStorage.getItem(key) === a.targets[index]);
    }), true);
    if (panel === 'claim-library') await page.screenshot({ path: 'docs/evidence/legacy-claim-id-conflict-2026-10-04.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: /Zamknij powiadomienie/ }).click();
    await page.getByText('Nie ukończono przypisania', { exact: true }).waitFor({ state: 'detached' });
  }
  await page.evaluate(() => { const s = window.__claimAudit.storage; [s.StorageKeys.cvLibrary, s.StorageKeys.applications].forEach(key => s.writeJson(key, s.readJson(key, []).map(item => ({ ...item, id: item.id + '-separate' })))); });
  for (const panel of ['claim-library', 'claim-pipeline']) {
    await page.locator(`#${panel}`).getByRole('button', { name: 'Przypisz do bieżącego profilu', exact: true }).click();
    await page.getByText(panel === 'claim-library' ? 'Biblioteka została przypisana' : 'Historia została przypisana', { exact: true }).waitFor();
  }
  assert.equal(await page.evaluate(() => {
    const s = window.__claimAudit.storage;
    return localStorage.getItem(s.StorageKeys.cvLibrary) === null && localStorage.getItem(s.StorageKeys.applications) === null;
  }), true);
  assert.equal(await page.evaluate(() => {
    const s = window.__claimAudit.storage;
    const cvs = s.readJson(s.cvLibraryKeyFor('local-claim-audit'), []);
    const apps = s.readJson(s.applicationsKeyFor('local-claim-audit'), []);
    return cvs.length === 2 && cvs.some(doc => doc.title === 'Inna wersja CV') && cvs.some(doc => doc.title === 'CV syntetyczne') && apps.length === 2 && apps.some(doc => doc.notes === 'Notatka w celu') && apps.some(doc => doc.id === 'legacy-synthetic-separate');
  }), true);
  await page.evaluate(async () => {
    const React = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { useScopedAsyncOperation } = await import('/src/hooks/useScopedAsyncOperation.ts');
    const e = React.createElement ?? React.default.createElement;
    const host = document.createElement('div');
    host.id = 'claim-guard-probe';
    document.body.append(host);
    const root = (dom.createRoot ?? dom.default.createRoot)(host);
    window.__guardAudit = { pending: [], render: scope => root.render(e(Probe, { scope })) };
    function Probe({ scope }) {
      const operation = useScopedAsyncOperation(scope);
      const [status, setStatus] = (React.useState ?? React.default.useState)('idle');
      return e('button', { disabled: operation.isBusy, onClick: async () => {
        const token = operation.begin();
        if (!token) return;
        try {
          await new Promise(resolve => window.__guardAudit.pending.push(resolve));
          if (operation.isCurrent(token)) setStatus('done');
        } finally { operation.finish(token); }
      } }, `${scope}:${operation.isBusy ? 'pending' : status}`);
    }
    window.__guardAudit.render('owner-a');
  });
  await page.getByRole('button', { name: 'owner-a:idle', exact: true }).click();
  await page.getByRole('button', { name: 'owner-a:pending', exact: true }).waitFor();
  await page.evaluate(() => window.__guardAudit.render('owner-b'));
  await page.getByRole('button', { name: 'owner-b:idle', exact: true }).click();
  await page.getByRole('button', { name: 'owner-b:pending', exact: true }).waitFor();
  await page.evaluate(async () => { window.__guardAudit.pending[0](); await new Promise(resolve => requestAnimationFrame(resolve)); });
  assert.equal(await page.getByRole('button', { name: 'owner-b:pending', exact: true }).isDisabled(), true);
  await page.evaluate(() => window.__guardAudit.pending[1]());
  await page.getByRole('button', { name: 'owner-b:done', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: rzeczywiste widoki zachowują źródła przy konflikcie ID i pozwalają przenieść obie wersje po rozdzieleniu ID w fixture.');
} finally { await browser.close(); }
