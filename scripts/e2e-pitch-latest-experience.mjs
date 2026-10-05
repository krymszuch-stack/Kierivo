import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUTPUT = 'docs/evidence/pitch-latest-experience-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [React, ReactDOM, { ElevatorPitchModal }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/pitch/ElevatorPitchModal.tsx'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
    vault.personalInfo.title = '';
    vault.personalInfo.summary = 'Wpis profilu użyty tylko do syntetycznego sprawdzenia generatora.';
    vault.history = [
      { id: 'old', company: 'Starsza firma', role: 'Magazynier', location: 'Gdańsk', startDate: '2018-01', endDate: '2020-12', isCurrent: false, highlights: [] },
      { id: 'new', company: 'Nowsza firma', role: 'Technik wsparcia IT', location: 'Kraków', startDate: '2022-01', endDate: '2024-06', isCurrent: false, highlights: [] },
    ];
    document.body.innerHTML = '<main id="audit-latest-pitch"></main>';
    createRoot(document.getElementById('audit-latest-pitch')).render(
      createElement(ElevatorPitchModal, { isOpen: true, onClose: () => {}, vault })
    );
  });

  const panel = page.locator('#audit-latest-pitch');
  await panel.getByText('Elevator Pitch Generator', { exact: true }).waitFor({ state: 'visible' });
  await panel.locator('textarea').waitFor({ state: 'visible' });
  const generatedText = await panel.locator('textarea').inputValue();
  assert.match(generatedText, /Przygotowuję się do rozmowy na stanowisko Technik wsparcia IT\./);
  assert.doesNotMatch(generatedText, /Przygotowuję się do rozmowy na stanowisko Magazynier/);
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);

  await page.waitForTimeout(350);
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: pitch wybrał stanowisko według dat mimo starszej pracy na pierwszej karcie. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
