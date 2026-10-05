import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/cover-letter-profile-only-2026-10-02.png';
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
    const [React, ReactDOM, { CoverLetterView }, { generateAntiTemplateCoverLetter }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/matcher/CoverLetterView.tsx'),
      import('/src/lib/coverLetterEngine.ts'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const vault = createEmptyVault('', '');
    vault.personalInfo.title = '';
    vault.personalInfo.summary = '';
    vault.skillsMatrix.hardSkills = [];
    vault.skillsMatrix.toolsAndTech = [];
    vault.history = [];
    vault.projects = [];
    const jobOffer = { title: 'Tester', company: 'Firma testowa', description: 'Oferta testowa' };
    const coverLetter = generateAntiTemplateCoverLetter(jobOffer.title, jobOffer.company, jobOffer.description, vault, 0);
    document.body.innerHTML = '<main id="audit-cover-letter" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-cover-letter')).render(
      createElement(CoverLetterView, { coverLetter, vault, jobOffer }),
    );
  });

  const panel = page.locator('#audit-cover-letter');
  await panel.getByText(/Treść odzwierciedla wpisy w MasterVault/i).waitFor({ state: 'visible' });
  await panel.getByText('1. Wstęp').waitFor({ state: 'visible' });
  const renderedText = await panel.innerText();
    assert.doesNotMatch(renderedText, /specjalista z praktyką|biegłość|udokumentowanym doświadczeniem|wdrożeniami|od lat|bezbłędnie|natychmiast|wymierne rezultaty|case studies/i);
    assert.doesNotMatch(renderedText, /\nKandydat(?:\n|$)/);
  assert.equal(renderedText.includes('Wpisy z profilu'), true);
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  await panel.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: pusty profil nie dopisuje doświadczenia ani zastępczego kandydata. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
