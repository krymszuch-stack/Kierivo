import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/star-coach-score-verdict-consistency-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1150 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.route('**/api/ai/coach-star/evaluate-answer', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        evaluation: {
          overallScore: 8,
          verdict: 'EXCELLENT',
          starBreakdown: {
            situation: { score: 8, feedback: 'Tlo sytuacji jest zrozumiale.' },
            task: { score: 8, feedback: 'Zadanie jest jasno opisane.' },
            action: { score: 8, feedback: 'Dzialania sa konkretne.' },
            result: { score: 8, feedback: 'Rezultat jest opisany.' },
          },
          strengths: ['Konkretne dzialania.'],
          improvements: ['Doprecyzuj szczegoly.'],
          exemplaryResponse: 'Szkic bez dodawania nowych faktow.',
        },
      }),
    });
  });

  await page.evaluate(async () => {
    const [react, reactDom, { StarCoachSection }, { createEmptyVault }, entitlements] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/cockpit/StarCoachSection.tsx'),
      import('/src/lib/sampleVault.ts'),
      import('/src/store/useEntitlements.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    entitlements.setAuthenticatedEntitlements({ status: 'free' }, { aiUses: 3 });
    document.body.innerHTML = '<main id="audit-star-coach" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-star-coach')).render(createElement(StarCoachSection, { vault: createEmptyVault() }));
  });

  const coach = page.locator('#audit-star-coach');
  await coach.getByRole('checkbox').check();
  await coach.getByPlaceholder(/Wpisz lub podyktuj odpowiedź/).fill('Podczas zmiany awaria zatrzymala obsluge. Moim zadaniem bylo przywrocic dzialanie. Sprawdzilem logi i cofnalem zmiane. Usluga wrocila, ale czasu nie mierzylismy.');
  await coach.getByRole('button', { name: /Oceń odpowiedź/ }).click();
  await coach.getByText('Mocna struktura według AI').waitFor({ state: 'visible' });
  const report = await coach.locator('div.animate-fade-in').innerText();
  assert.match(report, /8\s*\/10/);
  assert.match(report, /Mocna struktura według AI/);
  assert.doesNotMatch(report, /Do dopracowania według AI/);
  await mkdir('docs/evidence', { recursive: true });
  await coach.screenshot({ path: OUTPUT, fullPage: true });
  assert.deepEqual(pageErrors, [], 'spójny wynik i werdykt nie mogą powodować błędu renderowania');
  console.log(`Wynik STAR 8/10 jest sparowany z werdyktem EXCELLENT. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
