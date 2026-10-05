/** Potwierdza, że niezakresowany agregat użycia AI nie jest publicznym API. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const SCREENSHOT = 'docs/evidence/usage-stats-404-2026-10-02.png';

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
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  const response = await page.goto(`${BASE_URL}/api/usage/stats`, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 404, 'Nieistniejąca statystyka powinna zwrócić HTTP 404.');

  const body = await page.locator('body').innerText();
  assert.match(body, /Nie znaleziono takiego zasobu API/);
  assert.doesNotMatch(body, /promptTokens|outputTokens|estimatedCostUsd|byContext/);

  mkdirSync('docs/evidence', { recursive: true });
  await page.screenshot({ path: SCREENSHOT, fullPage: true });
  console.log(`PASS: HTTP ${response.status()}, brak publicznego agregatu zużycia AI; zrzut: ${SCREENSHOT}`);
} finally {
  await browser.close();
}
