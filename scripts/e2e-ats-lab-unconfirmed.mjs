import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/ats-lab-unconfirmed-preliminary-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const evidence = await page.evaluate(async () => {
    const [react, reactDom, { AtsLabView }, { createEmptyVault }, { scoreCanonicalAts, hasCareerEvidence }, { measureVaultCompleteness }, { simulateMultiEngineATS }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/ats/AtsLabView.tsx'),
      import('/src/lib/sampleVault.ts'),
      import('/src/lib/canonicalAts.ts'),
      import('/src/lib/vaultCompleteness.ts'),
      import('/src/lib/atsSimulator.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.invalid');
    vault.personalInfo.title = 'Specjalista wsparcia IT';
    vault.personalInfo.summary = 'Do\u015bwiadczony specjalista IT: obs\u0142uga u\u017cytkownik\u00f3w, rozwi\u0105zywanie problem\u00f3w i administracja systemami.';
    vault.skillsMatrix.hardSkills = ['Python', 'Linux', 'AWS'];
    vault.skillsMatrix.toolsAndTech = ['Freshservice'];
    vault.profiler.licenses = ['fgas'];
    vault.profiler.location.city = 'Warszawa';
    vault.education = [{
      id: 'synthetic-education', institution: 'Uczelnia testowa', degree: 'Licencjat',
      fieldOfStudy: 'Informatyka', startDate: '2017', endDate: '2020',
    }];
    vault.projects = [{
      id: 'synthetic-support-project', name: 'Automatyzacja wsparcia', role: 'Administrator',
      description: 'Usprawni\u0142em obs\u0142ug\u0119 powtarzalnych zg\u0142osze\u0144 IT.', techStack: ['Python'],
    }];
    vault.history = [{
      id: 'synthetic-support-role',
      company: 'Firma testowa',
      role: 'Specjalista wsparcia IT',
      location: '',
      startDate: '2021-01',
      endDate: '2025-01',
      isCurrent: false,
      description: 'Rozwi\u0105zywa\u0142em problemy system\u00f3w Linux oraz wspiera\u0142em u\u017cytkownik\u00f3w.',
      highlights: [{
        id: 'synthetic-support-highlight',
        text: 'Rozwi\u0105zywa\u0142em problemy Linux i wspiera\u0142em u\u017cytkownik\u00f3w.',
        action: '', target: '', tool: '', metric: '', keywords: [],
      }],
    }];
    const jobOfferText = 'Support Engineer\nWymagania: Python, Linux, AWS.\nWymagany aktualny certyfikat F-Gaz.';
    const canonical = scoreCanonicalAts(vault, jobOfferText, vault.personalInfo.title);
    const profileCoverage = measureVaultCompleteness(vault).percent;
    const careerEvidenceAvailable = hasCareerEvidence(vault);
    const careerFitAssessment = simulateMultiEngineATS(vault, jobOfferText, vault.personalInfo.title).careerFitAdvice.assessment;
    document.body.innerHTML = '<main id="audit-ats-lab" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-ats-lab')).render(createElement(AtsLabView, {
      profileId: 'synthetic-unconfirmed-credential',
      vault,
      targetRole: vault.personalInfo.title,
      jobOfferText,
    }));
    return {
      state: canonical.state,
      matched: canonical.matchedRequirements.length,
      missing: canonical.missingRequirements.length,
      unconfirmed: canonical.unconfirmedRequirements,
      profileCoverage,
      careerEvidenceAvailable,
      careerFitAssessment,
    };
  });

  assert.equal(evidence.state, 'SCORABLE');
  assert.ok(evidence.unconfirmed.length > 0, 'syntetyczna oferta powinna pozostawi\u0107 aktualno\u015b\u0107 certyfikatu niepotwierdzon\u0105');
  assert.ok(evidence.matched + evidence.missing >= 3, 'oferta powinna zawiera\u0107 co najmniej trzy rozstrzygni\u0119te wymogi');
  assert.ok(evidence.profileCoverage >= 50, `pokrycie profilu musi izolowa\u0107 wp\u0142yw wymogu UNKNOWN: ${evidence.profileCoverage}%`);
  assert.equal(evidence.careerEvidenceAvailable, true);
  assert.notEqual(evidence.careerFitAssessment, 'INSUFFICIENT_EVIDENCE');

  const lab = page.locator('#audit-ats-lab');
  await lab.getByText(/Wynik wst\u0119pny/).waitFor({ state: 'visible' });
  await lab.getByText(/Nie mo\u017cna potwierdzi\u0107:/).waitFor({ state: 'visible' });
  await lab.getByText(/Do potwierdzenia:/).waitFor({ state: 'visible' });
  const screenText = await lab.innerText();
  assert.doesNotMatch(screenText, /Wysokie dopasowanie|Umiarkowane dopasowanie/);
  await mkdir('docs/evidence', { recursive: true });
  await lab.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`AtsLabView oznacza wynik jako wstepny przy niepotwierdzonym wymogu. Zrzut: ${OUTPUT}. Dowody: ${JSON.stringify(evidence)}`);
} finally {
  await browser.close();
}
