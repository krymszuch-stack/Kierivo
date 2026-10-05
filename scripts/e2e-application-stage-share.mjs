/** E2E kafelka: etykieta opisuje biezace statusy, nie historie konwersji. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const SCREENSHOT = 'docs/evidence/application-stage-share-2026-10-02.png';

let chromium;
try {
  const modulePath = process.env.PLAYWRIGHT_MODULE ||
    'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
  ({ chromium } = await import(modulePath));
} catch {
  console.error('Brak Playwright. Ustaw PLAYWRIGHT_MODULE na lokalny modul Playwright.');
  process.exit(2);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 720, height: 320 } });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    document.body.replaceChildren();
    Object.assign(document.body.style, { margin: '0', minHeight: '100vh', background: 'var(--color-app-bg)' });
    const React = await import('/node_modules/.vite/deps/react.js');
    const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const { ApplicationProgressTile } = await import('/src/features/tracker/ApplicationProgressTile.tsx');
    const host = document.createElement('div');
    host.id = 'application-stage-share-proof';
    Object.assign(host.style, {
      width: '340px', margin: '24px', padding: '12px',
      borderRadius: '16px', background: 'var(--color-surface)',
    });
    document.body.append(host);
    createRoot(host).render(createElement(ApplicationProgressTile, {
      statuses: ['Do wys\u0142ania', 'Wys\u0142ana', 'Rozmowa', 'Oferta', 'Odrzucona'],
    }));
  });

  await page.getByText('Aktualnie w rozmowie/ofercie', { exact: true }).waitFor();
  assert.equal(await page.locator('#application-stage-share-proof').getByText('50%', { exact: true }).count(), 1);
  assert.equal(await page.getByText('2 z 4 wys\u0142anych aplikacji', { exact: true }).count(), 1);
  assert.equal(await page.getByText('Przej\u015Bcie do rozmowy/oferty', { exact: true }).count(), 0);

  mkdirSync('docs/evidence', { recursive: true });
  await page.locator('#application-stage-share-proof').screenshot({ path: SCREENSHOT });
  console.log(`PASS: widok pokazuje biezacy udzial 2/4; zrzut: ${SCREENSHOT}`);
} finally {
  await browser.close();
}
