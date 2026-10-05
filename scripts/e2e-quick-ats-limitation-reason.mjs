/** E2E: szybki wynik wyjaĹ›nia rzeczywisty powĂłd ograniczenia. */
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/quick-ats-limitation-reason-2026-10-02.png';
const NO_SCORE_OUTPUT = 'docs/evidence/quick-ats-no-score-unconfirmed-2026-10-02.png';
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

const cv = [
  'Jan Testowy',
  'Specjalista IT Support',
  'Podsumowanie zawodowe',
  'Wsparcie techniczne u\u017cytkownikow i diagnozowanie problemow komputerowych.',
  'Doswiadczenie zawodowe',
  'Specjalista wsparcia IT - Example Support | 2021-2025',
  'Rozwiazywanie zgloszen, konfiguracja komputerow i dokumentowanie rozwiazan.',
  'Umiejetnosci',
  'Python, AWS, Docker, SQL, ServiceNow, Windows 11 i Microsoft 365.',
  'Uprawnienia',
  'Prawo jazdy kat. B.',
].join('\n');
const jd = [
  'Specjalista wsparcia IT',
  'Wymagania:',
  'Wymagane umiejetnosci: Python, AWS, Docker i SQL.',
  'Wymagane aktualne prawo jazdy kat. B.',
  'Zakres obejmuje diagnozowanie problemow i obsluge zgloszen uzytkownikow.',
].join('\n');

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [reactModule, domModule, { QuickAtsCheck }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/quickcheck/QuickAtsCheck.tsx'),
    ]);
    const createRoot = domModule.createRoot ?? domModule.default?.createRoot;
    const createElement = reactModule.createElement ?? reactModule.default?.createElement;
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 980px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-preview')).render(
      createElement(QuickAtsCheck, { onSaveProfile: () => {}, onOpenEditor: () => {} })
    );
  });

  await page.locator('#quick-cv').waitFor({ state: 'visible' });
  await page.locator('#quick-cv').fill(cv);
  await page.locator('#quick-jd').fill(jd);
  await page.getByRole('button', { name: 'Sprawd\u017a dopasowanie' }).click();
  const result = page.getByTestId('quick-ats-result');
  await result.waitFor({ state: 'visible', timeout: 15_000 });

  const resultText = await result.innerText();
  const noteCount = await result.locator('[role="note"]').count();
  if (!resultText.includes('Nie mo\u017cna potwierdzi\u0107') ||
      !/prawo jazdy/i.test(resultText) ||
      !resultText.includes('nie obni\u017caj\u0105 wyniku jako braki') ||
      /Rozpoznano tylko \d+/.test(resultText) ||
      noteCount !== 1) {
    throw new Error(`Szybki wynik b\u0142\u0119dnie opisa\u0142 przyczyn\u0119 ograniczenia: ${resultText}`);
  }
  if (pageErrors.length) throw new Error(`B\u0142\u0119dy strony: ${pageErrors.join('; ')}`);

  await page.screenshot({ path: OUTPUT, fullPage: true });

  const unknownOnlyJd = [
    'Specjalista wsparcia IT',
    'Wymagane aktualne prawo jazdy kat. B.',
    'Zakres obejmuje diagnozowanie problemow i obsluge zgloszen uzytkownikow w siedzibie firmy.',
  ].join('\n');
  await page.getByRole('button', { name: 'Wyczy\u015b\u0107', exact: true }).click();
  await page.locator('#quick-cv').fill(cv);
  await page.locator('#quick-jd').fill(unknownOnlyJd);
  await page.getByRole('button', { name: 'Sprawd\u017a dopasowanie' }).click();
  await result.waitFor({ state: 'visible', timeout: 15_000 });
  await result.getByText('Nie wyliczono wyniku dopasowania', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
  const noScoreText = await result.innerText();
  const noScoreNoteCount = await result.locator('[role="note"]').count();
  if (/\b\d+%/.test(noScoreText) || noScoreNoteCount !== 1 ||
      !/Brak wyniku/i.test(noScoreText) || /Wst\u0119pny wynik/i.test(noScoreText)) {
    throw new Error(`Brak podstaw do wyniku pokazuje procent lub powtorzone wyjasnienie: ${noScoreText}`);
  }
  await page.waitForTimeout(700);
  await page.screenshot({ path: NO_SCORE_OUTPUT, fullPage: true });
  console.log(`OK: oba stany niepewnego wymagania maja jedno wyjasnienie bez wyniku zastępczego; zrzuty: ${OUTPUT}, ${NO_SCORE_OUTPUT}`);
} catch (error) {
  console.error('Stan strony przy b\u0142\u0119dzie:', (await page.locator('body').innerText().catch(() => '')).slice(-2_000));
  await page.screenshot({ path: OUTPUT.replace('.png', '-debug.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
