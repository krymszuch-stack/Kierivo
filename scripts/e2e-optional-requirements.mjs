/** E2E: jawne atuty pozostajÄ… widoczne osobno i nie zasilajÄ… listy brakĂłw. */
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const SCREENSHOT_PATH = 'docs/evidence/optional-requirements-2026-10-01.png';

let chromium;
try {
  const modulePath = process.env.PLAYWRIGHT_MODULE ||
    'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
  ({ chromium } = await import(modulePath));
} catch {
  console.error('Brak Playwright. Ustaw PLAYWRIGHT_MODULE na lokalny moduĹ‚ Playwright.');
  process.exit(2);
}

function fnv1a(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function envelope(value) {
  const data = JSON.stringify(value);
  return JSON.stringify({ cvel: 2, crc: fnv1a(data), data });
}

const profileId = 'local-optional-requirements-proof';
const profile = { id: profileId, name: 'Synthetic Optional Proof', type: 'local', createdAt: '2026-10-01T00:00:00.000Z' };
const vault = {
  version: '1.0.0', updatedAt: '2026-10-01T00:00:00.000Z',
  profiler: {
    flags: [], experienceLevel: 'MID',
    location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
    languages: [],
  },
  personalInfo: {
    fullName: 'Jan Testowy', email: 'jan.testowy@example.invalid', phone: '', location: '',
    title: 'IT Support Technician', summary: 'Syntetyczny profil bez potwierdzonych narzÄ™dzi.',
  },
  skillsMatrix: { hardSkills: [], softSkills: [], toolsAndTech: [], certifications: [] },
  history: [], education: [], projects: [],
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => {
  // Wspólny host ma zajęty port WebSocket Vite; nie wpływa to na testowany parser/UI.
  if (!/WebSocket closed without opened/i.test(String(error))) errors.push(String(error));
});

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ id, profileEnvelope, vaultEnvelope }) => {
    localStorage.setItem('cvelocity:profile', profileEnvelope);
    localStorage.setItem(`cvelocity:vault:${id}`, vaultEnvelope);
  }, { id: profileId, profileEnvelope: envelope(profile), vaultEnvelope: envelope(vault) });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /Wklej ofert/ }).click();
  const offerInput = page.locator('#saved-profile-job-description');
  await offerInput.waitFor({ state: 'visible', timeout: 15_000 });
  await offerInput.fill(`IT Support Technician
Requirements
ServiceNow ticketing system.
Desirable
Exchange Online administration, PowerShell.
Bonus points
Intune device management.
Dodatkowe atuty
ITIL Foundation.
Forma zatrudnienia: Umowa o pracę lub kontrakt B2B.
Responsibilities
Jira and Docker configuration.`);
  await page.getByRole('button', { name: /Sprawd/ }).click();
  await page.getByRole('tab', { name: /Dopasowanie.*Rachunek/ }).waitFor({ state: 'visible', timeout: 15_000 });

  const optionalCard = page.getByText(/Mile widziane w ofercie \(3\)/);
  await optionalCard.waitFor({ state: 'visible', timeout: 15_000 });
  const body = await page.locator('body').innerText();
  if (!new RegExp('Tryb pracy\\s*\\nNie okre\\u015blono w tre\\u015bci', 'i').test(body)) {
    throw new Error('Brak jawnego stanu nieznanego dla trybu pracy w podsumowaniu oferty.');
  }
  for (const item of ['Exchange Online administration, PowerShell.', 'Intune device management.', 'ITIL Foundation.']) {
    if (!body.includes(item)) throw new Error(`Brakuje atutu w osobnej sekcji: ${item}`);
  }
  if (!body.includes(`0 / 1 wymaga\u0144`) || !/brakuje \(1\)/i.test(body)) {
    throw new Error('Opcjonalne pozycje albo obowiązek z obowiązków zmieniły liczbę wymagań.');
  }
  if (!body.includes('Procent łączy pokrycie wymagań') || !body.includes('Licznik obok pokazuje osobno')) {
    throw new Error('UI nie wyjaśnia, że procent zbiorczy i licznik wymagań mierzą różne rzeczy.');
  }
  if (/Jira and Docker configuration/.test(body)) throw new Error('Obowiązki wyciekły do listy atutów.');

  if (!body.includes('Nie znaleziono jawnego poziomu w odczytanej treści') ||
      !body.includes('umowa o pracę') || !body.includes('kontrakt B2B')) {
    throw new Error('Podsumowanie warunków nie pokazuje braku poziomu i obu form zatrudnienia z oferty.');
  }
  if (!body.includes('Wynik wstępny — ograniczone dane') || !body.includes('profil jest uzupełniony w 18%')) {
    throw new Error('Mało kompletny profil nadal otrzymuje kategoryczną interpretację wyniku.');
  }
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log(`Zrzut dowodowy zapisany: ${SCREENSHOT_PATH}`);

  const completeVault = structuredClone(vault);
  completeVault.personalInfo.phone = '123456789';
  completeVault.profiler.location.city = 'Warszawa';
  completeVault.skillsMatrix.hardSkills = ['ServiceNow'];
  completeVault.skillsMatrix.toolsAndTech = ['Microsoft 365'];
  completeVault.history = [{
    id: 'synthetic-support-role', company: 'Firma Przykładowa', role: 'IT Support Technician',
    location: 'Warszawa', startDate: '2022-01', endDate: '2025-01', isCurrent: false,
    highlights: [{
      id: 'synthetic-support-highlight', text: 'Obsługa zgłoszeń ServiceNow i wsparcie użytkowników.',
      action: '', target: '', tool: '', metric: '', keywords: [],
    }],
  }];
  completeVault.education = [{ id: 'synthetic-education', institution: 'Szkoła Przykładowa', degree: 'Technik', fieldOfStudy: 'Informatyka', startDate: '', endDate: '2021' }];
  completeVault.projects = [{ id: 'synthetic-project', name: 'Projekt testowy', role: '', description: 'Dokumentacja konfiguracji środowiska testowego.', techStack: [] }];
  await page.evaluate(async (value) => {
    const { parseMasterVaultImport } = await import('/src/lib/masterVaultImportSchema.ts');
    if (!parseMasterVaultImport(value)) throw new Error('Profil syntetyczny nie spełnia kontraktu MasterVault.');
  }, completeVault);
  await page.evaluate(({ id, profileEnvelope, vaultEnvelope }) => {
    localStorage.setItem('cvelocity:profile', profileEnvelope);
    localStorage.setItem(`cvelocity:vault:${id}`, vaultEnvelope);
  }, { id: profileId, profileEnvelope: envelope(profile), vaultEnvelope: envelope(completeVault) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Wklej ofert/ }).click();
  await page.locator('#saved-profile-job-description').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#saved-profile-job-description').fill(`IT Support Technician
