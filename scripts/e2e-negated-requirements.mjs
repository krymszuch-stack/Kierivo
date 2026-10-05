/** Dowód ekranowy: jawnie zaprzeczone kryteria nie stają się wymaganiami oferty. */
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3042';
const SCREENSHOT_PATH = 'docs/evidence/jd-negated-requirement-2026-10-01.png';
const DETAILS_SCREENSHOT_PATH = 'docs/evidence/jd-negated-requirement-details-2026-10-01.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);

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

const profileId = 'local-negated-requirement-proof';
const profile = { id: profileId, name: 'Synthetic Negation Proof', type: 'local', createdAt: '2026-10-01T00:00:00.000Z' };
const vault = {
  version: '1.0.0', updatedAt: '2026-10-01T00:00:00.000Z',
  profiler: { flags: [], experienceLevel: 'MID', location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false }, languages: [] },
  personalInfo: { fullName: 'Jan Testowy', email: 'jan.testowy@example.invalid', phone: '', location: '', title: 'Specjalista terenowy', summary: 'Syntetyczny profil do kontroli zaprzeczeń wymagań.' },
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
  if (!/WebSocket closed without opened/i.test(String(error))) errors.push(String(error));
});

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ id, profileEnvelope, vaultEnvelope }) => {
    localStorage.setItem('cvelocity:profile', profileEnvelope);
    localStorage.setItem(`cvelocity:vault:${id}`, vaultEnvelope);
  }, { id: profileId, profileEnvelope: envelope(profile), vaultEnvelope: envelope(vault) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Wklej ofertę pracy/ }).click();
  const offerInput = page.locator('#saved-profile-job-description');
  await offerInput.waitFor({ state: 'visible', timeout: 15_000 });
  await offerInput.fill(`Specjalista terenowy
Wymagania
Prawo jazdy kat. B nie jest wymagane.
Angielski nie jest wymagany.
Minimum 3 lata doświadczenia nie jest wymagane.
No requirement for PowerShell.
AWS is not necessary.
JavaScript is not needed.
ServiceNow jest wymagany.`);
  await page.getByRole('button', { name: 'Sprawdź ofertę' }).click();
  await page.getByRole('tab', { name: /Dopasowanie.*Rachunek/ }).waitFor({ state: 'visible', timeout: 15_000 });
  const body = await page.locator('body').innerText();
  if (!body.includes('ServiceNow')) throw new Error('Pozytywne wymaganie ServiceNow zniknęło z wyniku.');
  if (/Prawo jazdy kat\.? B|Angielski|English|Min\.? 3 lata doświadczenia|PowerShell|AWS|JavaScript/i.test(body)) {
    throw new Error('Co najmniej jedno jawnie zaprzeczone kryterium nadal pojawia się w podsumowaniu.');
  }
  if (!/0\s*\/\s*1 wymagań znajduje potwierdzenie/i.test(body)) {
    throw new Error('Licznik powinien uwzględnić tylko jedno pozytywne wymaganie: ServiceNow.');
  }
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  const missingHeading = page.getByText('Brakuje (1)', { exact: true });
  await missingHeading.scrollIntoViewIfNeeded();
  await page.screenshot({ path: DETAILS_SCREENSHOT_PATH, fullPage: true });
  console.log(`Zrzut dowodowy zapisany: ${SCREENSHOT_PATH}`);
  console.log(`Zrzut listy jedynego prawdziwego braku zapisany: ${DETAILS_SCREENSHOT_PATH}`);
  console.log('OK: kryteria zaprzeczone nie są prezentowane jako wymagania; ServiceNow pozostaje widocznym wymogiem.');
  if (errors.length) throw new Error(`Błędy strony: ${errors.join(' | ')}`);
} catch (error) {
  console.error('Stan strony przy błędzie:', (await page.locator('body').innerText().catch(() => '')).slice(0, 2500));
  await page.screenshot({ path: 'docs/evidence/jd-negated-requirement-debug-2026-10-01.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
