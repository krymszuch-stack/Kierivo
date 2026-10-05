import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3042';
const LEGACY_DOC_OUTPUT = 'docs/evidence/legacy-doc-conversion-guidance-2026-10-01.png';
const PROFILE_JSON_OUTPUT = 'docs/evidence/profile-json-import-guidance-2026-10-01.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 760 } });

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { QuickAtsCheck }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/quickcheck/QuickAtsCheck.tsx'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 920px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-preview')).render(
      createElement(QuickAtsCheck, { onSaveProfile: () => {}, onOpenEditor: () => {} })
    );
  });

  const fileInput = page.locator('#audit-preview input[type="file"]');
  await fileInput.waitFor({ state: 'attached' });
  const accepted = await fileInput.getAttribute('accept');
  if (['.doc', '.json'].some((extension) => accepted?.split(',').includes(extension))) {
    throw new Error(`Selektor nadal oferuje format nieobsługiwany jako tekst CV: ${accepted}`);
  }

  await fileInput.setInputFiles({
    name: 'cv.doc',
    mimeType: 'application/msword',
    buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  });
  const alert = page.getByRole('alert');
  await alert.getByText(/Word 97–2003 \(\.doc\).*DOCX lub PDF/i).waitFor({ state: 'visible' });
  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#audit-preview').screenshot({ path: LEGACY_DOC_OUTPUT });

  await fileInput.setInputFiles({
    name: 'MasterVault.json',
    mimeType: 'application/json',
    buffer: Buffer.from('\uFEFF{"personalInfo":{"fullName":"Jan Kowalski"},"history":[]}'),
  });
  await alert.getByText(/kopię profilu MasterVault.*edytorze profilu/i).waitFor({ state: 'visible' });
  await page.locator('#audit-preview').screenshot({ path: PROFILE_JSON_OUTPUT });
  console.log(`OK: .doc i JSON profilu nie są oferowane jako CV; oba pliki otrzymują właściwą wskazówkę. Zrzuty: ${LEGACY_DOC_OUTPUT}, ${PROFILE_JSON_OUTPUT}`);
} finally {
  await browser.close();
}