Requirements
ServiceNow ticketing system.
Desirable
Exchange Online administration, PowerShell.
Bonus points
Intune device management.
Dodatkowe atuty
ITIL Foundation.
Forma zatrudnienia: Umowa o pracę lub kontrakt B2B.
Responsibilities
Jira and Docker configuration.`);
  await page.getByRole('button', { name: /Sprawd/ }).click();
  await page.getByRole('tab', { name: /Dopasowanie.*Rachunek/ }).waitFor({ state: 'visible', timeout: 15_000 });
  const completeBody = await page.locator('body').innerText();
  if (!completeBody.includes('Wynik wstępny — ograniczone dane') ||
      !/(?:[5-9]\d|100)% sekcji uzupełnionych/.test(completeBody) ||
      !completeBody.includes('rozpoznano tylko 1 wymaganie')) {
    throw new Error('Pełniejszy profil z jednym rozpoznanym wymaganiem nadal dostaje kategoryczną etykietę.');
  }
  if (!/1\s*\/\s*1 wymagań znajduje potwierdzenie/i.test(completeBody)) {
    throw new Error('Scenariusz pełniejszego profilu nie zachował pojedynczego rozpoznanego wymagania.');
  }
  await page.screenshot({ path: 'docs/evidence/match-limited-evidence-2026-10-01.png', fullPage: true });
  console.log('Zrzut dowodowy ograniczonej liczby wymagań zapisany: docs/evidence/match-limited-evidence-2026-10-01.png');

  await page.getByRole('tab', { name: /Raport ATS & Wynik/ }).click();
  const simulatorLimitedBadge = page.getByText('Wynik wstępny: 84%', { exact: true }).last();
  await simulatorLimitedBadge.waitFor({ state: 'visible', timeout: 15_000 });
  if (!(await page.locator('body').innerText()).includes('rozpoznano tylko 1 wymaganie')) {
    throw new Error('Raport ATS nie pokazuje ograniczonej podstawy wyniku.');
  }
  const simulatorBody = await page.locator('body').innerText();
  if (!simulatorBody.includes('Nie wykryto braków w wymaganiach rozpoznanych przez Kierivo.') ||
      simulatorBody.includes('zawiera wszystkie kluczowe wymagania twarde')) {
    throw new Error('Raport ATS nadal przedstawia brak wykrytych luk jako potwierdzenie wszystkich wymagań oferty.');
  }
  await page.screenshot({ path: 'docs/evidence/ats-simulator-limited-evidence-2026-10-01.png', fullPage: true });
  await page.getByRole('tab', { name: /Dopasowanie.*Rachunek/ }).click();

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const homeEvidence = page.getByText('Wynik wstępny: 84%', { exact: true }).last();
  await homeEvidence.waitFor({ state: 'visible', timeout: 15_000 });
  const homeBody = await page.locator('body').innerText();
  if (!homeBody.includes('rozpoznano tylko 1 wymaganie') || !homeBody.includes('ocena Kierivo')) {
    throw new Error('Ekran Start zgubił ograniczony zakres danych ostatniego wyniku.');
  }
  await page.mouse.move(800, 120);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/evidence/home-limited-match-evidence-2026-10-01.png', fullPage: true });
  console.log('Zrzut ekranu Start z ograniczonym zakresem wyniku zapisany.');

  const rulesFixture = await page.evaluate(async (id) => {
    const { CANONICAL_ATS_SCORE_PROVENANCE } = await import('/src/types/index.ts');
    const { getAnalysisFreshness } = await import('/src/lib/analysisFreshness.ts');
    const key = `cvelocity:last-job-analysis:${id}`;
    const raw = localStorage.getItem(key);
    const vaultRaw = localStorage.getItem(`cvelocity:vault:${id}`);
    if (!raw || !vaultRaw) throw new Error('Brak rzeczywistego zapisu do kontroli wersji reguł.');
    const summary = JSON.parse(JSON.parse(raw).data);
    const savedVault = JSON.parse(JSON.parse(vaultRaw).data);
    if (summary.atsScoreProvenance !== CANONICAL_ATS_SCORE_PROVENANCE ||
        getAnalysisFreshness(summary, savedVault.updatedAt) !== 'current') {
      throw new Error('Nowa analiza nie zapisuje bieżącej wersji reguł i profilu.');
    }
    return { key, summary, vaultRaw };
  }, profileId);

  for (const scenario of [
    { id: 'old-rules', provenance: 'canonical-v1', notice: /Reguły analizy zmieniły się/ },
    { id: 'unknown-rules', provenance: undefined, notice: /Nie możemy potwierdzić wersji reguł/ },
    { id: 'unrecognized-rules', provenance: 'canonical-v999', notice: /Nie możemy potwierdzić wersji reguł/ },
  ]) {
    const saved = { ...rulesFixture.summary };
    if (scenario.provenance === undefined) delete saved.atsScoreProvenance;
    else saved.atsScoreProvenance = scenario.provenance;
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: rulesFixture.key, value: envelope(saved) });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText(scenario.notice).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByText('Wynik historyczny: 84%', { exact: true }).last().waitFor({ state: 'visible' });
    if (await page.getByText('Wynik wstępny: 84%', { exact: true }).count()) throw new Error('Stare reguły zachowały bieżącą interpretację.');
    const unchanged = await page.evaluate((id) => localStorage.getItem(`cvelocity:vault:${id}`), profileId);
    if (unchanged !== rulesFixture.vaultRaw) throw new Error('Scenariusz zmienił profil; nie dowodzi wpływu samych reguł.');
    await page.screenshot({ path: `docs/evidence/home-${scenario.id}-2026-10-02.png`, fullPage: true });
    console.log(`Start: ${scenario.id}, profil bez zmian, wynik historyczny.`);
  }
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: rulesFixture.key, value: envelope(rulesFixture.summary) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Wynik wstępny: 84%', { exact: true }).last().waitFor({ state: 'visible', timeout: 15_000 });
  if (await page.getByText(/Reguły analizy zmieniły się|Nie możemy potwierdzić wersji reguł/).count()) throw new Error('Bieżący wynik nadal ma ostrzeżenie o regułach.');

  // Edycja pola przez rzeczywisty formularz profilu musi utworzyć nową rewizję.
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  const jobTitle = page.getByRole('combobox', { name: /Tytuł Zawodowy/ });
  await jobTitle.waitFor({ state: 'visible', timeout: 15_000 });
  await jobTitle.fill('IT Support Technician — aktualizacja syntetyczna');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const staleAnalysisNotice = page.getByText(/Profil zmienił się po tej analizie/);
  await staleAnalysisNotice.waitFor({ state: 'visible', timeout: 15_000 });
  await page.screenshot({ path: 'docs/evidence/home-stale-analysis-2026-10-01.png', fullPage: true });
  console.log('Zrzut Start z nieaktualną analizą zapisany.');

  const unknownRevision = await page.evaluate((id) => {
    const summaryKey = `cvelocity:last-job-analysis:${id}`;
    const vaultKey = `cvelocity:vault:${id}`;
    const summaryRaw = localStorage.getItem(summaryKey);
    const vaultRaw = localStorage.getItem(vaultKey);
    if (!summaryRaw || !vaultRaw) return null;
    return {
      summaryKey,
      vaultKey,
      summary: JSON.parse(JSON.parse(summaryRaw).data),
      vault: JSON.parse(JSON.parse(vaultRaw).data),
    };
  }, profileId);
  if (!unknownRevision) throw new Error('Brak syntetycznej analizy do kontroli nieznanej rewizji.');
  // To samo, ale niekanoniczne oznaczenie czasu parsuje się jako data w części
  // środowisk; identyczne ciągi nie dowodzą tej samej rewizji profilu.
  unknownRevision.summary.profileUpdatedAt = '03/04/2020';
  unknownRevision.vault.updatedAt = '03/04/2020';
  await page.evaluate(({ summaryKey, summaryValue, vaultKey, vaultValue }) => {
    localStorage.setItem(summaryKey, summaryValue);
    localStorage.setItem(vaultKey, vaultValue);
  }, {
    summaryKey: unknownRevision.summaryKey,
    summaryValue: envelope(unknownRevision.summary),
    vaultKey: unknownRevision.vaultKey,
    vaultValue: envelope(unknownRevision.vault),
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText(/Nie możemy potwierdzić, na jakiej wersji profilu wykonano tę analizę/)
    .waitFor({ state: 'visible', timeout: 15_000 });
  await page.screenshot({ path: 'docs/evidence/home-analysis-freshness-unknown-2026-10-01.png', fullPage: true });
  console.log('Zrzut Start z nieznaną rewizją analizy zapisany.');

  if (process.env.AUDIT_HOME_ONLY === '1') {
    await context.close();
    await browser.close();
    process.exit(0);
  }

  const atsPage = await context.newPage();
  await atsPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await atsPage.getByRole('button', { name: /Otwórz wyszukiwarkę/ }).click();
  const commandPalette = atsPage.getByRole('dialog', { name: 'Paleta poleceń' });
  await commandPalette.getByRole('combobox', { name: /Szukaj poleceń/ }).fill('Laboratorium Audytu ATS');
  await commandPalette.getByRole('option', { name: /Laboratorium Audytu ATS 360/ }).click();
  const labOffer = atsPage.locator('#ats-lab-jd-textarea');
  await labOffer.waitFor({ state: 'visible', timeout: 15_000 });
  await labOffer.fill(`Specjalista IT Support
