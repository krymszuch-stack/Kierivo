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
    const React = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { JDKeywordMapper } = await import('/src/features/matcher/JDKeywordMapper.tsx');
    const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
    const createElement = React.createElement ?? React.default.createElement;
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview'));
    window.__ownership = { root, createElement, JDKeywordMapper, createEmptyVault };
  });
  async function render(text) {
    await page.evaluate(text => {
      const a = window.__ownership;
      const vault = a.createEmptyVault('Profil syntetyczny');
      vault.history = [{ id: 'h', company: 'Magazyn syntetyczny', role: 'Magazynier', location: '', startDate: '', endDate: '', isCurrent: false,
        highlights: [{ id: 'p', text, tool: 'WMS', keywords: ['WMS'], action: '', target: '', metric: '' }],
      }];
      a.root.render(a.createElement('div', null,
        a.createElement('p', { style: { color: '#f5f5f5', padding: '12px' } }, `Profil syntetyczny: ${text}`),
        a.createElement(a.JDKeywordMapper, { initialJdText: 'Poszukujemy magazyniera.\nWymagania:\n- Znajomość systemu WMS.', vault })));
    }, text);
    await page.getByText(`Profil syntetyczny: ${text}`, { exact: true }).waitFor();
  }
  await render('Mój kolega obsługiwał WMS.');
  await page.getByText('Brak w profilu (1)', { exact: true }).waitFor();
  await page.getByText('Wyeksponowane w CV (0)', { exact: true }).waitFor();
  await page.locator('#audit-preview').screenshot({ path: 'docs/evidence/skill-evidence-ownership-missing-2026-10-04.png', animations: 'disabled' });
  await render('WMS obsługiwał mój kolega.');
  await page.getByText('Brak w profilu (1)', { exact: true }).waitFor();
  await page.locator('#audit-preview').screenshot({ path: 'docs/evidence/skill-evidence-postfix-actor-2026-10-04.png', animations: 'disabled' });
  await render('Nie używałem WMS.');
  await page.getByText('Brak w profilu (1)', { exact: true }).waitFor();
  await render('Kolega obsługiwał WMS. Obsługiwałem WMS przy kompletacji.');
  await page.getByText('Wyeksponowane w CV (1)', { exact: true }).waitFor();
  await page.locator('#audit-preview').screenshot({ path: 'docs/evidence/skill-evidence-ownership-personal-2026-10-04.png', animations: 'disabled' });
  await render('Nie używałem SAP, ale obsługiwałem WMS.');
  await page.getByText('Wyeksponowane w CV (1)', { exact: true }).waitFor();
  await page.locator('#audit-preview').screenshot({ path: 'docs/evidence/skill-evidence-clause-scope-2026-10-04.png', animations: 'disabled' });
  await render('Nie znam SAP, WMS i Docker.');
  await page.getByText('Brak w profilu (1)', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: cudzy podmiot przed i po WMS oraz zanegowana lista nie potwierdzają WMS; nowa osobista czynność potwierdza termin.');
} finally { await browser.close(); }
