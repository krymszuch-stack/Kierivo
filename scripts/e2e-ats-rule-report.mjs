import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence';

let chromium;
try {
  const modulePath = process.env.PLAYWRIGHT_MODULE ||
    'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
  ({ chromium } = await import(modulePath));
} catch {
  console.error('Brak Playwright. Ustaw PLAYWRIGHT_MODULE na lokalny moduĹ‚ Playwright.');
  process.exit(2);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const [react, reactDom, { AtsValidationPanel }, { validatePdfTextForAts }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/ats/AtsValidationPanel.tsx'),
      import('/src/lib/atsPdfValidator.ts'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;

    const vault = createEmptyVault('Jan Kowalski', 'jan@example.invalid');
    const report = await validatePdfTextForAts(
      'Curriculum Vitae\nKontakt do rekrutacji: rekrutacja@firma.example\nJan Kowalski\njan@example.invalid\nUmiejÄ™tnoĹ›ci\nJavaScript',
      vault,
      { hasActualText: false, vendorIds: ['workday', 'taleo'] }
    );
    document.body.innerHTML = '<main id="audit-preview" style="max-width: 780px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-preview')).render(createElement(AtsValidationPanel, { report }));
    return report;
  });

  await page.getByText(/Lokalny przegl.*tekstu PDF/).waitFor({ state: 'visible' });
  await page.getByText(/nie ocenia geometrii kolumn/).waitFor({ state: 'visible' });
  if (!result.vendors.every((vendor) => vendor.extractedFields.name === 'Jan Kowalski' && vendor.extractedFields.email === 'jan@example.invalid' && !vendor.issues.some((issue) => ['MISSING_NAME', 'MISSING_EMAIL'].includes(issue.id)))) {
    throw new Error(`Walidator PDF nie dopasowal danych kandydata: ${JSON.stringify(result.vendors.map((vendor) => ({ vendorId: vendor.vendorId, name: vendor.extractedFields.name, email: vendor.extractedFields.email, missing: vendor.issues.filter((issue) => ["MISSING_NAME", "MISSING_EMAIL"].includes(issue.id)).map((issue) => issue.id) })))}`);
  }
  await page.getByRole('button').filter({ hasText: 'Workday' }).first().click();
  await page.getByText(/Imi.*:/).first().waitFor({ state: 'visible' });
  await page.getByText('Wykryte', { exact: true }).first().waitFor({ state: 'visible' });
  const text = await page.locator('body').innerText();
  if (/\b(?:PASS|FAIL)\b|\b\d{1,3}%\b|wynik parsowalnoĹ›ci/i.test(text)) {
    throw new Error('Widok nadal pokazuje niekalibrowany wynik lub werdykt zgodnoĹ›ci ATS.');
  }
  if (!result.vendors.every((vendor) => !Object.hasOwn(vendor, 'parseScore') && !Object.hasOwn(vendor, 'status'))) {
    throw new Error('Raport API nadal zwraca niekalibrowanÄ… punktacjÄ™ lub status.');
  }

  await mkdir(OUTPUT, { recursive: true });
  await page.screenshot({ path: `${OUTPUT}/ats-rule-report-name-after-heading-2026-10-01.png`, fullPage: true });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { AtsLabView }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/ats/AtsLabView.tsx'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.invalid');
    vault.personalInfo.title = 'InĹĽynier chmurowy';
    vault.personalInfo.summary = 'Rozwijam kompetencje w obszarze usĹ‚ug chmurowych i infrastruktury.';
    vault.skillsMatrix.hardSkills = ['Kubernetes', 'AWS', 'Terraform'];
    vault.history = [];
    vault.projects = [];
    document.body.innerHTML = '<main id="audit-lab" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-lab')).render(createElement(AtsLabView, {
      profileId: 'synthetic-matrix-only',
      vault,
      targetRole: 'InĹĽynier chmurowy',
      jobOfferText: 'Wymagania: Kubernetes, AWS, Terraform. Minimum 5 lat doĹ›wiadczenia zawodowego.',
    }));
  });
  await page.getByText(/Brak wystarczaj.*danych o do.*wiadczeniu/).waitFor({ state: 'visible' });
  await page.getByText(/Ocena dopasowania zawodowego jest wstrzymana/).waitFor({ state: 'visible' });
  await page.getByText(/brakuje merytorycznego opisu do.*wiadczenia lub projektu/i).waitFor({ state: 'visible' });
  await page.getByText(/Mediana kontrolnych wskaznikow \(\d+ modulow; nie ocena dopasowania\):/).waitFor({ state: 'visible' });
  const formalEngineCard = page.getByRole('button').filter({ hasText: 'Audytor Wykrytych' }).first();
  const formalEngineText = await formalEngineCard.innerText();
  if (!formalEngineText.includes('—') || !formalEngineText.includes('Nie oceniono')) {
    throw new Error(`Formal module: ${formalEngineText}`);
  }
  const ocrEngineCard = page.getByRole('button').filter({ hasText: 'Audytor Struktury' }).first();
  const ocrEngineText = await ocrEngineCard.innerText();
  if (!ocrEngineText.trimStart().startsWith('\u2014') || !ocrEngineText.includes('Nie oceniono')) {
    throw new Error(`Modul OCR ocenil uklad, mimo ze nie dostal pliku CV: ${ocrEngineText}`);
  }
  const consensusEngineCard = page.getByRole('button').filter({ hasText: 'Konsensus Kierivo' }).first();
  await consensusEngineCard.click();
  await page.getByText(/Nie oceniono dopasowania kariery/).waitFor({ state: 'visible' });
  const consensusEngineText = await consensusEngineCard.innerText();
  if (!consensusEngineText.trimStart().startsWith('\u2014') || !consensusEngineText.includes('Nie oceniono')) {
    throw new Error(`Konsensus pokazal wynik kariery bez historii ani projektu: ${consensusEngineText}`);
  }
  const metricsEngineCard = page.getByRole('button').filter({ hasText: 'Analizator Twardych Liczb' }).first();
  const metricsEngineText = await metricsEngineCard.innerText();
  if (!metricsEngineText.includes('—') || !metricsEngineText.includes('Nie oceniono')) {
    throw new Error('ModuĹ‚ metryk pokazaĹ‚ procent bez opisĂłw doĹ›wiadczenia do sprawdzenia.');
  }
  const timelineEngineCard = page.getByRole('button').filter({ hasText: 'zatrudnienia' }).first();
  const timelineEngineText = await timelineEngineCard.innerText();
  if (!timelineEngineText.includes('—') || !timelineEngineText.includes('Nie oceniono')) {
    throw new Error('ModuĹ‚ chronologii pokazaĹ‚ wynik bez wpisĂłw zatrudnienia do porĂłwnania.');
  }
  const narrativeEngineCard = page.getByRole('button').filter({ hasText: 'Audytor dowod' }).first();
  const narrativeEngineText = await narrativeEngineCard.innerText();
  if (!narrativeEngineText.includes('0%') || !narrativeEngineText.includes('Bardzo niski wynik')) {
    throw new Error(`ModuĹ‚ narracji nie odrĂłĹĽniĹ‚ listy umiejÄ™tnoĹ›ci od potwierdzenia w opisie: ${narrativeEngineText}`);
  }
  const quickEngineCard = page.getByRole('button').filter({ hasText: 'Przesiewowy Tester' }).first();
  const quickEngineText = await quickEngineCard.innerText();
  if (!quickEngineText.trimStart().startsWith('\u2014') || !quickEngineText.includes('Nie oceniono')) {
    throw new Error(`Przesiewowy modul ocenil sam tytul i liste umiejetnosci: ${quickEngineText}`);
  }
  const recencyEngineCard = page.getByRole('button').filter({ hasText: 'relevanceRanking.ts' }).first();
  const recencyEngineText = await recencyEngineCard.innerText();
  if (!recencyEngineText.includes('—') || !recencyEngineText.includes('Nie oceniono')) {
    throw new Error('ModuĹ‚ Ĺ›wieĹĽoĹ›ci pokazaĹ‚ wynik bez datowanego doĹ›wiadczenia.');
  }
  if (await page.getByText('Administrator', { exact: false }).count()) {
    throw new Error('Widok zasugerowaĹ‚ alternatywny zawĂłd mimo braku danych o doĹ›wiadczeniu.');
  }
  const labText = await page.locator('#audit-lab').innerText();
  if (!labText.includes('Wynik laczny wstrzymany') || !/Do\u015bwiadczenie i metryki\s+Brak danych[\s\S]{0,24}\u2014/.test(labText)) {
    throw new Error('Telemetria nadal pokazuje liczbowy wynik doswiadczenia bez historii albo nie wstrzymuje wyniku lacznego.');
  }
  await page.screenshot({ path: `${OUTPUT}/ats-lab-fit-insufficient-evidence-2026-10-01.png`, fullPage: true });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { AtsLabView }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/ats/AtsLabView.tsx'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.invalid');
    vault.personalInfo.title = 'Technik';
    vault.profiler.languages = [{ id: 'english-c1', language: 'Angielski', level: 'C1', context: 'Wymaganie oferty' }];
    vault.history = [{
      id: 'synthetic-role', company: '', role: 'Technik', location: '',
      startDate: '', endDate: '', isCurrent: false,
      description: 'Obsluga klientow i koordynacja codziennej pracy zespolu.', highlights: [],
    }];
    document.body.innerHTML = '<main id="audit-title" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-title')).render(createElement(AtsLabView, {
      profileId: 'synthetic-title-only',
      vault,
      targetRole: 'Technik',
      jobOfferText: 'Opis pracy: Technik odpowiada za kontakt z klientami. Wymagany jezyk angielski C1.',
    }));
  });
  const titleEngineCard = page.getByRole('button').filter({ hasText: 'Weryfikator Naglowka' }).first();
  await titleEngineCard.waitFor({ state: 'visible' });
  await titleEngineCard.click();
  await page.getByText(/Zgodnosc tytulu; nie znaleziono wymagan twardych/i).waitFor({ state: 'visible' });
  if (!(await titleEngineCard.innerText()).includes('100%')) {
    throw new Error(`Zgodnosc tytulu zostala obnizona mimo braku wymagan twardych: ${await titleEngineCard.innerText()}`);
  }
  const titleLabText = await page.locator('body').innerText();
  if (!/Pokrycie lematów\s+Brak danych/.test(titleLabText) || !/Formalia\s+100%/.test(titleLabText)) {
    throw new Error(`Brak wymagan twardych jest nadal pokazywany jako numeryczne pokrycie: ${titleLabText.slice(0, 900)}`);
  }
  await page.screenshot({ path: `${OUTPUT}/ats-title-match-without-hard-requirements-2026-10-01.png`, fullPage: true });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { AtsLabView }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/ats/AtsLabView.tsx'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.invalid');
    vault.personalInfo.title = 'Python Developer';
    vault.history = [{
      id: 'synthetic-role-python', company: 'Firma', role: 'Python Developer', location: '',
      startDate: '2020-01', endDate: '2022-01', isCurrent: false,
      description: 'Wspolpraca z zespolami przy planowaniu wydan produktowych.', highlights: [],
    }];
    vault.projects = [{
      id: 'synthetic-project-kubernetes', name: 'Kubernetes platforma',
      role: 'Koordynator', techStack: [],
      description: 'Koordynacja harmonogramu wdrozenia i komunikacja z interesariuszami.',
    }];
    document.body.innerHTML = '<main id="audit-metadata-evidence" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-metadata-evidence')).render(createElement(AtsLabView, {
      profileId: 'synthetic-metadata-only-skills',
      vault,
      targetRole: 'Python Developer',
      jobOfferText: 'Wymagania: Python, Kubernetes.',
    }));
  });
  const evidenceLabText = await page.locator('#audit-metadata-evidence').innerText();
  if (!/Ocena dopasowania profilu wed\u0142ug regu\u0142 Kierivo/.test(evidenceLabText) || !/Umiej\u0119tno\u015bci\s+0%/.test(evidenceLabText) || !/Pokrycie lemat\u00f3w[\s\S]{0,45}0%/.test(evidenceLabText)) {
    throw new Error(`Profil z samymi metadanymi nie pokazuje braku potwierdzenia umiejetnosci: ${evidenceLabText.slice(0, 700)}`);
  }
  await page.screenshot({ path: `${OUTPUT}/ats-metadata-not-skill-evidence-2026-10-01.png`, fullPage: true });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [react, reactDom, { AtsLabView }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/ats/AtsLabView.tsx'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.invalid');
    vault.skillsMatrix.hardSkills = ['Python', 'Linux', 'AWS', 'Excel', 'Teams', 'Active Directory'];
    vault.history = [];
    vault.projects = [];
    document.body.innerHTML = '<main id="audit-action-evidence" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-action-evidence')).render(createElement(AtsLabView, {
      profileId: 'synthetic-skills-without-narrative',
      vault,
      targetRole: '',
      jobOfferText: 'Wymagania: Python, Linux, AWS. Zakres: administracja systemami i wsparcie uzytkownikow.',
    }));
  });
  const actionEvidenceText = await page.locator('#audit-action-evidence').innerText();
  if (!/Sprawczość języka\s+Brak danych[\s\S]{0,16}—/.test(actionEvidenceText) || !/sprawczość języka:\s*brak danych/i.test(actionEvidenceText)) {
    throw new Error(`Lista umiejetnosci bez narracji nadal pokazuje zerowa sprawczosc: ${actionEvidenceText.slice(0, 900)}`);
  }
  await page.screenshot({ path: `${OUTPUT}/ats-telemetry-no-narrative-2026-10-01.png`, fullPage: true });
  console.log('Ekrany potwierdzajÄ… poprawne dane PDF oraz brak ocen kariery, metryk, chronologii i wymagaĹ„ formalnych bez odpowiednich danych. Dane sÄ… syntetyczne.');
} finally {
  await browser.close();
}