Requirements
ServiceNow ticketing system.
About us
We provide onboarding and a collaborative work environment for new employees.
The recruitment process includes a conversation with the team manager and recruiter.`);
  const limitedLabBadge = atsPage.getByText('Wynik wstępny — ograniczone dane', { exact: true });
  await limitedLabBadge.waitFor({ state: 'visible', timeout: 15_000 });
  const labBody = await atsPage.locator('body').innerText();
  if (!labBody.includes('Rozpoznano tylko 1 wymaganie')) {
    throw new Error('ATS Lab nie objaśnia wyniku przy jednym wymaganiu.');
  }
  await atsPage.screenshot({ path: 'docs/evidence/ats-lab-limited-evidence-2026-10-01.png', fullPage: true });
  console.log('Zrzut ATS Lab z ograniczoną liczbą wymagań zapisany: docs/evidence/ats-lab-limited-evidence-2026-10-01.png');

  const historyContext = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const historyPage = await historyContext.newPage();
  await historyPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await historyPage.keyboard.press('Escape');
  const historyMount = await historyPage.evaluate(async (savedVault) => {
    const [react, reactDom, { HistoricalDocumentModal }, { scoreCanonicalAts },
      { getAtsScoreContext }, { measureVaultCompleteness }, { hasCareerEvidence }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/tracker/HistoricalDocumentModal.tsx'),
      import('/src/lib/canonicalAts.ts'),
      import('/src/lib/atsScoreEvidence.ts'),
      import('/src/lib/vaultCompleteness.ts'),
      import('/src/lib/careerEvidence.ts'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const mount = document.createElement('div');
    mount.id = 'audit-history-modal';
    document.body.append(mount);
    const root = createRoot(mount);
    const canonical = scoreCanonicalAts(savedVault, 'Requirements\nServiceNow ticketing system.', 'IT Support Technician');
    if (canonical.score !== 84) throw new Error('Wynik syntetycznej analizy różni się od sprawdzanego 84%.');
    const application = {
      id: 'synthetic-history-one-requirement', company: 'Firma Testowa',
      position: 'IT Support Technician', salary: '', date: '2026-10-01',
      status: 'Do wysłania', atsScore: canonical.score, atsScoreProvenance: (await import('/src/types/index.ts')).CANONICAL_ATS_SCORE_PROVENANCE,
      atsScoreContext: getAtsScoreContext(canonical, measureVaultCompleteness(savedVault).percent, hasCareerEvidence(savedVault)),
    };
    root.render(createElement(HistoricalDocumentModal, {
      application, isOpen: true, onClose: () => {},
    }));
    window.__auditHistoryModal = { root, createElement, HistoricalDocumentModal, application };
    return true;
  }, completeVault);
  const historyModal = historyPage.locator('[role="dialog"]').last();
  await historyModal.getByText('Wynik wstępny: 84%', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
  if (!await historyModal.getByText(/rozpoznano tylko 1 wymaganie/).isVisible()) {
    throw new Error('Historia aplikacji nie zachowała informacji o ograniczonej podstawie wyniku.');
  }
  await historyPage.screenshot({ path: 'docs/evidence/application-history-limited-score-2026-10-01.png', fullPage: true });

  await historyPage.evaluate(() => {
    const { root, createElement, HistoricalDocumentModal, application } = window.__auditHistoryModal;
    root.render(createElement(HistoricalDocumentModal, {
      application: { ...application, id: 'synthetic-history-unknown-range', atsScoreContext: undefined },
      isOpen: true,
      onClose: () => {},
    }));
  });
  await historyModal.getByText('Wynik historyczny: 84%', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
  if (!await historyModal.getByText(/zakres tej oceny jest nieznany/).isVisible()) {
    throw new Error('Stary wynik bez kontekstu nie został oznaczony jako zakres nieznany.');
  }
  await historyPage.screenshot({ path: 'docs/evidence/application-history-unknown-score-context-2026-10-01.png', fullPage: true });

  await historyPage.evaluate(() => {
    const { root, createElement, HistoricalDocumentModal, application } = window.__auditHistoryModal;
    root.render(createElement(HistoricalDocumentModal, {
      application: { ...application, id: 'synthetic-history-old-rules', atsScoreProvenance: 'canonical-v1' },
      isOpen: true, onClose: () => {},
    }));
  });
  await historyModal.getByText(/Wynik obliczono wcześniejszymi regułami Kierivo/).waitFor({ state: 'visible', timeout: 15_000 });
  await historyModal.getByText('Wynik historyczny: 84%', { exact: true }).waitFor({ state: 'visible' });
  if (await historyModal.getByText('Wynik wstępny: 84%', { exact: true }).count()) throw new Error('Historia nadała starej liczbie bieżącą interpretację.');
  await historyPage.screenshot({ path: 'docs/evidence/application-history-old-rules-2026-10-02.png', fullPage: true });
  console.log('Historia: zachowana liczba 84%, wcześniejsze reguły jawnie oznaczone.');
  await historyContext.close();
  console.log('Zrzuty historycznego wyniku zapisane dla ograniczonego i nieznanego zakresu.');
  console.log('OK: atuty są widoczne oddzielnie, a wynik liczy tylko ServiceNow.');
  if (errors.length) throw new Error(`BĹ‚Ä™dy strony: ${errors.join(' | ')}`);
} catch (error) {
  console.error('Stan strony przy bĹ‚Ä™dzie:', (await page.locator('body').innerText().catch(() => '')).slice(0, 2500));
  await page.screenshot({ path: 'docs/evidence/optional-requirements-debug-2026-10-01.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
