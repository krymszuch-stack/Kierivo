/** Potwierdza walidacje formularza wsparcia bez uruchamiania programu pocztowego. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const SCREENSHOT = 'docs/evidence/support-email-validation-2026-10-02.png';

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
  const page = await browser.newPage({ viewport: { width: 850, height: 700 } });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    document.body.replaceChildren();
    Object.assign(document.body.style, { margin: '0', minHeight: '100vh', background: 'var(--color-app-bg)' });
    const React = await import('/node_modules/.vite/deps/react.js');
    const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const { SupportContactModal } = await import('/src/components/legal/SupportContactModal.tsx');
    const host = document.createElement('div');
    host.id = 'support-email-validation-proof';
    document.body.append(host);
    createRoot(host).render(createElement(SupportContactModal, {
      isOpen: true,
      onClose: () => undefined,
      defaultCategory: 'problem',
    }));
  });

  const email = page.getByLabel('Twój adres e-mail (opcjonalnie do odpowiedzi)');
  const message = page.getByLabel('Treść wiadomości / Opis zgłoszenia');
  const draft = page.locator('[role="dialog"] a').filter({ hasText: 'Otwórz szkic wiadomości' });
  await message.fill('Nie mogę wyeksportować CV.');
  await email.fill('to-nie-jest-adres');
  await page.getByRole('alert').getByText('Podaj poprawny adres e-mail lub pozostaw pole puste.').waitFor();
  assert.equal(await email.getAttribute('aria-invalid'), 'true');
  assert.equal(await draft.getAttribute('href'), null);

  mkdirSync('docs/evidence', { recursive: true });
  await page.locator('[role="dialog"]').screenshot({ path: SCREENSHOT });

  await email.fill('ala@example.test');
  assert.equal(await email.getAttribute('aria-invalid'), 'false');
  assert.match(await draft.getAttribute('href') || '', /^mailto:pomoc@kierivo\.com\?/);
  await message.fill('   ');
  assert.equal(await draft.getAttribute('href'), null);
  console.log(`PASS: błędny adres i pusta treść blokują szkic, poprawny adres tworzy mailto; zrzut: ${SCREENSHOT}`);
} finally {
  await browser.close();
}
