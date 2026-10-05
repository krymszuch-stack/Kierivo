/** Potwierdza, że zapisany wynik pokazuje oba rodzaje nierozstrzygniętych formaliów. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/ats-score-mixed-formal-uncertainty-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 850 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { CANONICAL_ATS_SCORE_PROVENANCE } = await import('/src/types/index.ts');
    const { getAnalysisMonth } = await import('/src/lib/analysisPeriod.ts');
    const calculationTime = new Date();
    const [React, ReactDOM, { HistoricalDocumentModal }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/tracker/HistoricalDocumentModal.tsx'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const application = {
      id: 'synthetic-mixed-formal-score',
      company: 'Firma testowa',
      position: 'Technik serwisu',
      date: '2026-10-02',
      status: 'Wysłana',
      atsScore: 62,
      atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE,
      atsScoreContext: {
        calculatedAt: calculationTime.toISOString(),
        calculationMonth: getAnalysisMonth(calculationTime),
        detectedRequirementCount: 5,
        profileCompleteness: 100,
        unmetBlockingRequirementCount: 1,
        unconfirmedBlockingRequirementCount: 1,
        unconfirmedRequirementCount: 1,
        scoreContextVersion: 5,
        careerEvidenceAvailable: true,
        careerEvidenceVersion: 2,
      },
    };
    document.body.innerHTML = '<main id="audit-preview"></main>';
    createRoot(document.getElementById('audit-preview')).render(
      createElement(HistoricalDocumentModal, {
        application,
        isOpen: true,
        onClose: () => undefined,
      })
    );
  });

  await page.getByText('Niepotwierdzony wymóg obowiązkowy: 62%', { exact: true }).waitFor();
  await page.getByText(/Profil nie potwierdza 1 wymogu, który oferta oznacza jako obowiązkowy/).waitFor();
  await page.getByText(/Dodatkowo 1 wymóg formalny wymaga potwierdzenia/).waitFor();
  const text = await page.locator('body').innerText();
  assert.match(text, /Wynik nie oznacza spełnienia tych kryteriów/);
  assert.match(text, /brak danych nie oznacza ich spełnienia ani niespełnienia/);
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  const dialog = page.getByRole('dialog');
  await page.waitForTimeout(300);
  await dialog.screenshot({ path: OUTPUT });
  console.log(`PASS: zapisany wynik pokazuje niespełniony i niepotwierdzony wymóg; zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
