/** Potwierdza, że licznik AI wraca do wartości serwera po błędzie modelu. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const SCREENSHOT = 'docs/evidence/ai-quota-resync-2026-10-02.png';
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
  let entitlementRefreshes = 0;
  await page.route('**/api/me', async (route) => {
    entitlementRefreshes += 1;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        subscription: { status: 'free' },
        usage: { aiUses: 5, importUses: 1, monthKey: '2026-10', dayKey: '2026-10-02' },
      }),
    });
  });
  await page.route('**/api/ai/verify-cv', async (route) => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Model testowo niedostępny', requestId: 'synthetic-request' }),
    });
  });
  await page.route('**/api/ai/coach-star/generate-questions', async (route) => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Model testowo niedostępny', requestId: 'synthetic-star' }),
    });
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    document.body.replaceChildren();
    Object.assign(document.body.style, { margin: '0', minHeight: '100vh', background: 'var(--color-app-bg)' });
    const React = await import('/node_modules/.vite/deps/react.js');
    const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const { clientEnv } = await import('/src/lib/clientEnv.ts');
    Object.defineProperty(clientEnv, 'backendConfigured', { value: true, configurable: true });
    const { setAuthenticatedEntitlements } = await import('/src/store/useEntitlements.ts');
    const { Cv360VerifierModal } = await import('/src/features/matcher/Cv360VerifierModal.tsx');
    setAuthenticatedEntitlements({ status: 'free' }, {
      aiUses: 5, importUses: 1, monthKey: '2026-10', dayKey: '2026-10-02',
    });
    const vault = {
      version: '1', updatedAt: '2026-10-02T00:00:00.000Z',
      personalInfo: { fullName: 'Jan Testowy', title: 'Technik wsparcia', summary: 'Diagnoza usterek i obsługa zgłoszeń.' },
      skillsMatrix: { hardSkills: ['Troubleshooting'], toolsAndTech: ['Windows'], softSkills: [], certifications: [] },
      history: [{ id: 'synthetic-job', company: 'Firma Testowa', role: 'Technik wsparcia', startDate: '2022-01', endDate: '2025-01', description: 'Diagnoza zgłoszeń użytkowników.' }],
      education: [], projects: [],
      profiler: { flags: [], experienceLevel: 'MID', location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false }, languages: [] },
    };
    const host = document.createElement('div');
    host.id = 'cv360-quota-resync-proof';
    document.body.append(host);
    window.__quotaProofVault = vault;
    window.__quotaProofRoot = createRoot(host);
    window.__quotaProofRoot.render(createElement(Cv360VerifierModal, {
      isOpen: true, onClose: () => undefined, vault,
      targetRole: 'Technik wsparcia', targetCompany: 'Firma testowa',
      currentUser: { id: 'synthetic-owner' },
    }));
  });

  const dialog = page.locator('.fixed.inset-0');
  await dialog.waitFor();
  const cvQuotaBadge = (remaining) => dialog.getByRole('button').filter({ hasText: `${remaining}/25` }).first();
  await cvQuotaBadge(5).waitFor({ state: 'visible' });
  const cvRefreshesBefore = entitlementRefreshes;
  const checkbox = dialog.getByRole('checkbox');
  await checkbox.check();
  await dialog.getByRole('button', { name: /Uruchom analizę profilu AI/i }).click();
  await dialog.getByText('Model testowo niedostępny').waitFor();
  await cvQuotaBadge(4).waitFor({ state: 'visible' });
  await cvQuotaBadge(5).waitFor({ state: 'visible' });
  assert.equal(entitlementRefreshes - cvRefreshesBefore, 1, 'po odpowiedzi AI musi nastąpić jedno odświeżenie stanu z /api/me');
  assert.equal(await cvQuotaBadge(4).count(), 0, 'licznik nie może pozostać przy lokalnie odjętej próbie');

  mkdirSync('docs/evidence', { recursive: true });
  await dialog.screenshot({ path: SCREENSHOT });

  await page.evaluate(async () => {
    window.__quotaProofRoot.unmount();
    document.body.replaceChildren();
    const React = await import('/node_modules/.vite/deps/react.js');
    const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const { clientEnv } = await import('/src/lib/clientEnv.ts');
    Object.defineProperty(clientEnv, 'backendConfigured', { value: true, configurable: true });
    const { setAuthenticatedEntitlements } = await import('/src/store/useEntitlements.ts');
    const { StarCoachSection } = await import('/src/features/cockpit/StarCoachSection.tsx');
    setAuthenticatedEntitlements({ status: 'free' }, {
      aiUses: 5, importUses: 1, monthKey: '2026-10', dayKey: '2026-10-02',
    });
    const host = document.createElement('div');
    host.id = 'quota-proof-star';
    document.body.append(host);
    window.__quotaProofRoot = createRoot(host);
    window.__quotaProofRoot.render(createElement(StarCoachSection, { vault: window.__quotaProofVault }));
  });
  const starHost = page.locator('#quota-proof-star');
  const starConsent = starHost.getByText(/dostawc.+AI skonfigurowan.+Azure OpenAI albo Ollama/i);
  await starConsent.waitFor({ state: 'visible' });
  assert.equal(await starConsent.count(), 1, 'zgoda opisuje dostawców obsługiwanych przez konfigurację zamiast przypisywać Azure na sztywno');
  const starQuotaBadge = (remaining) => starHost.getByRole('button').filter({ hasText: `${remaining}/25` }).first();
  await starQuotaBadge(5).waitFor({ state: 'visible' });
  const starRefreshesBefore = entitlementRefreshes;
  await starHost.getByRole('checkbox').check();
  await starHost.getByRole('button', { name: /Generuj nowe pytania \(AI\)/ }).click();
  await starHost.getByText('Model testowo niedostępny').waitFor();
  await starQuotaBadge(4).waitFor({ state: 'visible' });
  await starQuotaBadge(5).waitFor({ state: 'visible' });
  assert.equal(entitlementRefreshes - starRefreshesBefore, 1, 'Trener STAR musi odświeżyć licznik po błędzie modelu');
  await starHost.screenshot({ path: 'docs/evidence/ai-quota-resync-star-2026-10-02.png' });

  console.log(`PASS: CV360 i Trener STAR odświeżają licznik po błędzie modelu; zrzuty zapisane w docs/evidence/.`);
} finally {
  await browser.close();
}
