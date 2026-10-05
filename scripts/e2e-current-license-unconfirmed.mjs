import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/current-license-unconfirmed-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
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

    const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
    vault.personalInfo.summary = 'Doświadczenie zawodowe w obsłudze klienta i wsparciu technicznym.';
    vault.skillsMatrix.hardSkills = ['ServiceNow'];
    vault.profiler.licenses = ['b_license'];
    const jd = 'Technik wsparcia. Wymagane aktualne prawo jazdy kat. B. Wymagane doświadczenie w obsłudze klienta oraz znajomość ServiceNow.';
    const resume = {
      targetJobTitle: 'Technik wsparcia', companyName: '', summary: vault.personalInfo.summary,
      selectedHighlights: [],
      skillsMatched: { hardSkills: vault.skillsMatrix.hardSkills, toolsAndTech: [], softSkills: [] },
      atsScore: null,
    };
    const legacy = simulateAtsCheck(resume, vault, jd);
    const canonical = scoreCanonicalAts(vault, jd, 'Technik wsparcia');
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
      blocking: canonical.formalFindings.filter((item) => item.severity === 'knockout' && item.status === 'unsatisfied'),
    };
  });

  await page.locator('#audit-preview').waitFor({ state: 'visible' });
  await page.locator('#audit-preview').getByText(`${result.score}%`, { exact: true }).waitFor({ state: 'visible' });
  await page.getByText(/Nie można potwierdzić wymogów z oferty:.*Prawo jazdy kat\. B/i).waitFor();
  await page.waitForTimeout(1300);
  const text = await page.locator('#audit-preview').innerText();
  if (result.state !== 'SCORABLE' || result.score === null ||
      !result.unconfirmed.some((item) => item.includes('Prawo jazdy kat. B')) ||
      result.blocking.some((item) => item.label.includes('Prawo jazdy kat. B')) ||
      !/WSTĘPNY WYNIK|Wstępny wynik/.test(text) ||
      /Wszystkie wykryte wymagania są potwierdzone|Nie wykryto braków w wymaganiach/.test(text)) {
    throw new Error(`Niepotwierdzona aktualność prawa jazdy nie została pokazana uczciwie: ${JSON.stringify({ result, text })}`);
  }
  if (pageErrors.length) throw new Error(`Błędy strony: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  await page.locator('#audit-preview').screenshot({ path: OUTPUT, fullPage: true });
  console.log(`OK: wynik ${result.score}% pozostaje wstępny, aktualność kat. B jest jawnie niepotwierdzona; zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
