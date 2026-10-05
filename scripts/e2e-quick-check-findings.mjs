import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/quick-check-no-fabricated-defaults-2026-10-01.png';

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
const page = await browser.newPage({ viewport: { width: 1440, height: 640 } });

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { QuickCheckFindings }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/onboarding/QuickCheckFindings.tsx'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 780px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-preview')).render(
      createElement(QuickCheckFindings, { problems: [] })
    );
  });

  await page.getByRole('heading', { name: 'Wnioski z tej analizy (0)' }).waitFor({ state: 'visible' });
  await page.getByRole('status').getByText(/nie zwróciła dodatkowych ustaleń/).waitFor({ state: 'visible' });
  const text = await page.locator('#audit-preview').innerText();
  if (/Wzmocnij osiągnięcia liczbami|Dopasuj nazewnictwo stanowisk|Skondensuj podsumowanie zawodowe/i.test(text)) {
    throw new Error('Pusty wynik nadal zawiera domyślne porady bez dowodów z analizy.');
  }

  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#audit-preview').screenshot({ path: OUTPUT });

  const optionalResult = await page.evaluate(async () => {
    const [react, reactDom, { QuickCheckFindings }, { runQuickAtsCheck, extractTopThreeProblems }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/onboarding/QuickCheckFindings.tsx'),
      import('/src/lib/quickAtsCheck.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const cv = [
      'Jan Testowy — monter instalacji',
      'Doświadczenie zawodowe: serwis instalacji HVAC w latach 2021–2025.',
      'Umiejętności: montaż, diagnostyka, obsługa narzędzi pomiarowych.',
      'Edukacja: technik urządzeń sanitarnych, 2017–2021.',
    ].join('\n');
    const jd = 'Mile widziane uprawnienia SEP G3 jako dodatkowy atut kandydata w tej rekrutacji. Szczegóły stanowiska i organizacji pracy omówimy podczas rozmowy kwalifikacyjnej.';
    const result = runQuickAtsCheck(cv, jd);
    const finding = result.knockouts.findings.find((item) => item.ruleId === 'sep_g3');
    const problems = extractTopThreeProblems(result);
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 780px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-preview')).render(
      createElement(QuickCheckFindings, { problems })
    );
    return { severity: finding?.severity, satisfied: finding?.satisfied, problemIds: problems.map((problem) => problem.id) };
  });

  if (optionalResult.severity !== 'preferred' || optionalResult.satisfied !== false || optionalResult.problemIds.includes('ko-sep_g3')) {
    throw new Error(`Opcjonalne SEP G3 zostało błędnie pokazane jako brak krytyczny: ${JSON.stringify(optionalResult)}`);
  }
  await page.getByRole('heading', { name: /Wnioski z tej analizy/ }).waitFor({ state: 'visible' });
  await page.locator('#audit-preview').screenshot({ path: 'docs/evidence/quick-check-optional-not-critical-2026-10-01.png' });
  console.log(`Pusty wynik bez porad: ${OUTPUT}`);
  console.log('Wynik z opcjonalnym SEP G3 nie pokazuje go jako krytycznego; zrzut zapisano w docs/evidence/quick-check-optional-not-critical-2026-10-01.png');
} finally {
  await browser.close();
}
