import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/home-invalid-score-value-2026-10-01.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } });

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { HomeView }, { AuthProvider }, { ANONYMOUS_PROFILE_ID }, { StorageKeys, profileDataKeyFor }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/views/HomeView.tsx'),
      import('/src/context/AuthContext.tsx'),
      import('/src/lib/localProfile.ts'),
      import('/src/lib/storage.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const validContext = {
      detectedRequirementCount: 3,
      profileCompleteness: 100,
      unmetBlockingRequirementCount: 0,
      unconfirmedBlockingRequirementCount: 0,
      scoreContextVersion: 4,
      careerEvidenceAvailable: true,
      careerEvidenceVersion: 2,
    };
    localStorage.setItem(profileDataKeyFor(StorageKeys.lastJobAnalysis, ANONYMOUS_PROFILE_ID), JSON.stringify({
      position: 'Specjalista wsparcia',
      company: 'Firma testowa',
      score: null,
      strengths: ['Windows'],
      gaps: ['Intune'],
      analyzedAt: new Date().toISOString(),
      profileUpdatedAt: new Date().toISOString(),
      atsScoreContext: validContext,
    }));
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 850px; margin: 24px auto"></main>';
    const action = createElement('div', { className: 'rounded-xl border p-4' }, 'Następny krok — dane syntetyczne');
    createRoot(document.getElementById('audit-preview')).render(
      createElement(AuthProvider, null,
        createElement(HomeView, { actionSlot: action, onNavigate: () => undefined }))
    );
  });

  await page.getByText('Ostatnia analiza').waitFor({ state: 'visible' });
  await page.getByText('Zapisanej analizy nie można odczytać', { exact: true }).waitFor({ state: 'visible' });
  await page.getByText(/Dane historyczne są niekompletne lub uszkodzone/).waitFor({ state: 'visible' });
  const screenText = await page.locator('#audit-preview').innerText();
  if (screenText.includes('null%') || screenText.includes('0%') || screenText.includes('NaN%')) {
    throw new Error(`HomeView nadal prezentuje nieprawidłową wartość jako procent: ${screenText}`);
  }
  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#audit-preview').screenshot({ path: OUTPUT, fullPage: true });
  console.log(`Niepoprawna wartość wyniku ma stan niezweryfikowany bez procentu. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
