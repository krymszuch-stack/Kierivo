import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3042';
const OUTPUT = 'docs/evidence/long-cv-rejected-2026-10-01.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 820 } });

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
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 1040px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-preview')).render(
      createElement(QuickAtsCheck, { onSaveProfile: () => {}, onOpenEditor: () => {} })
    );
  });

  await page.getByRole('heading', { name: 'Sprawdź dopasowanie CV do ogłoszenia' }).waitFor({ state: 'visible' });
  await page.getByText('To szybkie sprawdzenie liczy się w przeglądarce. CV nie jest wysyłane na serwer.', { exact: true }).waitFor({ state: 'visible' });

  const cv = `Anna Kowalska\nDoświadczenie zawodowe\nWsparcie IT 2020-2025\n${'opis '.repeat(40_050)}`;
  const jd = 'Specjalista wsparcia IT. Wymagania: Windows, Microsoft 365, obsługa zgłoszeń i diagnoza problemów użytkowników. Zapewniamy wdrożenie i współpracę w zespole.';
  await page.locator('#quick-cv').fill(cv);
  await page.locator('#quick-jd').fill(jd);
  await page.locator('#audit-preview button').last().click();

  const alert = page.getByRole('alert');
  await alert.getByText(/CV przekracza limit 200.?000/i).waitFor({ state: 'visible' });
  if (await page.locator('[data-testid="quick-ats-result"]').count()) {
    throw new Error('Zbyt długie CV mimo ostrzeżenia otrzymało wynik dopasowania.');
  }
  if (await page.locator('#quick-cv').getAttribute('aria-invalid') !== 'true') {
    throw new Error('Pole CV nie zostało oznaczone jako nieprawidłowe.');
  }

  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#audit-preview').screenshot({ path: OUTPUT });
  console.log(`OK: ${cv.length} znaków zostało jawnie odrzuconych przed scoringiem. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
