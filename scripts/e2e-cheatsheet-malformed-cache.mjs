import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3046';
const OUTPUT = 'docs/evidence/cheatsheet-malformed-cache-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
let generationRequests = 0;

try {
  await page.route('**/api/generate-cheat-sheet', async (route) => {
    generationRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        enrichment: {
          starTalkingPoints: [{
            relatedRequirement: 'React',
            situation: 'Syntetyczna sytuacja',
            task: 'Syntetyczne zadanie',
            action: 'Syntetyczne działanie',
            result: 'Syntetyczny rezultat',
          }],
          personalizedFraming: 'Syntetyczny kontekst wzbogacenia.',
          emergencyPhrases: [{ scenario: 'Pauza', phrasePL: 'Proszę o chwilę na namysł.' }],
        },
      }),
    });
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const storage = await import('/src/lib/storage.ts');
    storage.writeJson(storage.StorageKeys.entitlementsCache, {
      subscription: { status: 'free' },
      usage: {
        importUses: 1,
        aiUses: 5,
        monthKey: new Date().toISOString().slice(0, 7),
        dayKey: new Date().toISOString().slice(0, 10),
      },
      hasActivePass: false,
      source: 'local',
      isAuthenticated: true,
    });
    const [{ createEmptyVault }, engine, { InterviewCheatSheetView }, react, reactDom, entitlements] = await Promise.all([
      import('/src/lib/sampleVault.ts'),
      import('/src/lib/interviewCheatSheetEngine.ts'),
      import('/src/features/matcher/InterviewCheatSheetView.tsx'),
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/store/useEntitlements.ts'),
    ]);
    entitlements.setAuthenticatedEntitlements({ status: 'free' }, {
      importUses: 1,
      aiUses: 5,
      monthKey: new Date().toISOString().slice(0, 7),
      dayKey: new Date().toISOString().slice(0, 10),
    });
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const vault = createEmptyVault('Syntetyczny Kandydat');
    const jobOffer = {
      id: 'synthetic-offer',
      title: 'Support Engineer',
      company: 'Syntetyczna Firma',
      salary: '',
      location: 'Kraków',
      description: 'Obsługa użytkowników, diagnozowanie problemów z pocztą i dokumentowanie rozwiązań.',
    };
    const hash = await engine.hashCheatSheetInput(vault, jobOffer.title, jobOffer.company, jobOffer.description);
    storage.writeJson(storage.cheatSheetCacheKeyFor(hash), {
      hash,
      enrichment: {},
      cachedAt: new Date().toISOString(),
    });
    document.body.innerHTML = '<main id="audit-cheatsheet-cache"></main>';
    createRoot(document.getElementById('audit-cheatsheet-cache')).render(createElement(InterviewCheatSheetView, {
      vault,
      jobOffer,
    }));
  });

  await page.getByText('Szkielet lokalny · 0 tokenów', { exact: true }).waitFor({ state: 'visible' });
  await page.getByText('Wyrażam zgodę na wysłanie wymienionych danych do modelu AI, aby wygenerować tę ściągę.', { exact: true }).click();
  await page.getByRole('button', { name: 'Wzbogać przez AI' }).click();
  await page.waitForTimeout(1500);
  if (generationRequests !== 1 || pageErrors.length > 0) {
    console.log(JSON.stringify({ generationRequests, pageErrors, text: await page.locator('body').innerText() }));
  }
  await page.getByText('Syntetyczny kontekst wzbogacenia.', { exact: true }).waitFor({ state: 'visible' });
  await page.getByText('Wzbogacona przez AI', { exact: true }).waitFor({ state: 'visible' });
  await page.getByText('Wymóg: React', { exact: true }).waitFor({ state: 'visible' });
  await page.getByText('Syntetyczna sytuacja', { exact: true }).waitFor({ state: 'visible' });
  await page.getByText('Syntetyczne działanie', { exact: true }).waitFor({ state: 'visible' });
  await page.getByText('6. Zwroty Ratunkowe', { exact: false }).click();
  await page.getByText('Proszę o chwilę na namysł.', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(generationRequests, 1, 'wadliwy cache powinien zostać odrzucony, a poprawna odpowiedź pobrana');
  assert.deepEqual(pageErrors, [], 'wadliwy cache nie może uszkodzić wyświetlanej ściągi');
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`Ściąga odrzuciła pusty wpis cache i bez błędu użyła poprawnej odpowiedzi. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
