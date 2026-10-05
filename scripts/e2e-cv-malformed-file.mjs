import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3042';
const OUTPUT = 'docs/evidence/cv-corrupt-docx-rejected-2026-10-01.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 760 } });
page.on('pageerror', (error) => console.error(`Błąd strony: ${error.stack || error}`));
page.on('console', (message) => {
  if (message.type() === 'error') console.error(`Konsola przeglądarki: ${message.text()}`);
});

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { CVParserModal }, { ToastHost }, entitlements, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/parser/CVParserModal.tsx'),
      import('/src/components/ui/ToastHost.tsx'),
      import('/src/store/useEntitlements.ts'),
      import('/src/lib/sampleVault.ts'),
    ]);
    entitlements.setAuthenticatedEntitlements({ status: 'free' }, { importUses: 1 });
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 920px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-preview')).render(
      createElement('div', null,
        createElement(CVParserModal, { currentVault: createEmptyVault(), onApplyVault: () => {} }),
        createElement(ToastHost),
      )
    );
  });

  const fileInput = page.locator('#audit-preview input[type="file"]');
  try {
    await fileInput.waitFor({ state: 'attached', timeout: 8_000 });
  } catch (error) {
    console.error(`Treść ekranu: ${(await page.locator('body').innerText()).slice(0, 1200)}`);
    await page.screenshot({ path: 'docs/evidence/cv-malformed-file-debug.png', fullPage: true });
    throw error;
  }
  await fileInput.setInputFiles({ name: 'uszkodzone-cv.txt', mimeType: 'text/plain', buffer: Buffer.from('A'.repeat(40)) });
  await page.getByRole('button', { name: 'Przeanalizuj CV i pokaż różnice' }).click();
  const status = page.getByRole('status');
  await status.getByText('Nie wykryto treści CV').waitFor({ state: 'visible' });
  await status.getByText(/Nie wykryto wystarczającej treści zawodowej/).waitFor({ state: 'visible' });
  if (await page.getByText(/Dodaj to do profilu/).count()) {
    throw new Error('Niepoprawny tekst CV mimo ostrzeżenia otworzył ekran scalania.');
  }

  const malformedDocx = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from('Jan Kowalski\nDoświadczenie zawodowe\nTechnik wsparcia IT', 'utf8'),
  ]);
  await fileInput.setInputFiles({
    name: 'uszkodzone-cv.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: malformedDocx,
  });
  await page.getByRole('button', { name: 'Przeanalizuj CV i pokaż różnice' }).click();
  await status.getByText('Nie udało się odczytać pliku').waitFor({ state: 'visible' });
  await status.getByText(/Nie udało się odczytać dokumentu DOCX.*Plik może być uszkodzony/i).waitFor({ state: 'visible' });
  if (await page.getByText(/Dodaj to do profilu/).count()) {
    throw new Error('Uszkodzony DOCX otworzył ekran scalania zamiast komunikatu o odrzuceniu.');
  }

  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`OK: krótki tekst oraz uszkodzony DOCX zostały zatrzymane przed podglądem i scaleniem. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
