import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

const scenarios = [
  { id: 'fraction', start: '2022-01', jd: 'Wymagania\nMinimum 2,5 lata doświadczenia zawodowego.', experience: 80, label: 'Min. 2,5 roku doświadczenia', status: 'missingRequirements' },
  { id: 'range', start: '2020-01', jd: 'Requirements\n3–5 years of experience.', experience: 100, label: 'Min. 3 lata doświadczenia', status: 'matchedRequirements' },
  { id: 'prefix', start: '2010-01', withPython: true, jd: 'Requirements\nAt least 5 years of Python development experience.', experience: null, label: 'Min. 5 lat doświadczenia (Python development)', status: 'unconfirmedRequirements' },
  { id: 'optionality', start: '2020-01', jd: 'Requirements\n.NET is not required.\nNode.js would be a plus.\nPython is required.', label: 'python', status: 'missingRequirements' },
  { id: 'reverse-general', start: '2022-01', jd: 'Wymagania\nDoświadczenie zawodowe: minimum 5 lat.', experience: 40, label: 'Min. 5 lat doświadczenia', status: 'missingRequirements' },
  { id: 'reverse-unknown', start: '', state: 'UNCONFIRMED_REQUIREMENTS', jd: 'Wymagania\nDoświadczenie zawodowe: minimum 5 lat.', experience: null, label: 'Min. 5 lat doświadczenia', status: 'unconfirmedRequirements' },
  { id: 'reverse-python', start: '2010-01', withPython: true, scoped: true, jd: 'Requirements\nPython experience: at least 5 years.', experience: null, label: 'Min. 5 lat doświadczenia (Python)', status: 'unconfirmedRequirements' },
  { id: 'reverse-warehouse', start: '2010-01', state: 'UNCONFIRMED_REQUIREMENTS', scoped: true, jd: 'Wymagania\nDoświadczenie magazynowe: minimum 5 lat.', experience: null, label: 'Min. 5 lat doświadczenia (magazynowe)', status: 'unconfirmedRequirements' },
  { id: 'reverse-optionality', start: '2020-01', jd: 'Requirements\nExperience: min. 5 years is not required.\nPrawo jazdy kat. B would be a plus.\nPython is required.', label: 'python', status: 'missingRequirements' },
  { id: 'upper-matched', start: '2022-01', jd: 'Wymagania\nMaksymalnie 5 lat doświadczenia zawodowego.', experience: 100, label: 'Maks. 5 lat doświadczenia', status: 'matchedRequirements' },
  { id: 'upper-failed', start: '2018-01', jd: 'Requirements\nExperience: at most 5 years.', experience: 0, label: 'Maks. 5 lat doświadczenia', status: 'missingRequirements' },
  { id: 'upper-postfix', start: '2018-01', jd: 'Requirements\nExperience: 5 years maximum.', experience: 0, label: 'Maks. 5 lat doświadczenia', status: 'missingRequirements' },
  { id: 'strict-more', start: '2019-01', jd: 'Wymagania\nPonad 5 lat doświadczenia zawodowego.', experience: 0, label: 'Ponad 5 lat doświadczenia', status: 'missingRequirements' },
  { id: 'strict-less', start: '2019-01', jd: 'Requirements\nLess than 5 years of experience.', experience: 0, label: 'Mniej niż 5 lat doświadczenia', status: 'missingRequirements' },
  { id: 'upper-unknown', start: '', state: 'UNCONFIRMED_REQUIREMENTS', jd: 'Requirements\nExperience: at most 5 years.', experience: null, label: 'Maks. 5 lat doświadczenia', status: 'unconfirmedRequirements' },
  { id: 'upper-scoped', start: '2018-01', state: 'UNCONFIRMED_REQUIREMENTS', scoped: true, jd: 'Wymagania\nDoświadczenie magazynowe: maksymalnie 0 lat.', experience: null, label: 'Maks. 0 lat doświadczenia (magazynowe)', status: 'unconfirmedRequirements' },
];

