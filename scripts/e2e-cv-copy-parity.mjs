/** E2E: tekst skopiowany z Generatora odpowiada temu samemu dokumentowi CV. */
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3042';
const SCREENSHOT_PATH = 'docs/evidence/cv-copy-parity-2026-10-02.png';

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

const profileId = 'local-cv-copy-parity-proof';
const profile = {
  id: profileId,
  name: 'Synthetic CV Copy Proof',
  type: 'local',
  createdAt: '2026-10-02T00:00:00.000Z',
};
const vault = {
  version: '1.0.0',
  updatedAt: '2026-10-02T00:00:00.000Z',
  profiler: {
    flags: [], experienceLevel: 'MID',
    location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
    languages: [],
  },
  personalInfo: {
    fullName: 'Jan Testowy',
    email: 'jan.testowy@example.invalid',
    phone: '',
    location: 'Testowo',
    title: 'Bazowe stanowisko — kontrola',
    summary: 'Bazowe podsumowanie — kontrola.',
  },
  skillsMatrix: { hardSkills: ['Zendesk'], softSkills: [], toolsAndTech: [], certifications: [] },
  history: [{
    id: 'copy-proof-experience',
    company: 'Firma Testowa',
    role: 'IT Support Technician',
    location: 'Testowo',
    startDate: '2023-01',
    endDate: '2025-01',
    isCurrent: false,
    description: 'Obsługa zgłoszeń testowych — znacznik COPY-EXPERIENCE-ONLY.',
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
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
});
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE_URL).origin });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => {
  if (!/WebSocket closed without opened/i.test(String(error))) errors.push(String(error));
});

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ id, profileEnvelope, vaultEnvelope }) => {
    localStorage.clear();
    localStorage.setItem('cvelocity:profile', profileEnvelope);
    localStorage.setItem(`cvelocity:vault:${id}`, vaultEnvelope);
  }, {
    id: profileId,
    profileEnvelope: envelope(profile),
    vaultEnvelope: envelope(vault),
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: 'Wklej ofertę pracy', exact: true }).click();
  const offerInput = page.locator('#saved-profile-job-description');
  await offerInput.waitFor({ state: 'visible', timeout: 15_000 });
  await offerInput.fill('Stanowisko: IT Support Technician\nWymagania:\n- Zendesk');
  await page.getByRole('button', { name: 'Sprawdź ofertę' }).click();

  const overview = page.getByRole('tab', { name: 'Dopasowanie & Rachunek' });
  await overview.waitFor({ state: 'visible', timeout: 15_000 });
  const goToGenerator = page.getByRole('button', { name: /Przejdź do Generatora CV/ });
  await goToGenerator.waitFor({ state: 'visible', timeout: 15_000 });
  await goToGenerator.click();

  const copyButton = page.getByRole('button', { name: 'Kopiuj treść dokumentu do schowka', exact: true });
  await copyButton.waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByText('IT Support Technician', { exact: true }).first().waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText('COPY-EXPERIENCE-ONLY', { exact: false }).waitFor({ state: 'visible', timeout: 10_000 });

  await page.bringToFront();
  await copyButton.click();
  const copyOutcome = await page.waitForFunction(() => {
    const button = document.querySelector('button[aria-label="Kopiuj treść dokumentu do schowka"]');
    if (button?.textContent?.includes('Skopiowano!')) return 'success';
    if (document.body.innerText.includes('Nie udało się skopiować CV')) return 'error';
    return false;
  }, null, { timeout: 5_000 }).then((handle) => handle.jsonValue());
  if (copyOutcome === 'error') {
    const copyDetail = await page.getByRole('status').innerText().catch(() => '');
    throw new Error(`Przeglądarka odrzuciła zapis schowka: ${copyDetail}`);
  }
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  const copiedText = await page.evaluate(() => navigator.clipboard.readText());
  for (const marker of [
    'IT Support Technician',
    'Jan Testowy',
    'jan.testowy@example.invalid',
    'Zendesk',
    'COPY-EXPERIENCE-ONLY',
  ]) {
    if (!copiedText.includes(marker)) throw new Error(`Skopiowany tekst nie zawiera widocznego faktu: ${marker}`);
  }
  if (!copiedText.includes('Bazowe podsumowanie — kontrola.')) {
    throw new Error('Skopiowany tekst nie zawiera widocznego, bazowego podsumowania CV.');
  }
  if (copiedText.includes('Bazowe stanowisko — kontrola')) {
    throw new Error('Skopiowany tekst użył bazowego tytułu zamiast roli docelowej.');
  }
  if (errors.length) throw new Error(`Błędy strony: ${errors.join(' | ')}`);

  console.log(`Zrzut: ${SCREENSHOT_PATH}`);
  console.log('OK: schowek zawiera docelową rolę i widoczne fakty CV, bez bazowego tytułu, z podsumowaniem widocznym w dokumencie.');
} catch (error) {
  console.error('Stan strony przy błędzie:', (await page.locator('body').innerText().catch(() => '')).slice(0, 2500));
  await page.screenshot({ path: 'docs/evidence/cv-copy-parity-debug-2026-10-02.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
