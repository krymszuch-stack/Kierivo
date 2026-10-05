import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/ats-electrical-requirements-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const evidence = await page.evaluate(async () => {
    const [React, ReactDOM, { AtsSimulatorView }, { createEmptyVault }, { scoreCanonicalAts },
      { simulateAtsCheck }, { measureVaultCompleteness }, { hasCareerEvidence }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/matcher/AtsSimulatorView.tsx'),
      import('/src/lib/sampleVault.ts'),
      import('/src/lib/canonicalAts.ts'),
      import('/src/lib/atsSimulator.ts'),
      import('/src/lib/vaultCompleteness.ts'),
      import('/src/lib/careerEvidence.ts'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const vault = createEmptyVault('Jan Elektryk Testowy', 'jan@example.invalid');
    vault.profiler.licenses = ['sep_g1_e_1kv'];
    vault.personalInfo.title = 'Elektryk instalator';
    vault.personalInfo.summary = 'Elektromonter z doświadczeniem w montażu instalacji elektrycznych oraz pomiarach ochronnych.';
    vault.skillsMatrix.hardSkills = [
      'Instalacje elektryczne',
      'Montaż rozdzielnic elektrycznych',
      'Pomiary elektryczne ochronne',
    ];
    vault.skillsMatrix.certifications = [{
      id: 'synthetic-sep',
      name: 'Świadectwo kwalifikacyjne SEP E+D do 1 kV z pomiarami',
      issuer: 'Jednostka testowa',
      date: '2024-01-01',
    }];
    vault.history = [{
      id: 'synthetic-electrician',
      company: 'Firma testowa', role: 'Elektromonter', location: '',
      startDate: '2020-01', endDate: '2025-01', isCurrent: false,
      description: 'Prefabrykowałem i podłączałem rozdzielnice elektryczne oraz wykonywałem pomiary ochronne.',
      highlights: [],
    }];
    const jobOfferText = 'Szukamy elektryka do prac montażowych. Wymagania: montaż instalacji elektrycznych, uprawnienia SEP do 1kV, podłączanie rozdzielnic elektrycznych, pomiary ochronne, czytanie projektów elektrycznych.';
    const canonicalResult = scoreCanonicalAts(vault, jobOfferText, vault.personalInfo.title);
    const resume = {
      targetJobTitle: vault.personalInfo.title,
      companyName: '',
      summary: vault.personalInfo.summary,
      selectedHighlights: [],
      skillsMatched: {
        hardSkills: [...vault.skillsMatrix.hardSkills],
        toolsAndTech: [...vault.skillsMatrix.toolsAndTech],
        softSkills: [...vault.skillsMatrix.softSkills],
      },
      atsScore: 0,
    };
    const atsResult = simulateAtsCheck(resume, vault, jobOfferText);
    document.body.innerHTML = '<main id="audit-electrical" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-electrical')).render(createElement(AtsSimulatorView, {
      result: atsResult,
      canonicalResult,
      profileCompleteness: measureVaultCompleteness(vault).percent,
      careerEvidenceAvailable: hasCareerEvidence(vault),
    }));
    return {
      state: canonicalResult.state,
      score: canonicalResult.score,
      skills: canonicalResult.components.skills,
      matched: canonicalResult.matchedRequirements,
      missing: canonicalResult.missingRequirements,
      unconfirmed: canonicalResult.unconfirmedRequirements,
    };
  });

  assert.equal(evidence.state, 'SCORABLE');
  assert.equal(evidence.skills, 75);
  assert.ok(evidence.score !== null);
  assert.ok(evidence.matched.some((item) => item.includes('rozdzielnic')));
  assert.ok(evidence.matched.some((item) => item.includes('pomiary')));
  assert.ok(evidence.matched.some((item) => item.toLowerCase().includes('sep')));
  assert.ok(evidence.missing.some((item) => item.includes('czytanie projektów elektrycznych')));
  assert.ok(!evidence.missing.some((item) => item.toLowerCase().includes('sep')));
  assert.equal(evidence.unconfirmed.length, 0);

  const panel = page.locator('#audit-electrical');
  await panel.getByText('Wynik analizy Kierivo').waitFor({ state: 'visible' });
  await panel.getByText('Umiejętności (40%)').waitFor({ state: 'visible' });
  await panel.getByText('75%', { exact: true }).first().waitFor({ state: 'visible' });
  await panel.getByText(/Czytanie projektów elektrycznych/i).first().waitFor({ state: 'visible' });
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  await panel.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: rzeczywisty AtsSimulatorView pokazuje 75% potwierdzonych umiejętności oraz brak czytania projektów; wynik: ${evidence.score}; zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
