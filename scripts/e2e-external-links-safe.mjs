import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/external-links-scheme-guard-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [React, ReactDOM, { TrackerTable }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/tracker/TrackerTable.tsx'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    document.body.innerHTML = '<main id="external-link-proof" style="max-width:1100px;margin:40px auto;padding:24px"></main>';
    const root = createRoot(document.getElementById('external-link-proof'));
    const common = { salary: '', date: '2026-10-02', status: 'Do wysłania', notes: '' };
    root.render(createElement(TrackerTable, {
      applications: [
        { ...common, id: 'safe', company: 'Firma A', position: 'Stanowisko A', jobUrl: 'https://example.com/jobs/1' },
        { ...common, id: 'unsafe', company: 'Firma B', position: 'Stanowisko B', jobUrl: 'javascript:alert(document.domain)' },
      ],
      isAdvancedMode: true,
      onStatusChange: () => {}, onEdit: () => {}, onDelete: () => {},
      onOpenNotes: () => {}, onViewDocument: () => {}, onOpenCheatSheet: () => {},
    }));
  });

  const panel = page.locator('#external-link-proof');
  const safeLink = panel.getByRole('link', { name: 'Link do oferty' });
  await safeLink.waitFor({ state: 'visible' });
  assert.equal(await safeLink.count(), 1);
  assert.equal(await safeLink.getAttribute('href'), 'https://example.com/jobs/1');
  assert.equal(await panel.locator('a[href^="javascript:"]').count(), 0);
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);
  await mkdir('docs/evidence', { recursive: true });
  await panel.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: rzeczywisty TrackerTable pokazuje bezpieczny link i ukrywa schemat javascript:. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
