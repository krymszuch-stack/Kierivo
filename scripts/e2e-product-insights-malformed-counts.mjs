import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3046';
const OUTPUT = 'docs/evidence/product-insights-malformed-counts-2026-10-02.png';
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
    const [react, reactDom, { PrivacyPolicyModal }, storage, insights] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/components/legal/PrivacyPolicyModal.tsx'),
      import('/src/lib/storage.ts'),
      import('/src/lib/productInsights.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    insights.setProductInsightsEnabled(true);
    storage.writeJson(storage.StorageKeys.productInsights, {
      version: 1,
      events: {
        advisor_opened: '4',
        advisor_suggestion_clicked: -7,
        career_article_opened: 2,
      },
    });
    insights.trackProductInsight('advisor_opened');
    document.body.innerHTML = '<main id="audit-product-insights"></main>';
    createRoot(document.getElementById('audit-product-insights')).render(createElement(PrivacyPolicyModal, {
      isOpen: true,
      onClose: () => {},
    }));
  });

  const dialog = page.getByRole('dialog');
  const countLine = dialog.locator('p.rounded-xl');
  await countLine.waitFor({ state: 'visible' });
  const text = await countLine.innerText();
  assert.match(text, /Doradca\s+1/);
  assert.match(text, /wskazówki\s+0/);
  assert.match(text, /artykuły\s+2/);
  assert.doesNotMatch(text, /41|NaN|-7/);
  assert.deepEqual(pageErrors, [], 'niepoprawne liczniki nie mogą wywołać błędu prywatności ani raportu');
  await mkdir('docs/evidence', { recursive: true });
  await dialog.screenshot({ path: OUTPUT });
  console.log(`Privacy modal displays normalized local counters after malformed values. Screenshot: ${OUTPUT}`);
} finally {
  await browser.close();
}
