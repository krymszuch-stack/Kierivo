const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/ats-pdf-not-checked-2026-10-01.png';

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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const report = await page.evaluate(async () => {
    const [react, reactDom, { AtsValidationPanel }, { validatePdfTextForAts }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/ats/AtsValidationPanel.tsx'),
      import('/src/lib/atsPdfValidator.ts'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const vault = createEmptyVault('Profil testowy PDF', 'pdf-audit@example.invalid');
    const result = await validatePdfTextForAts(
      'CV\nProfil testowy PDF\npdf-audit@example.invalid\nUmiejętności\nJavaScript',
      vault,
      { vendorIds: ['profil-nieistniejacy'] },
    );
    document.body.innerHTML = '<main id="pdf-not-checked-audit" style="max-width: 820px; margin: 32px auto; padding: 24px"></main>';
    createRoot(document.getElementById('pdf-not-checked-audit')).render(
      createElement(AtsValidationPanel, { report: result }),
    );
    return result;
  });

  if (report.vendors.length !== 0) throw new Error('Nieznany identyfikator utworzył raport profilu regułowego.');
  if (!report.generalRecommendations.includes('Nie wybrano rozpoznanego profilu regułowego, więc walidacja nie została wykonana.')) {
    throw new Error('Raport nie wyjaśnia, dlaczego walidacja nie została wykonana.');
  }
  await page.getByText('Lokalny przegląd tekstu PDF', { exact: true }).waitFor({ state: 'visible' });
  await page.getByText('Nie wykonano', { exact: true }).waitFor({ state: 'visible' });
  await page.getByText('0 profili regułowych', { exact: true }).waitFor({ state: 'visible' });
  await page.getByText(/Tagged PDF: nie sprawdzono/).waitFor({ state: 'visible' });
  await page.getByText(/Niewidoczny tekst: nie sprawdzono/).waitFor({ state: 'visible' });

  const text = await page.locator('#pdf-not-checked-audit').innerText();
  if (/%|\b(?:PASS|FAIL)\b|Brak uwag regułowych/.test(text)) {
    throw new Error(`Stan niezweryfikowany został pokazany jak wynik: ${text}`);
  }
  if (pageErrors.length > 0) throw new Error(`Błędy przeglądarki: ${pageErrors.join('; ')}`);

  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`E2E PDF NOT_CHECKED zakończone. Zapisano ${OUTPUT}.`);
} finally {
  await browser.close();
}
