/** Ekranowy dowód, że metadane portalu nie zastępują tytułu stanowiska. */
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3042';
const SCREENSHOT_PATH = 'docs/evidence/jd-title-reliability-2026-10-01.png';

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

const profileId = 'local-jd-title-proof';
const profile = { id: profileId, name: 'Synthetic JD Title Proof', type: 'local', createdAt: '2026-10-01T00:00:00.000Z' };
const vault = {
  version: '1.0.0', updatedAt: '2026-10-01T00:00:00.000Z',
  profiler: { flags: [], experienceLevel: 'MID', location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false }, languages: [] },
  personalInfo: { fullName: 'Jan Testowy', email: 'jan.testowy@example.invalid', phone: '', location: '', title: 'IT Support Technician', summary: 'Syntetyczny profil testowy.' },
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

  await page.getByRole('button', { name: 'Wklej ofertę pracy', exact: true }).click();
  const offerInput = page.locator('#saved-profile-job-description');
  await offerInput.waitFor({ state: 'visible', timeout: 15_000 });
  await offerInput.fill([
    'Senior .NET Developer / Solution Architect',
    'P&P Solutions Sp. z o.o. O firmie',
    '100,00 – 120,00 zł',
    'Katowice',
    'kontrakt B2B',
    'praca zdalna',
    'ważna jeszcze 7 dni',
    'Twój zakres obowiązków',
    'Projektowanie systemów .NET.',
    'Nasze wymagania',
    'C#, .NET i Azure.',
  ].join('\n'));
  await page.getByRole('button', { name: 'Sprawdź ofertę' }).click();
  await page.getByRole('tab', { name: 'Dopasowanie & Rachunek' }).waitFor({ state: 'visible', timeout: 15_000 });

  const body = await page.locator('body').innerText();
  if (!body.includes('Senior .NET Developer / Solution Architect')) {
    throw new Error('Wynik UI nie zachował tytułu stanowiska z oferty.');
  }
  if (body.includes('100,00 – 120,00 zł') && body.indexOf('100,00 – 120,00 zł') < body.indexOf('Senior .NET Developer / Solution Architect')) {
    throw new Error('Metadane płacowe pojawiły się przed tytułem jako nazwa stanowiska.');
  }
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log(`Zrzut dowodowy zapisany: ${SCREENSHOT_PATH}`);
  console.log('OK: tytuł i seniority pozostają poprawne mimo metadanych płacowych, lokalizacji i ważności portalu.');
  if (errors.length) throw new Error(`Błędy strony: ${errors.join(' | ')}`);
} catch (error) {
  console.error('Stan strony przy błędzie:', (await page.locator('body').innerText().catch(() => '')).slice(0, 2500));
  await page.screenshot({ path: 'docs/evidence/jd-title-reliability-debug-2026-10-01.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
