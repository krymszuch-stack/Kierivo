import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/ats-formal-requirement-gap-2026-10-01.png';
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
    const jd = 'Wymagania obowiązkowe: Wymagane aktualne uprawnienia SEP G1 do 1 kV. Wymagane doświadczenie w obsłudze ticketów i wsparciu użytkowników.';
    const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
    vault.personalInfo.summary = 'Doświadczenie w obsłudze ticketów i wsparciu użytkowników.';
    vault.skillsMatrix.hardSkills = ['obsługa ticketów', 'wsparcie użytkowników'];
    const resume = {
      targetJobTitle: 'IT Support L1', companyName: '', summary: vault.personalInfo.summary,
      selectedHighlights: [], skillsMatched: { hardSkills: vault.skillsMatrix.hardSkills, toolsAndTech: [], softSkills: [] }, atsScore: null,
    };
    const legacy = simulateAtsCheck(resume, vault, jd);
    const canonical = scoreCanonicalAts(vault, jd, 'IT Support L1');
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
      formalCoverage: legacy.layer2Nlp.formalReqsCoverage,
      gapAnalysis: legacy.gapAnalysis,
      canonicalState: canonical.state,
      missingRequirements: canonical.missingRequirements,
    };
  });

  await page.waitForTimeout(1000);
  const text = await page.locator('#audit-preview').innerText();
  if (result.canonicalState !== 'SCORABLE' || !/Niepotwierdzony wymóg obowiązkowy/.test(text) || /WYMĂ|obowiÄ/.test(text) ||
      /100%|Wszystkie rozpoznane wymagania/i.test(result.gapAnalysis.join(' ')) ||
      !result.missingRequirements.some((item) => /SEP/i.test(item)) || !/Wymóg:.*SEP/i.test(text)) {
    throw new Error(`Wymóg formalny nie został przedstawiony jako luka: ${JSON.stringify({ result, text })}`);
  }
  if (pageErrors.length > 0) throw new Error(`Błędy strony: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#audit-preview').screenshot({ path: OUTPUT, fullPage: true });
  console.log(`Brak aktualnego SEP pozostaje luką formalną; zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
