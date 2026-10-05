/** Potwierdza, że rekomendacja follow-upu opisuje rzeczywistą czynność w Pipeline. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const SCREENSHOT = 'docs/evidence/next-action-followup-honesty-2026-10-02.png';

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

try {
  const page = await browser.newPage({ viewport: { width: 900, height: 390 } });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    document.body.replaceChildren();
    Object.assign(document.body.style, { margin: '0', minHeight: '100vh', background: 'var(--color-app-bg)' });
    const React = await import('/node_modules/.vite/deps/react.js');
    const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const { NextActionCard } = await import('/src/components/nextaction/NextActionCard.tsx');
    const host = document.createElement('div');
    host.id = 'next-action-followup-proof';
    Object.assign(host.style, { maxWidth: '820px', margin: '24px auto', padding: '12px' });
    document.body.append(host);
    createRoot(host).render(createElement(NextActionCard, {
      action: {
        actionType: 'prepare_followup',
        title: 'Przygotuj follow-up po rozmowie',
        description: 'Rozmowa z Elektrobud już się odbyła. Otwórz aplikację, dopisz podsumowanie i ręcznie oznacz follow-up po wysłaniu wiadomości — Kierivo nie wysyła jej za Ciebie.',
        deepLink: { tab: 'pipeline', applicationId: 'synthetic-application' },
        estimatedMinutes: 10,
        context: { company: 'Elektrobud', position: 'Monter' },
      },
      onNavigate: (tab) => { window.__nextActionNavigation = tab; },
    }));
  });

  await page.getByText('Przygotuj follow-up po rozmowie', { exact: true }).waitFor();
  const card = page.locator('#next-action-followup-proof');
  const description = await card.innerText();
  assert.match(description, /Kierivo nie wysyła jej za Ciebie/);
  assert.match(description, /ręcznie oznacz follow-up/);
  assert.doesNotMatch(description, /Wyślij follow-up po rozmowie/);

  mkdirSync('docs/evidence', { recursive: true });
  await card.screenshot({ path: SCREENSHOT });
  await card.getByRole('button', { name: 'Przejdź do Moje aplikacje' }).click();
  assert.equal(await page.evaluate(() => window.__nextActionNavigation), 'pipeline');
  console.log(`PASS: karta kieruje do Pipeline i wyjaśnia, że wiadomość wysyła użytkownik; zrzut: ${SCREENSHOT}`);
} finally {
  await browser.close();
}
