import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3042';
const OUTPUT = 'docs/evidence/cv-section-boundaries-2026-10-01.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
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

  const cv = `Anna Kowalska
Stanowisko: Specjalistka wsparcia IT
Summary: I do not know SAP or AWS. I have no experience with Kubernetes.
Skills: I do not know SAP or AWS; currently learning Kubernetes.
Podsumowanie: Doświadczona specjalistka wsparcia z praktyką w diagnozowaniu problemów sprzętowych i systemowych.
Umiejętności: Windows, Microsoft 365, TCP/IP
Doświadczenie zawodowe:
2020-2025 Specjalistka wsparcia IT, Acme
Obsługiwałam zgłoszenia i konfigurowałam stacje robocze.`;
  await page.locator('#audit-preview input[type="file"]').setInputFiles({
    name: 'anna-kowalska-cv.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(cv, 'utf8'),
  });
  await page.getByRole('button', { name: 'Przeanalizuj CV i pokaż różnice' }).click();
  await page.getByText('Windows', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText('Specjalistka wsparcia IT w Acme', { exact: true }).waitFor({ state: 'visible' });
  for (const unsupported of [
    'SAP',
    'AWS',
    'Kubernetes',
    'I do not know SAP or AWS',
    'currently learning Kubernetes',
  ]) {
    if (await page.getByText(unsupported, { exact: true }).count()) {
      throw new Error(`${unsupported} zostało pokazane jako umiejętność mimo negacji lub deklaracji nauki.`);
    }
  }
  if (await page.getByText('Obsługiwałam zgłoszenia i konfigurowałam stacje robocze w', { exact: false }).count()) {
    throw new Error('Opis obowiązków został błędnie użyty jako nazwa firmy.');
  }

  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`OK: podgląd zachowuje umiejętności i rozdziela rolę od firmy. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
