const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/invalid-cv-email-score-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1150 } });
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

    const vault = createEmptyVault('Jan Testowy', 'jan@');
    vault.personalInfo.phone = '123456789';
    vault.personalInfo.summary = 'Doświadczenie w obsłudze użytkowników i systemów IT.';
    vault.skillsMatrix.hardSkills = ['Python'];
    vault.history = [{
      id: 'support', company: 'Firma Testowa', role: 'Pracownik wsparcia', location: '',
      startDate: '2021-01', endDate: '2025-01', isCurrent: false,
      highlights: [{ id: 'h-support', text: 'Obsługa zgłoszeń i skryptów Python.', action: '', target: '', tool: '', metric: '', keywords: [] }],
    }];
    const jd = 'Specjalista wsparcia IT. Wymagania: Python i obsługa zgłoszeń użytkowników.';
    const resume = {
      targetJobTitle: 'Specjalista wsparcia IT', companyName: '', summary: vault.personalInfo.summary,
      selectedHighlights: [],
      skillsMatched: { hardSkills: ['Python'], toolsAndTech: [], softSkills: [] },
      atsScore: null,
    };
    const legacy = simulateAtsCheck(resume, vault, jd);
    const canonical = scoreCanonicalAts(vault, jd, 'Specjalista wsparcia IT');
    const validVault = structuredClone(vault);
    validVault.personalInfo.email = 'jan@example.com';
    const validCanonical = scoreCanonicalAts(validVault, jd, 'Specjalista wsparcia IT');
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
      invalidStructure: canonical.components.structure,
      validStructure: validCanonical.components.structure,
      canonicalPenalty: canonical.penalties.includes('Brak prawidłowego adresu e-mail.'),
      legacyWarning: legacy.ocrWarnings.includes('Brak prawidłowego adresu e-mail w sekcji danych osobowych.'),
    };
  });

  await page.locator('#audit-preview').getByText('Wynik analizy Kierivo', { exact: true }).waitFor({ state: 'visible' });
  const text = await page.locator('#audit-preview').innerText();
  if (pageErrors.length) throw new Error(`Błędy strony: ${pageErrors.join('; ')}; widok: ${text}`);
  if (result.state !== 'SCORABLE' || result.score === null ||
      result.invalidStructure !== result.validStructure - 10 ||
      !result.canonicalPenalty || !result.legacyWarning ||
      !text.includes('Wykryte problemy kontaktowe: 1')) {
    throw new Error(`Niepoprawny e-mail nadal przechodzi jako prawidłowy kontakt: ${JSON.stringify({ result, text })}`);
  }
  if (pageErrors.length) throw new Error(`Błędy strony: ${pageErrors.join('; ')}`);
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`OK: oba silniki wykrywają jan@, struktura kanoniczna zmienia się ${result.validStructure} → ${result.invalidStructure}; zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
