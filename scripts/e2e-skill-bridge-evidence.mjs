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
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 501, json: { success: false, error: 'Syntetyczna granica audytu.' } });
    if (url.pathname === '/') {
      const response = await route.fetch();
      const html = (await response.text()).replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '')
        .replace('</head>', '<link rel="stylesheet" href="/src/index.css"></head>').replace('<div id="root"></div>', '<main id="audit-preview"></main>');
      return route.fulfill({ response, body: html });
    }
    return route.continue();
  });
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    const react = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { SkillBridgeMatrixModal } = await import('/src/components/bridge/SkillBridgeMatrixModal.tsx');
    const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
    const createElement = react.createElement ?? react.default.createElement;
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview'));
    window.__bridgeEvidence = { root, createElement, SkillBridgeMatrixModal, createEmptyVault };
  });
  async function renderCase(kind, skill) {
    await page.evaluate(({ kind, skill }) => {
      const a = window.__bridgeEvidence;
      const vault = a.createEmptyVault('Profil syntetyczny');
      if (kind === 'negative') vault.history = [{ id: 'h', company: 'Firma syntetyczna', role: 'Monter', location: '', startDate: '', endDate: '', isCurrent: false,
        highlights: [{ id: 'p', text: 'Nie używałem RabbitMQ.', tool: 'RabbitMQ', keywords: ['RabbitMQ'], action: '', target: '', metric: '' }],
      }];
      if (kind === 'project-negative') vault.projects = [{ id: 'p', name: 'Projekt syntetyczny', role: '', description: 'Nie używałem Docker.', techStack: ['Docker'] }];
      if (kind === 'welding') vault.history = [{ id: 'h', company: 'Zakład syntetyczny', role: 'Spawacz', location: '', startDate: '', endDate: '', isCurrent: false,
        description: 'Wykonywałem Spawanie MIG/MAG elementów konstrukcji.', highlights: [],
      }];
      if (kind === 'warehouse') vault.projects = [{ id: 'p', name: 'Projekt magazynowy', role: 'Magazynier', description: 'Obsługiwałem WMS przy kompletacji zamówień.', techStack: [] }];
      a.root.render(a.createElement(a.SkillBridgeMatrixModal, { isOpen: true, onClose: () => {}, vault, initialMissingSkill: skill }));
    }, { kind, skill });
    await page.getByRole('textbox', { name: 'Brakująca umiejętność', exact: true }).waitFor();
  }
  await renderCase('negative', 'Kafka');
  await page.getByText('Brak udokumentowanego powiązania dla wybranych umiejętności.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Kopiuj odpowiedź', exact: true }).count(), 0);
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.shadow-floating')).opacity) >= 0.99);
  await page.screenshot({ path: 'docs/evidence/skill-bridge-negative-evidence-2026-10-04.png', animations: 'disabled' });
  await renderCase('project-negative', 'Kubernetes');
  await page.getByText('Brak udokumentowanego powiązania dla wybranych umiejętności.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Kopiuj odpowiedź', exact: true }).count(), 0);
  await renderCase('welding', 'Spawanie TIG');
  await page.getByText('W profilu: Spawanie MIG/MAG', { exact: true }).waitFor();
  await page.getByText('Zakład syntetyczny (Spawacz)', { exact: true }).waitFor();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.shadow-floating')).opacity) >= 0.99);
  await page.screenshot({ path: 'docs/evidence/skill-bridge-narrative-evidence-2026-10-04.png', animations: 'disabled' });
  await renderCase('warehouse', 'SAP WMS');
  await page.getByText('W profilu: WMS', { exact: true }).waitFor();
  await page.getByText('Projekt magazynowy (Magazynier)', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: zanegowane tagi nie tworzą mostu; pozytywny opis spawacza i magazyniera tworzy powiązanie z właściwym źródłem.');
} finally { await browser.close(); }
