/** E2E regresji: zastosowana sugestia pozostaje widoczna i można ją cofnąć. */
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3042';
const SCREENSHOT_PATH = 'docs/evidence/suggestion-undo-applied-2026-10-02.png';
const UNDONE_SCREENSHOT_PATH = 'docs/evidence/suggestion-undo-restored-2026-10-02.png';

let chromium;
try {
  const modulePath = process.env.PLAYWRIGHT_MODULE ||
    'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
  ({ chromium } = await import(modulePath));
} catch {
  console.error('Brak Playwright. Ustaw PLAYWRIGHT_MODULE na lokalny moduł Playwright.');
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

const profileId = 'local-suggestion-undo-proof';
const profile = {
  id: profileId,
  name: 'Synthetic Suggestion Proof',
  type: 'local',
  createdAt: '2026-10-01T00:00:00.000Z',
};
const vault = {
  version: '1.0.0',
  updatedAt: '2026-10-01T00:00:00.000Z',
  profiler: {
    flags: [],
    experienceLevel: 'MID',
    location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
    languages: [],
  },
  personalInfo: {
    fullName: 'Jan Testowy',
    email: 'jan.testowy@example.invalid',
    phone: '',
    location: '',
    title: 'IT Support Technician',
    summary: 'Syntetyczny profil testowy wsparcia IT.',
  },
  skillsMatrix: { hardSkills: [], softSkills: [], toolsAndTech: [], certifications: [] },
  history: [{
    id: 'experience-synthetic-zendesk',
    company: 'Firma Testowa',
    role: 'IT Support Technician',
    location: '',
    startDate: '2023-01',
    endDate: '2025-01',
    isCurrent: false,
    description: 'Obsługa systemu Zendesk w syntetycznych zgłoszeniach testowych.',
    highlights: [],
  }],
  education: [],
  projects: [],
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
  // Wspólny host Vite może zamknąć WebSocket HMR; nie jest to błąd testowanego przepływu.
  if (!/WebSocket closed without opened/i.test(String(error))) errors.push(String(error));
});

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ profileId: id, profileEnvelope, vaultEnvelope }) => {
    localStorage.setItem('cvelocity:profile', profileEnvelope);
    localStorage.setItem(`cvelocity:vault:${id}`, vaultEnvelope);
  }, {
    profileId,
    profileEnvelope: envelope(profile),
    vaultEnvelope: envelope(vault),
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  const sourceVaultBefore = await page.evaluate((id) => localStorage.getItem(`cvelocity:vault:${id}`), profileId);
  if (!sourceVaultBefore) throw new Error('Syntetyczny Vault źródłowy nie został zapisany.');

  await page.getByRole('button', { name: 'Wklej ofertę pracy', exact: true }).click();
  const offerInput = page.locator('#saved-profile-job-description');
  await offerInput.waitFor({ state: 'visible', timeout: 15_000 });
  await offerInput.fill('Stanowisko: IT Support Technician\nWymagania:\n- Zendesk');
  await page.getByRole('button', { name: 'Sprawdź ofertę' }).click();

  const overview = page.getByRole('tab', { name: 'Dopasowanie & Rachunek' });
  await overview.waitFor({ state: 'visible', timeout: 15_000 });
  const overviewText = await page.locator('body').innerText();
  if (!overviewText.includes('Wynik wstępny') || /Wysokie dopasowanie|Świetne dopasowanie/.test(overviewText)) {
    throw new Error('Niepełny profil nadal otrzymuje kategoryczną etykietę dopasowania.');
  }
  await page.getByText('Dodaj punkt do CV', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
  const applyButton = page.getByRole('button', { name: 'Dodaj punkt do CV', exact: true });
  await applyButton.click();

  const undoButton = page.getByRole('button', { name: 'Cofnij zmianę', exact: true });
  await undoButton.waitFor({ state: 'visible', timeout: 10_000 });
  const skipButton = page.getByRole('button', { name: 'Pomiń', exact: true });
  if (!(await skipButton.isDisabled())) throw new Error('Pomiń pozostaje aktywne po zastosowaniu sugestii.');
  if (!(await undoButton.isEnabled())) throw new Error('Po zastosowaniu sugestii nie ma aktywnego cofnięcia.');
  const sourceVaultAfterApply = await page.evaluate((id) => localStorage.getItem(`cvelocity:vault:${id}`), profileId);
  if (sourceVaultAfterApply !== sourceVaultBefore) throw new Error('Zastosowanie sugestii zmieniło źródłowy Vault.');

  await undoButton.scrollIntoViewIfNeeded();
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log(`Zrzut dowodowy zapisany: ${SCREENSHOT_PATH}`);
  console.log('OK: po zastosowaniu Pomiń jest wyłączone, a Cofnij zmianę pozostaje dostępne.');

  await undoButton.click();
  await applyButton.waitFor({ state: 'visible', timeout: 10_000 });
  if (await skipButton.isDisabled()) throw new Error('Pomiń pozostało wyłączone po cofnięciu sugestii.');
  await page.getByText(/Cofnięto zmianę/).waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByText('Dodano do wersji CV', { exact: true }).waitFor({ state: 'hidden', timeout: 8_000 });
  const sourceVaultAfterUndo = await page.evaluate((id) => localStorage.getItem(`cvelocity:vault:${id}`), profileId);
  if (sourceVaultAfterUndo !== sourceVaultBefore) throw new Error('Cofnięcie sugestii zmieniło źródłowy Vault.');
  await applyButton.scrollIntoViewIfNeeded();
  await page.screenshot({ path: UNDONE_SCREENSHOT_PATH, fullPage: true });
  console.log(`Zrzut po cofnięciu zapisany: ${UNDONE_SCREENSHOT_PATH}`);
  console.log('OK: cofnięcie przywraca przycisk Dodaj punkt do CV i ponownie pozwala pominąć sugestię.');

  if (errors.length) throw new Error(`Błędy strony: ${errors.join(' | ')}`);
} catch (error) {
  console.error('Stan strony przy błędzie:', (await page.locator('body').innerText().catch(() => '')).slice(0, 2500));
  await page.screenshot({ path: 'docs/evidence/suggestion-undo-debug-2026-10-02.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