try {
  for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    // Montujemy rzeczywisty komponent na pustej stronie, żeby stan aplikacji
    // użytkownika i efekty głównego App nie brały udziału w syntetycznym dowodzie.
    await page.route(`${BASE_URL}/`, async (route) => {
      const response = await route.fetch();
      const html = (await response.text())
        .replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '')
        .replace('</head>', '<link rel="stylesheet" href="/src/index.css"></head>')
        .replace('<html lang="pl">', '<html lang="pl" class="dark">')
        .replace('<div id="root"></div>', '<main id="audit-preview" style="max-width:1060px;margin:24px auto;padding:16px"></main>');
      assert.ok(!html.includes('/src/main.tsx'), 'Główny App nie może uruchamiać się w izolowanym dowodzie.');
      assert.ok(html.includes('id="audit-preview"'), 'Brak kontenera rzeczywistego komponentu.');
      await route.fulfill({ response, body: html });
    });
    await page.route('**/api/**', (route) => route.abort());
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async ({ start, jd, withPython = false }) => {
      const [react, reactDom, { AtsSimulatorView }, { createEmptyVault }, { simulateAtsCheck },
        { scoreCanonicalAts }, { measureVaultCompleteness }, { hasCareerEvidence }] = await Promise.all([
        import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
        import('/src/features/matcher/AtsSimulatorView.tsx'), import('/src/lib/sampleVault.ts'),
        import('/src/lib/atsSimulator.ts'), import('/src/lib/canonicalAts.ts'),
        import('/src/lib/vaultCompleteness.ts'), import('/src/lib/careerEvidence.ts'),
      ]);
      const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
      vault.personalInfo.phone = '123456789';
      vault.personalInfo.title = 'Specjalista';
      vault.personalInfo.summary = 'Obsługa klientów, rozwiązywanie problemów i organizacja pracy zespołu.';
      vault.skillsMatrix.hardSkills = withPython ? ['Python'] : [];
      vault.history = [{ id: 'synthetic-work', company: 'Firma Testowa', role: 'Specjalista', location: '',
        startDate: start, endDate: start ? '2024-01' : '', isCurrent: false,
        highlights: [{ id: 'synthetic-highlight', text: withPython ? 'Obsługa klientów i tworzenie skryptów Python.' : 'Obsługa klientów i organizacja pracy zespołu.', action: '', target: '', tool: '', metric: '', keywords: [] }],
      }];
      const resume = { targetJobTitle: 'Specjalista', companyName: '', summary: vault.personalInfo.summary,
        selectedHighlights: [], skillsMatched: { hardSkills: vault.skillsMatrix.hardSkills, toolsAndTech: [], softSkills: [] }, atsScore: null };
      const legacy = simulateAtsCheck(resume, vault, jd);
      const canonical = scoreCanonicalAts(vault, jd, 'Specjalista');
      const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
      const createElement = react.createElement ?? react.default?.createElement;
      const context = createElement('section', { 'aria-label': 'Kontekst próby audytowej', className: 'mb-6 rounded-xl border border-line bg-surface p-4 text-sm text-ink' },
        createElement('h2', { className: 'mb-2 font-bold' }, 'Próba audytowa — dane syntetyczne'),
        createElement('p', { className: 'whitespace-pre-line' }, `Źródło wymagania:\n${jd}`),
        createElement('p', { className: 'mt-2 text-muted' }, start ? `Okres zatrudnienia: ${start} → 2024-01. Opis dotyczy obsługi klientów${withPython ? ' i skryptów Python' : ''}.` : 'Profil zawiera opis pracy, ale nie ma dat zatrudnienia.'),
      );
      const view = createElement(AtsSimulatorView, {
        result: legacy, canonicalResult: canonical, profileCompleteness: measureVaultCompleteness(vault).percent,
        careerEvidenceAvailable: hasCareerEvidence(vault),
      });
      createRoot(document.getElementById('audit-preview')).render(createElement(react.Fragment ?? react.default?.Fragment, null, context, view));
      return canonical;
    }, scenario);
    assert.equal(result.state, scenario.state || 'SCORABLE');
    assert.ok(result[scenario.status].includes(scenario.label), JSON.stringify(result));
    if ('experience' in scenario) assert.equal(result.components.experience, scenario.experience);
    if (scenario.id === 'range') assert.ok(![...result.missingRequirements, ...result.matchedRequirements].includes('Min. 5 lat doświadczenia'));
    if (scenario.id === 'optionality' || scenario.id === 'reverse-optionality') {
      const labels = [...result.matchedRequirements, ...result.missingRequirements, ...result.unconfirmedRequirements];
      assert.deepEqual(labels, ['python']);
    }
    await page.getByText('Wynik analizy Kierivo', { exact: true }).waitFor();
    if (scenario.status !== 'matchedRequirements') await page.getByText(scenario.label, { exact: true }).first().waitFor();
    if ('experience' in scenario) {
      const experienceTile = page.getByText(/^Staż i świeżość \(/).locator('..');
      await experienceTile.getByText(scenario.experience === null ? 'brak danych' : `${scenario.experience}%`, { exact: true }).waitFor();
    }
    if (scenario.id === 'prefix' || scenario.scoped) await page.getByText(/Daty zatrudnienia nie potwierdzają czasu doświadczenia/).first().waitFor();
    if (result.score === null) {
      await page.getByText('Brak wyniku', { exact: true }).first().waitFor();
      assert.equal(result.components.experience, null);
    } else await page.getByText(`${result.score}%`, { exact: true }).first().waitFor();
    await page.waitForTimeout(1300);
    assert.equal(pageErrors.length, 0, pageErrors.join('; '));
    const output = `docs/evidence/ats-experience-${scenario.id}-2026-10-02.png`;
    await page.screenshot({ path: output, fullPage: true });
    console.log(`PASS: ${scenario.id}; staż ${result.components.experience}, wynik ${result.score}; ${output}`);
    await page.close();
  }
} finally {
  await browser.close();
}
