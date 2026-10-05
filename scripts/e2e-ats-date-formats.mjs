import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/ats-date-format-validation-2026-10-01.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const [react, reactDom, { AtsSimulatorView }, { simulateAtsCheck }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/matcher/AtsSimulatorView.tsx'),
      import('/src/lib/atsSimulator.ts'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const make = (date) => {
      const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
      vault.personalInfo.title = 'Developer';
      vault.history = [{
        id: `date-${date}`, company: 'Przykładowa firma', role: 'Developer', location: '',
        startDate: date, endDate: '2022-01', isCurrent: false,
        highlights: [{ id: `highlight-${date}`, text: 'Python support', action: '', target: '', tool: '', metric: '', keywords: [] }],
      }];
      const resume = {
        targetJobTitle: 'Developer', companyName: '', summary: '', selectedHighlights: [],
        skillsMatched: { hardSkills: [], toolsAndTech: [], softSkills: [] }, atsScore: 0,
      };
      return simulateAtsCheck(resume, vault, 'Wymagania: Python.');
    };
    const valid = make('2020-01');
    const invalid = make('2020-13');
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 900px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-preview')).render(createElement('div', { className: 'space-y-6' },
      createElement('h1', { className: 'text-xl font-bold' }, 'Walidacja dat w analizie Kierivo'),
      createElement('section', { className: 'rounded-xl border p-4' },
        createElement('h2', { className: 'mb-3 font-semibold' }, 'Poprawna data profilu: 2020-01'),
        createElement(AtsSimulatorView, { result: valid })),
      createElement('section', { className: 'rounded-xl border p-4' },
        createElement('h2', { className: 'mb-3 font-semibold' }, 'Niepoprawna data profilu: 2020-13'),
        createElement(AtsSimulatorView, { result: invalid })),
    ));
    return { valid: valid.badDateFormats, invalid: invalid.badDateFormats };
  });

  if (result.valid.length !== 0 || result.invalid.length !== 1) {
    throw new Error(`Oczekiwano 0 ostrzeżeń dla YYYY-MM i 1 dla niepoprawnego miesiąca: ${JSON.stringify(result)}`);
  }
  await page.getByText(/nieprawidlowe formaty dat: 0/).waitFor({ state: 'visible' });
  await page.getByText(/nieprawidlowe formaty dat: 1/).waitFor({ state: 'visible' });
  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#audit-preview').screenshot({ path: OUTPUT, fullPage: true });
  console.log(`Poprawna data YYYY-MM: 0 ostrzeżeń; niepoprawna 2020-13: 1 ostrzeżenie. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
