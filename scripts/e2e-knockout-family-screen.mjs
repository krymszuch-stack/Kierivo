import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/knockout-families-screen-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const [react, reactDom, { AtsSimulatorView }, { createEmptyVault }, { simulateAtsCheck },
      { scoreCanonicalAts }, { measureVaultCompleteness }, { hasCareerEvidence }, { auditKnockouts },
      { qualificationCases }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/matcher/AtsSimulatorView.tsx'),
      import('/src/lib/sampleVault.ts'),
      import('/src/lib/atsSimulator.ts'),
      import('/src/lib/canonicalAts.ts'),
      import('/src/lib/vaultCompleteness.ts'),
      import('/src/lib/careerEvidence.ts'),
      import('/src/lib/knockouts.ts'),
      import('/src/lib/__tests__/knockoutQualificationCases.ts'),
    ]);
    const jd = qualificationCases.map(([, requirement]) => `Wymagane ${requirement}.`).join('\n');
    const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
    vault.personalInfo.summary = 'Doswiadczenie zawodowe w serwisie technicznym, diagnozowaniu usterek i obsludze klientow.';
    vault.skillsMatrix.hardSkills = ['serwis techniczny', 'diagnozowanie usterek'];
    const resume = {
      targetJobTitle: 'Technik serwisu', companyName: '', summary: vault.personalInfo.summary,
      selectedHighlights: [],
      skillsMatched: { hardSkills: vault.skillsMatrix.hardSkills, toolsAndTech: [], softSkills: [] },
      atsScore: null,
    };
    const legacy = simulateAtsCheck(resume, vault, jd);
    const canonical = scoreCanonicalAts(vault, jd, 'Technik serwisu');
    const knockoutReport = auditKnockouts(jd, vault);
    const expectedRuleIds = qualificationCases.map(([, , , , ruleId]) => ruleId);
    const blockingRuleIds = knockoutReport.blocking.map((item) => item.ruleId);
    const blockingFindings = canonical.formalFindings.filter((item) => item.severity === 'knockout' && item.status === 'unsatisfied');
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 1180px; margin: 24px auto; padding: 16px"></main>';
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
      expectedRuleIds,
      blockingRuleIds,
      blockingLabels: blockingFindings.map((item) => item.label),
      missingRequirements: canonical.missingRequirements,
      familyCount: qualificationCases.length,
    };
  });

  await page.locator('#audit-preview').waitFor({ state: 'visible' });
  await page.waitForTimeout(1000);
  const text = await page.locator('#audit-preview').innerText();
  const missingRuleIds = result.expectedRuleIds.filter((ruleId) => !result.blockingRuleIds.includes(ruleId));
  const missingLabels = result.blockingLabels.filter((label) =>
    !result.missingRequirements.includes(label) || !text.includes(`Wym\u00f3g: ${label}`)
  );
  const checks = {
    scorable: result.canonicalState === 'SCORABLE',
    familyCount: result.familyCount === 21,
    allRuleIds: missingRuleIds.length === 0,
    allLabels: missingLabels.length === 0,
    requirementsCount: result.missingRequirements.length >= result.familyCount,
    renderedHeader: text.includes('KRYTYCZNE BRAKI') && text.includes('DEALBREAKERY (21)'),
  };
  if (Object.values(checks).some((passed) => !passed)) {
    throw new Error(`Qualification family screen assertion failed: ${JSON.stringify({ checks, missingRuleIds, missingLabels, screenText: text.slice(-5000) })}`);
  }
  if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#audit-preview').screenshot({ path: OUTPUT, fullPage: true });
  console.log(`OK: ${result.familyCount} rodzin kwalifikacji, ${result.missingRequirements.length} braki kanoniczne widoczne na ekranie; zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
