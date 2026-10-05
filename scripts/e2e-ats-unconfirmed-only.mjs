/** Potwierdza ekran dla oferty, w której jedyny wykryty wymóg wymaga danych o aktualności. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/ats-unconfirmed-only-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 880 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const [react, reactDom, { AtsSimulatorView }, { createEmptyVault }, { simulateAtsCheck }, { scoreCanonicalAts }, { measureVaultCompleteness }, { hasCareerEvidence }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/matcher/AtsSimulatorView.tsx'),
      import('/src/lib/sampleVault.ts'),
      import('/src/lib/atsSimulator.ts'),
      import('/src/lib/canonicalAts.ts'),
      import('/src/lib/vaultCompleteness.ts'),
      import('/src/lib/careerEvidence.ts'),
    ]);
    const jd = 'Wymagania: aktualny certyfikat F-Gaz.';
    const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
    vault.personalInfo.summary = 'Pracownik techniczny z doświadczeniem w serwisie urządzeń.';
    vault.profiler.licenses = ['fgas'];
    const resume = {
      targetJobTitle: 'Technik serwisu', companyName: '', summary: vault.personalInfo.summary,
      selectedHighlights: [], skillsMatched: { hardSkills: [], toolsAndTech: [], softSkills: [] }, atsScore: null,
    };
    const legacy = simulateAtsCheck(resume, vault, jd);
    const canonical = scoreCanonicalAts(vault, jd, 'Technik serwisu');
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 1060px; margin: 24px auto; padding: 16px"></main>';
    createRoot(document.getElementById('audit-preview')).render(
      createElement(AtsSimulatorView, {
        result: legacy,
        canonicalResult: canonical,
        profileCompleteness: measureVaultCompleteness(vault).percent,
        careerEvidenceAvailable: hasCareerEvidence(vault),
      })
    );
    return {
      state: canonical.state,
      score: canonical.score,
      unconfirmed: canonical.unconfirmedRequirements,
      keywordCoverage: legacy.keywordCoverageScore,
      hardSkillsCoverage: legacy.layer2Nlp.hardSkillsCoverage,
      formalCoverage: legacy.layer2Nlp.formalReqsCoverage,
    };
  });

  await page.getByText('Wymogi wymagają potwierdzenia').waitFor();
  const text = await page.locator('#audit-preview').innerText();
  assert.equal(result.state, 'UNCONFIRMED_REQUIREMENTS');
  assert.equal(result.score, null);
  assert.ok(result.unconfirmed.some((item) => item.includes('F-Gaz')));
  assert.equal(result.keywordCoverage, null);
  assert.equal(result.hardSkillsCoverage, null);
  assert.equal(result.formalCoverage, null);
  assert.match(text, /Nie można potwierdzić wymogów z oferty:.*F-Gaz/);
  assert.doesNotMatch(text, /Brak wykrytych wymagań|nie wykryto wymagań/i);
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#audit-preview').screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: wymóg F-Gaz wymaga potwierdzenia, nie jest błędnie opisany jako brak wymagań; zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
