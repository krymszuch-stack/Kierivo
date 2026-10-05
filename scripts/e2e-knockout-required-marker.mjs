import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/knockout-required-plural-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const [react, reactDom, { AtsSimulatorView }, { createEmptyVault }, { simulateAtsCheck },
      { scoreCanonicalAts }, { measureVaultCompleteness }, { hasCareerEvidence }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/matcher/AtsSimulatorView.tsx'),
      import('/src/lib/sampleVault.ts'),
      import('/src/lib/atsSimulator.ts'),
      import('/src/lib/canonicalAts.ts'),
      import('/src/lib/vaultCompleteness.ts'),
      import('/src/lib/careerEvidence.ts'),
    ]);
    const jd = 'Pracodawcy wymagają uprawnień SEP G1 do 1 kV przy serwisie instalacji. Wymagane doświadczenie w serwisie technicznym i diagnozowaniu usterek.';
    const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
    vault.personalInfo.summary = 'Doświadczenie zawodowe w serwisie technicznym, diagnozowaniu usterek i obsłudze klientów.';
    vault.skillsMatrix.hardSkills = ['serwis techniczny', 'diagnozowanie usterek'];
    const resume = {
      targetJobTitle: 'Technik serwisu', companyName: '', summary: vault.personalInfo.summary,
      selectedHighlights: [],
      skillsMatched: { hardSkills: vault.skillsMatrix.hardSkills, toolsAndTech: [], softSkills: [] },
      atsScore: null,
    };
    const legacy = simulateAtsCheck(resume, vault, jd);
    const canonical = scoreCanonicalAts(vault, jd, 'Technik serwisu');
    const finding = canonical.formalFindings.find((item) => item.label.includes('SEP G1'));
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
      canonicalState: canonical.state,
      formalFinding: finding && { severity: finding.severity, status: finding.status },
      blocking: canonical.formalFindings.filter((item) => item.severity === 'knockout').map((item) => item.label),
      missingRequirements: canonical.missingRequirements,
    };
  });

  await page.locator('#audit-preview').waitFor({ state: 'visible' });
  await page.waitForTimeout(1000);
  const text = await page.locator('#audit-preview').innerText();
  if (result.canonicalState !== 'SCORABLE' || result.formalFinding?.severity !== 'knockout' ||
      result.formalFinding?.status !== 'unsatisfied' ||
      !result.blocking.some((item) => item.includes('SEP G1')) ||
      !result.missingRequirements.some((item) => item.includes('SEP G1')) ||
      !/Wymóg:.*SEP G1/.test(text) || /Nie wykryto braków w wymaganiach/.test(text)) {
    throw new Error(`Jawny wymóg SEP G1 nie trafił do widocznej listy braków: ${JSON.stringify({ result, text })}`);
  }
  if (pageErrors.length) throw new Error(`Błędy strony: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#audit-preview').screenshot({ path: OUTPUT, fullPage: true });
  console.log(`OK: „wymagają” tworzy jawny brak SEP G1; zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
