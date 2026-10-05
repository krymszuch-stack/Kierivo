import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/cv360-without-offer-no-overall-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1180, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.route('**/api/ai/verify-cv', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        report: {
          hasJobDescription: false,
          overallScore: null,
          verdict: null,
          summary: 'Dostepne sa tylko ogolne opinie AI o profilu. Nie oceniono dopasowania do oferty.',
          atsLoop: { atsScore: null, parsedRole: '', recognizedKeywords: [], missingCriticalKeywords: [], atsFormatRisks: [] },
          recruiterLoop: { recruiterScore: 82, headlineClarity: 'AVERAGE', strengthsFound: ['Doswiadczenie opisane w profilu.'], weaknessesOrFluff: [], achievementMetricRatePct: 50 },
          logicComplianceLoop: { consistencyScore: 90, chronologyValid: true, timelineAnomalies: [], logicalInconsistencies: [], rodoCompliant: null, privacyRisks: [] },
          actionableRecommendations: [],
        },
      }),
    });
  });

  await page.evaluate(async () => {
    const [React, ReactDOM, { Cv360VerifierModal }, { setAuthenticatedEntitlements }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/matcher/Cv360VerifierModal.tsx'),
      import('/src/store/useEntitlements.ts'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    setAuthenticatedEntitlements({ status: 'free' }, { aiUses: 5 });
    const vault = {
      version: '1', updatedAt: '2026-10-02T00:00:00.000Z',
      personalInfo: { fullName: 'Jan Testowy', title: 'Technik wsparcia', summary: 'Diagnoza usterek i obsluga zgloszen.' },
      skillsMatrix: { hardSkills: ['Troubleshooting'], toolsAndTech: ['Windows'], softSkills: [], certifications: [] },
      history: [], education: [], projects: [],
      profiler: { flags: [], experienceLevel: 'MID', location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false }, languages: [] },
    };
    document.body.innerHTML = '<main id="audit-cv360-no-offer"></main>';
    createRoot(document.getElementById('audit-cv360-no-offer')).render(createElement(Cv360VerifierModal, {
      isOpen: true,
      onClose: () => undefined,
      vault,
      targetRole: 'Technik wsparcia',
      currentUser: { id: 'synthetic-user', name: 'Jan Testowy' },
    }));
  });

  const dialog = page.locator('#audit-cv360-no-offer');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: /Uruchom analizę profilu AI/ }).click();
  await dialog.getByText('Pełny wynik wymaga treści oferty').waitFor({ state: 'visible' });
  const text = await dialog.innerText();
  assert.match(text, /Wynik 360° wstrzymany/i);
  assert.match(text, /82\/100/);
  assert.match(text, /90\/100/);
  assert.doesNotMatch(text, /Gotowe do Aplikowania|Wynik 360°\s+\d+\/100/i);
  await mkdir('docs/evidence', { recursive: true });
  // Modal tworzy własną warstwę fixed poza kontenerem testowym, więc zapisujemy cały widok.
  await page.screenshot({ path: OUTPUT, fullPage: true });
  assert.deepEqual(pageErrors, [], 'brak oferty nie moze wywolac bledu prezentacji wyniku 360');
  console.log(`Bez oferty wynik 360 i werdykt sa wstrzymane, pozostale petle AI widoczne. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
