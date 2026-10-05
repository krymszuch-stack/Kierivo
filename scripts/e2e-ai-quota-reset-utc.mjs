/** Potwierdza jawne pokazanie granicy doby UTC na stronie limitów Pre-Beta. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const SCREENSHOT = 'docs/evidence/ai-quota-reset-utc-2026-10-02.png';

let chromium;
try {
  const modulePath = process.env.PLAYWRIGHT_MODULE ||
    'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
  ({ chromium } = await import(modulePath));
} catch {
  console.error('Brak Playwright. Ustaw PLAYWRIGHT_MODULE na lokalny moduł Playwright.');
  process.exit(2);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    document.body.replaceChildren();
    Object.assign(document.body.style, { margin: '0', minHeight: '100vh', background: 'var(--color-app-bg)' });
    const React = await import('/node_modules/.vite/deps/react.js');
    const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const { PricingView } = await import('/src/views/PricingView.tsx');
    const host = document.createElement('div');
    host.id = 'ai-quota-reset-utc-proof';
    document.body.append(host);
    createRoot(host).render(createElement(PricingView));
  });

  const view = page.locator('#ai-quota-reset-utc-proof');
  await view.getByText('00:00 UTC', { exact: false }).first().waitFor();
  const text = await view.innerText();
  assert.match(text, /25\s+zapytań\s+\/\s+dobę \(odnawiane o 00:00 UTC\)/);
  assert.match(text, /Reset limitu: 00:00 UTC/);
  assert.match(text, /Dostępność modelu zależy od konfiguracji dostawcy AI/);
  assert.doesNotMatch(text, /gpt-4o|Poland Central|dedykowaną pulę modeli Azure OpenAI/);
  assert.match(text, /Aktualnie pozostało dziś:/);
  assert.doesNotMatch(text, /odnawiane o 00:00\)/);

  mkdirSync('docs/evidence', { recursive: true });
  await view.screenshot({ path: SCREENSHOT, fullPage: true });
  console.log(`PASS: limit i licznik pokazują północ UTC; zrzut: ${SCREENSHOT}`);
} finally {
  await browser.close();
}
