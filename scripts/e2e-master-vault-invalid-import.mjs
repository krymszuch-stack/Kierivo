import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3046';
const OUTPUT = 'docs/evidence/master-vault-invalid-import-2026-10-02.png';
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
    const [react, reactDom, { MasterVaultEditor }, { AuthProvider }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/vault/MasterVaultEditor.tsx'),
      import('/src/context/AuthContext.tsx'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createElement = react.createElement ?? react.default?.createElement;
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const initialVault = createEmptyVault('Profil testowy', '');
    window.__masterVaultImportChanges = 0;
    document.body.innerHTML = '<main id="audit-vault" style="max-width: 1280px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-vault')).render(
      createElement(AuthProvider, null,
        createElement(MasterVaultEditor, {
          vault: initialVault,
          onChange: () => { window.__masterVaultImportChanges += 1; },
        }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    const invalid = { ...initialVault, history: [null] };
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify(invalid)], 'wadliwy-master-vault.json', { type: 'application/json' }));
    const input = document.querySelector('#audit-vault input[type="file"]');
    Object.defineProperty(input, 'files', { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const panel = page.locator('#audit-vault');
  await panel.getByText('Import odrzucony: plik nie zawiera kompletnego, prawidłowego profilu MasterVault.', { exact: true })
    .waitFor({ state: 'visible' });
  const changes = await page.evaluate(() => window.__masterVaultImportChanges);
  assert.equal(changes, 0, 'wadliwy import nie może częściowo nadpisać bieżącego profilu');
  assert.deepEqual(pageErrors, [], `Błędy strony: ${pageErrors.join('; ')}`);
  await mkdir('docs/evidence', { recursive: true });
  await panel.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: niekompletna historia z pliku JSON została odrzucona bez wywołania onChange. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
