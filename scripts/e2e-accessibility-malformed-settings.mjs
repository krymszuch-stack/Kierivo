import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3046';
const OUTPUT = 'docs/evidence/accessibility-malformed-settings-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { AccessibilityProvider }, { AccessibilityModal }, storage] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/providers/AccessibilityProvider.tsx'),
      import('/src/components/a11y/AccessibilityModal.tsx'),
      import('/src/lib/storage.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    storage.writeJson(storage.StorageKeys.a11ySettings, {
      highContrast: 'false',
      textScale: 'gigantic',
      dyslexicSpacing: true,
      enhancedFocus: 1,
      reducedMotion: null,
    });
    document.body.innerHTML = '<main id="audit-a11y-settings"></main>';
    createRoot(document.getElementById('audit-a11y-settings')).render(createElement(AccessibilityProvider, null,
      createElement(AccessibilityModal, { isOpen: true, onClose: () => {} }),
    ));
  });

  const dialog = page.getByRole('dialog');
  await dialog.getByText('Rozmiar czcionek i interfejsu', { exact: true }).waitFor({ state: 'visible' });
  await page.locator('html[data-dyslexic-spacing="true"]').waitFor({ state: 'attached' });
  const switches = dialog.getByRole('switch');
  assert.equal(await switches.count(), 4);
  assert.deepEqual(await switches.evaluateAll((items) => items.map((item) => item.getAttribute('aria-checked'))), [
    'false', 'true', 'false', 'false',
  ]);
  assert.equal(await dialog.getByRole('button', { name: 'Standardowy' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('html').getAttribute('data-high-contrast'), null);
  assert.equal(await page.locator('html').getAttribute('data-text-scale'), null);
  assert.equal(await page.locator('html').getAttribute('data-enhanced-focus'), null);
  assert.equal(await page.locator('html').getAttribute('data-reduced-motion'), null);
  assert.deepEqual(pageErrors, [], 'wadliwe preferencje nie mogą tworzyć niespójnego stanu dostępności');
  await mkdir('docs/evidence', { recursive: true });
  await dialog.screenshot({ path: OUTPUT });
  console.log(`Ustawienia dostępności zachowały poprawne pole, naprawiły wadliwe wartości i zastosowały tylko obsługiwane atrybuty. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
