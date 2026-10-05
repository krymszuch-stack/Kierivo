import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/ats-impossible-date-no-recency-2026-10-01.png';
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
    const make = (date, endDate = date) => {
      const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
      vault.personalInfo.title = 'Developer';
      vault.skillsMatrix.hardSkills = ['Python'];
      vault.history = [{
        id: `date-${date}`, company: 'Przykładowa firma', role: 'Developer', location: '',
        startDate: date, endDate, isCurrent: false,
        highlights: [{ id: `highlight-${date}`, text: 'Python support', action: '', target: '', tool: '', metric: '', keywords: [] }],
      }];
      const resume = {
        targetJobTitle: 'Developer', companyName: '', summary: '', selectedHighlights: [],
        skillsMatched: { hardSkills: ['Python'], toolsAndTech: [], softSkills: [] }, atsScore: 0,
      };
      return simulateAtsCheck(resume, vault, 'Wymagania: Python.');
    };
    const valid = make('2020-02-29');
    const invalid = make('2020-02-30', '2020-03');
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 900px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-preview')).render(createElement('div', { className: 'space-y-6' },
      createElement('h1', { className: 'text-xl font-bold' }, 'Wpływ daty doświadczenia na wynik świeżości'),
      createElement('section', { className: 'rounded-xl border p-4' },
        createElement('h2', { className: 'mb-3 font-semibold' }, 'Poprawna data przestępna: 2020-02-29'),
        createElement(AtsSimulatorView, { result: valid })),
      createElement('section', { className: 'rounded-xl border p-4' },
        createElement('h2', { className: 'mb-3 font-semibold' }, 'Nieistniejąca data: 2020-02-30'),
        createElement(AtsSimulatorView, { result: invalid })),
    ));
    return { valid, invalid };
  });

  if (result.valid.layer3Scoring.recencyScore !== 100 || result.invalid.layer3Scoring.recencyScore !== null) {
    throw new Error(`Niepoprawna data wpłynęła na świeżość: valid=${result.valid.layer3Scoring.recencyScore}, invalid=${result.invalid.layer3Scoring.recencyScore}`);
  }
  if (result.valid.badDateFormats.length !== 0 || result.invalid.badDateFormats.length !== 1) {
    throw new Error(`Oczekiwano 0 ostrzeżeń dla daty poprawnej i 1 dla nieistniejącej: valid=${result.valid.badDateFormats.length}, invalid=${result.invalid.badDateFormats.length}`);
  }
  const validRecency = await page.getByText('Świeżość Umiejętności (Recency Bias)').first().locator('..').innerText();
  const invalidRecency = await page.getByText('Świeżość Umiejętności (Recency Bias)').last().locator('..').innerText();
  if (!validRecency.includes('100%') || !invalidRecency.includes('brak danych')) {
    throw new Error(`Widok nie odróżnia pomiaru od braku danych: valid="${validRecency}", invalid="${invalidRecency}"`);
  }
  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#audit-preview').screenshot({ path: OUTPUT, fullPage: true });
  console.log(`Poprawna data ISO daje wynik świeżości; nieistniejąca data daje brak pomiaru. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
