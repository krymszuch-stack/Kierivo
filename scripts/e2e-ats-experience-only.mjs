import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  for (const scenario of [
    { withDates: true, withContext: false },
    { withDates: false, withContext: false },
    { withDates: true, withContext: true },
    { withDates: true, withContext: false, withScope: true },
    { withDates: true, withContext: false, withScope: true, withoutTool: true },
  ]) {
    const { withDates, withContext, withScope = false, withoutTool = false } = scenario;
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async ({ withDates: dated, withContext: context, withScope: scoped = false, withoutTool: noTool = false }) => {
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
      vault.personalInfo.phone = '123456789';
      vault.personalInfo.title = 'Magazynier';
      vault.personalInfo.summary = 'Doświadczenie w kompletowaniu zamówień i pracy zespołowej w magazynie.';
      vault.skillsMatrix.hardSkills = scoped ? noTool ? [] : ['Python'] : ['Kompletowanie zamówień'];
      vault.history = [{
        id: 'warehouse', company: 'Firma Testowa', role: 'Magazynier', location: '',
        startDate: dated ? scoped ? '2010-01' : '2022-01' : '', endDate: dated ? '2024-01' : '', isCurrent: false,
        highlights: [{ id: 'h-warehouse', text: scoped ? noTool ? 'Obsługa klientów i organizacja pracy zespołu.' : 'Obsługa klientów, organizacja pracy i tworzenie skryptów Python.' : 'Kompletowanie zamówień i organizacja pracy magazynu.', action: '', target: '', tool: '', metric: '', keywords: [] }],
      }];
      const jd = scoped ? noTool ? 'Wymagania\nMinimum 5 lat doświadczenia na stanowisku magazyniera.' : 'Requirements\nAt least 5 years of experience with Python.' : context
        ? 'Requirements\nMinimum 18 years old.\nMinimum 5 years of experience is not required.\nRequired: at least 3 years of experience.'
        : 'Wymagania:\nMinimum 5 lat doświadczenia zawodowego.';
      const resume = {
        targetJobTitle: 'Magazynier', companyName: '', summary: vault.personalInfo.summary,
        selectedHighlights: [], skillsMatched: { hardSkills: vault.skillsMatrix.hardSkills, toolsAndTech: [], softSkills: [] }, atsScore: null,
      };
      const legacy = simulateAtsCheck(resume, vault, jd);
      const canonical = scoreCanonicalAts(vault, jd, 'Magazynier');
      const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
      const createElement = react.createElement ?? react.default?.createElement;
      document.body.innerHTML = '<main id="audit-preview" style="max-width: 1060px; margin: 24px auto; padding: 16px"></main>';
      createRoot(document.getElementById('audit-preview')).render(createElement(AtsSimulatorView, {
        result: legacy, canonicalResult: canonical,
        profileCompleteness: measureVaultCompleteness(vault).percent, careerEvidenceAvailable: hasCareerEvidence(vault),
      }));
      return canonical;
    }, scenario);
    await page.getByText('Wynik analizy Kierivo', { exact: true }).waitFor();
    if (withScope) {
      assert.equal(result.components.experience, null);
      const requirement = `Min. 5 lat doświadczenia (${withoutTool ? 'na stanowisku magazyniera' : 'with Python'})`;
      assert.ok(result.unconfirmedRequirements.includes(requirement));
      assert.ok(!result.matchedRequirements.some((label) => label.startsWith('Min. 5')));
      assert.ok(!result.missingRequirements.some((label) => label.startsWith('Min. 5')));
      if (withoutTool) {
        assert.equal(result.state, 'UNCONFIRMED_REQUIREMENTS');
        assert.equal(result.score, null);
        await page.getByText('Brak wyniku', { exact: true }).waitFor();
      } else {
        assert.equal(result.state, 'SCORABLE');
        await page.getByText(requirement, { exact: true }).first().waitFor();
        await page.getByText('Wstępny', { exact: true }).waitFor();
      }
      await page.getByText(/Daty zatrudnienia nie potwierdzają czasu doświadczenia w wymaganym obszarze/).first().waitFor();
      await page.waitForTimeout(1300);
    } else if (withDates) {
      assert.equal(result.state, 'SCORABLE');
      const requirement = withContext ? 'Min. 3 lata doświadczenia' : 'Min. 5 lat doświadczenia';
      assert.equal(result.components.experience, withContext ? 67 : 40);
      assert.ok(result.missingRequirements.includes(requirement));
      if (withContext) {
        assert.ok(!result.matchedRequirements.some((label) => /Min\. (5|18) /.test(label)));
        assert.ok(!result.missingRequirements.some((label) => /Min\. (5|18) /.test(label)));
      }
      await page.getByText(`${result.score}%`, { exact: true }).waitFor();
      await page.getByText(requirement, { exact: true }).waitFor();
      await page.waitForTimeout(1300);
    } else {
      assert.equal(result.state, 'UNCONFIRMED_REQUIREMENTS');
      assert.equal(result.score, null);
      assert.deepEqual(result.unconfirmedRequirements, ['Min. 5 lat doświadczenia']);
      await page.getByText('Brak wyniku', { exact: true }).waitFor();
      await page.getByText(/Brak wiarygodnych dat zatrudnienia/).first().waitFor();
    }
    const text = await page.locator('#audit-preview').innerText();
    assert.doesNotMatch(text, /Brak wykrytych wymagań|nie wykryto wymagań|aktualności uprawnień/i);
    assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);
    const output = withScope ? `docs/evidence/ats-scoped-experience-${withoutTool ? 'no-score' : 'unconfirmed'}-2026-10-02.png` : withContext
      ? 'docs/evidence/ats-experience-context-2026-10-02.png'
      : `docs/evidence/ats-experience-only-${withDates ? 'dated' : 'unknown'}-2026-10-02.png`;
    await page.screenshot({ path: output, fullPage: true });
    console.log(`PASS: ${withScope ? withoutTool ? '14 lat zatrudnienia nie potwierdza 5 lat na stanowisku magazyniera; brak wyniku' : '14 lat zatrudnienia i wzmianka o Pythonie nie potwierdzają 5 lat z Pythonem' : withContext ? 'pominięto wiek i niewymagane 5 lat; wymagany staż 3 lata' : withDates ? 'staż 2 z wymaganych 5 lat' : 'brak dat, staż niepotwierdzony'}; stan ${result.state}, wynik ${result.score}; zrzut: ${output}`);
    await page.close();
  }
} finally {
  await browser.close();
}
