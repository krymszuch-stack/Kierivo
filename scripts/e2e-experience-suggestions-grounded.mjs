import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUTPUT = 'docs/evidence/experience-suggestions-grounded-2026-10-02.png';
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
    const [React, ReactDOM, { ExperienceWizardModal }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/vault/ExperienceWizardModal.tsx'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    document.body.innerHTML = '<main id="audit-experience-suggestions"></main>';
    createRoot(document.getElementById('audit-experience-suggestions')).render(
      createElement(ExperienceWizardModal, {
        isOpen: true,
        onClose: () => {},
        roleTitle: 'DevOps Engineer',
        userSkills: [],
        onApplyDescription: () => {},
      })
    );
  });

  const dialog = page.getByRole('dialog', { name: /Mikro-Wywiad Doświadczenia/ });
  await dialog.waitFor({ state: 'visible' });
  for (let step = 0; step < 2; step += 1) {
    await dialog.getByRole('button', { name: 'Dalej', exact: true }).click();
  }
  await dialog.getByRole('button', { name: /automatyczne potoki wdrożeniowe CI\/CD/ }).click();
  await dialog.getByRole('button', { name: 'Dalej', exact: true }).click();
  await dialog.getByText(/Podpowiedzi branżowe nie pochodzą z Twojego profilu/).waitFor();
  await dialog.getByRole('button', { name: 'Dalej', exact: true }).click();

  await dialog.getByText(/To przykłady sposobu opisania pracy, nie osiągnięcia z Twojego profilu/).waitFor();
  const visibleText = await dialog.innerText();
  assert.doesNotMatch(visibleText, /99\.9%|100%|95%|115%|zero[-\s]downtime/i);
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);

  await page.waitForTimeout(350);
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: sugestie nie zawierają gotowych metryk, a UI oznacza je jako przykłady spoza profilu. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
