/** Sprawdza, że opóźniona odpowiedź poprzedniego konta nie nadpisze limitów nowego. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const SCREENSHOT = 'docs/evidence/entitlement-refresh-account-switch-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

let releaseFirstResponse;
const firstResponseGate = new Promise((resolve) => { releaseFirstResponse = resolve; });
let markFirstRequestSeen;
const firstRequestSeen = new Promise((resolve) => { markFirstRequestSeen = resolve; });

try {
  const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
  let requestCount = 0;
  await page.route('**/api/me', async (route) => {
    requestCount += 1;
    const requestNumber = requestCount;
    if (requestNumber === 1) markFirstRequestSeen();
    if (requestNumber === 1) await firstResponseGate;
    const aiUses = requestNumber === 1 ? 1 : 7;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        subscription: { status: 'free' },
        usage: { aiUses, importUses: 1, monthKey: '2026-10', dayKey: '2026-10-02' },
      }),
    });
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    document.body.replaceChildren();
    document.body.style.cssText = 'font: 16px sans-serif; margin: 0; padding: 40px; min-height: 100vh; box-sizing: border-box; background: #121214; color: #f5f5f5';
    const React = await import('/node_modules/.vite/deps/react.js');
    const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const { useEntitlements, setAuthenticatedEntitlements, resetEntitlementsToUnauthenticated } =
      await import('/src/store/useEntitlements.ts');
    const { clientEnv } = await import('/src/lib/clientEnv.ts');
    // Kontrolowany harness musi uruchomić ten sam request także bez lokalnego Supabase.
    clientEnv.backendConfigured = true;

    function RefreshProbe() {
      const { refresh, usage } = useEntitlements();
      return createElement('main', { style: { maxWidth: '640px', margin: '32px auto', padding: '32px', border: '1px solid #34343a', borderRadius: '16px', background: '#1a1a1e' } },
        createElement('p', { style: { color: '#f59e0b', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' } }, 'Test regresyjny · syntetyczne API'),
        createElement('h1', { style: { fontSize: '26px', margin: '0 0 16px' } }, 'Zmiana konta chroni nowy stan'),
        createElement('p', { 'data-testid': 'ai-uses', style: { padding: '20px', background: '#242429', borderRadius: '12px', fontSize: '20px', fontWeight: 600 } }, `Pozostało prób AI: ${usage.aiUses}`),
        createElement('div', { style: { display: 'flex', gap: '12px' } },
          createElement('button', { onClick: () => { void refresh(); }, style: { padding: '12px 16px', borderRadius: '8px', border: '1px solid #4b4b54', background: '#242429', color: 'inherit', cursor: 'pointer' } }, 'Odśwież konto A'),
          createElement('button', {
            onClick: () => {
              resetEntitlementsToUnauthenticated();
              void refresh();
            },
            style: { padding: '12px 16px', borderRadius: '8px', border: '0', background: '#f59e0b', color: '#171717', fontWeight: 700, cursor: 'pointer' },
          }, 'Przełącz na konto B'),
        ),
        createElement('p', { id: 'proof-note', style: { marginTop: '20px', color: '#a1a1aa' } }, 'Odpowiedź A jest opóźniona.'),
      );
    }

    setAuthenticatedEntitlements({ status: 'free' }, {
      aiUses: 3, importUses: 1, monthKey: '2026-10', dayKey: '2026-10-02',
    });
    const host = document.createElement('div');
    document.body.append(host);
    window.__proofRoot = createRoot(host);
    window.__proofRoot.render(createElement(RefreshProbe));
  });

  await page.getByText('Pozostało prób AI: 3').waitFor();
  await page.getByRole('button', { name: 'Odśwież konto A' }).click();
  await firstRequestSeen;
  assert.equal(requestCount, 1, 'żądanie konta A powinno pozostać w toku');

  await page.getByRole('button', { name: 'Przełącz na konto B' }).click();
  await page.getByText('Pozostało prób AI: 7').waitFor();
  assert.equal(requestCount, 2, 'po przełączeniu powinno ruszyć odświeżenie konta B');

  releaseFirstResponse();
  await page.waitForTimeout(150);
  assert.equal(await page.getByTestId('ai-uses').innerText(), 'Pozostało prób AI: 7',
    'spóźniona odpowiedź konta A nie może nadpisać limitu konta B');
  await page.locator('#proof-note').evaluate((node) => {
    node.textContent = 'Odpowiedź A wróciła po B i została pominięta. Stan konta B pozostał bez zmian.';
  });

  mkdirSync('docs/evidence', { recursive: true });
  await page.screenshot({ path: SCREENSHOT });
  await page.evaluate(() => window.__proofRoot.unmount());
  console.log(`PASS: opóźnione konto A nie nadpisało stanu konta B; zrzut: ${SCREENSHOT}`);
} finally {
  releaseFirstResponse();
  await browser.close();
}
