/** Potwierdza zachowanie niepewnego wymogu stażu od kanonu do archiwum aplikacji. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/ats-score-unknown-experience-2026-10-02.png';
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
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const evidence = await page.evaluate(async () => {
    const { CANONICAL_ATS_SCORE_PROVENANCE } = await import('/src/types/index.ts');
    const [React, ReactDOM, { HistoricalDocumentModal }, { createEmptyVault }, { scoreCanonicalAts },
      { getAtsScoreContext }, { measureVaultCompleteness }, { hasCareerEvidence }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/tracker/HistoricalDocumentModal.tsx'),
      import('/src/lib/sampleVault.ts'),
      import('/src/lib/canonicalAts.ts'),
      import('/src/lib/atsScoreEvidence.ts'),
      import('/src/lib/vaultCompleteness.ts'),
      import('/src/lib/careerEvidence.ts'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
    vault.personalInfo.summary = 'Wsparcie techniczne i rozwiązywanie problemów użytkowników.';
    vault.skillsMatrix.hardSkills = ['Python', 'AWS', 'Docker'];
    vault.history = [{
      id: 'synthetic-unknown-tenure',
      company: 'Firma testowa', role: 'Specjalista wsparcia', location: '',
      startDate: '', endDate: '', isCurrent: false,
      description: 'Obsługa systemów i rozwiązywanie problemów technicznych.', highlights: [],
    }];
    const jobDescription = 'Wymagania:\n- Python\n- AWS\n- Docker\n- Minimum 3 years of experience.';
    const result = scoreCanonicalAts(vault, jobDescription, 'Specjalista wsparcia');
    const context = getAtsScoreContext(
      result,
      measureVaultCompleteness(vault).percent,
      hasCareerEvidence(vault),
    );
    const application = {
      id: 'synthetic-unknown-experience',
      company: 'Firma testowa',
      position: 'Specjalista wsparcia',
      date: '2026-10-02',
      status: 'Wysłana',
      atsScore: result.score,
      atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE,
      atsScoreContext: context,
    };
    document.body.innerHTML = '<main id="audit-preview"></main>';
    createRoot(document.getElementById('audit-preview')).render(
      createElement(HistoricalDocumentModal, {
        application,
        isOpen: true,
        onClose: () => undefined,
      })
    );
    return {
      state: result.state,
      score: result.score,
      unconfirmed: result.unconfirmedRequirements,
      context,
    };
  });

  await page.getByText(/Wstępny wynik — wymagania do potwierdzenia/).waitFor();
  await page.getByText(/1 wymóg wymaga potwierdzenia/).waitFor();
  const text = await page.locator('body').innerText();
  assert.equal(evidence.state, 'SCORABLE');
  assert.ok(evidence.score !== null);
  assert.ok(evidence.unconfirmed.some((item) => item.includes('3 lata doświadczenia')));
  assert.equal(evidence.context.unconfirmedBlockingRequirementCount, 0);
  assert.equal(evidence.context.unconfirmedRequirementCount, 1);
  assert.equal(evidence.context.scoreContextVersion, 5);
  assert.match(text, /Nie uznajemy ich za spełnione ani za niespełnione/);
  assert.doesNotMatch(text, /Wynik Kierivo:/);
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  await page.waitForTimeout(300);
  await page.getByRole('dialog').screenshot({ path: OUTPUT });
  console.log(`PASS: niepotwierdzony staż ogranicza zapisany wynik; zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
