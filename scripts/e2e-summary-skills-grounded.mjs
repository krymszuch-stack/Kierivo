import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUTPUT = 'docs/evidence/summary-skills-grounded-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [React, ReactDOM, { SummaryAssistantModal }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/vault/SummaryAssistantModal.tsx'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const vault = createEmptyVault('Alicja Testowa');
    vault.personalInfo.title = 'Technik wsparcia IT';
    vault.personalInfo.summary = '';
    vault.skillsMatrix.hardSkills = ['Kubernetes', 'Terraform'];
    vault.history = [];
    document.body.innerHTML = '<main id="audit-grounded-summary"></main>';
    createRoot(document.getElementById('audit-grounded-summary')).render(
      createElement(SummaryAssistantModal, { isOpen: true, onClose: () => {}, vault, onSelectSummary: () => {} })
    );
  });

  const panel = page.getByRole('dialog');
  await panel.getByText('Generator Podsumowania Zawodowego (Beztokenowy)', { exact: true }).waitFor({ state: 'visible' });
  await panel.getByText(/W profilu wymieniono kompetencje: Kubernetes oraz Terraform\./).waitFor({ state: 'visible' });
  const renderedText = await panel.innerText();
  assert.doesNotMatch(renderedText, /doświadczenie w bezpośrednim stosowaniu|w codziennej pracy wykorzystuję|doświadczenie zawodowe oparte na znajomości|praktyczna znajomość/i);
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);

  await page.waitForTimeout(350);
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: generator odróżnia umiejętności wpisane w profil od doświadczenia w ich użyciu. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
