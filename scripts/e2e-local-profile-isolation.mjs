/** E2E: wznowienie dwóch zapisanych profili lokalnych bez przenikania ich Vaultów. */
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const PROFILE_A_SCREENSHOT = 'docs/evidence/local-profile-a-2026-10-02.png';
const PROFILE_B_SCREENSHOT = 'docs/evidence/local-profile-b-2026-10-02.png';

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

const profileA = {
  id: 'local-isolation-a',
  name: 'Alicja Profil A',
  type: 'local',
  createdAt: '2026-10-01T00:00:00.000Z',
};
const profileB = {
  id: 'local-isolation-b',
  name: 'Bartosz Profil B',
  type: 'local',
  createdAt: '2026-10-02T00:00:00.000Z',
};

function vaultFor(profile, marker) {
  return {
    version: '1.0.0',
    updatedAt: '2026-10-01T00:00:00.000Z',
    profiler: {
      flags: [], experienceLevel: 'MID',
      location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
      languages: [],
    },
    personalInfo: {
      fullName: profile.name,
      email: `${profile.id}@example.invalid`,
      phone: '', location: '', title: `Synthetic ${marker} role`, summary: `Only ${marker} summary.`,
    },
    skillsMatrix: {
      hardSkills: [marker], softSkills: [], toolsAndTech: [], certifications: [],
    },
    history: [], education: [], projects: [],
  };
}

const vaultA = vaultFor(profileA, 'MARKER-A-ONLY');
const vaultB = vaultFor(profileB, 'MARKER-B-ONLY');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => {
  // Wspólny host Vite może zamknąć WebSocket HMR; pozostałe błędy strony są failami testu.
  if (!/WebSocket closed without opened/i.test(String(error))) errors.push(String(error));
});

async function assertActiveProfile(profile, marker) {
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('heading', { name: 'Profil', exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByText(profile.name, { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
  const visibleText = await page.locator('body').innerText();
  if (!visibleText.includes(marker)) throw new Error(`Aktywny profil ${profile.id} nie pokazuje swojego znacznika.`);
  const otherMarker = marker === 'MARKER-A-ONLY' ? 'MARKER-B-ONLY' : 'MARKER-A-ONLY';
  if (visibleText.includes(otherMarker)) throw new Error(`Dane ${otherMarker} przeniknęły do widoku ${profile.id}.`);
}

async function savedProfileButton(profile) {
  const exact = page.getByRole('button', { name: profile.name, exact: true });
  // Identyfikator pojawia siÄ™ w dostÄ™pnej nazwie dopiero przy powtĂłrzonej nazwie;
  // test wybiera pierwszy wiersz, a asercja znacznika weryfikuje jego Vault.
  return (await exact.count()) === 1
    ? exact
    : page.getByText(profile.name, { exact: true }).first().locator('xpath=ancestor::button');
}

async function closeActiveProfileAndOpenChooser() {
  const accountButton = page.locator('button[aria-haspopup="menu"]');
  await accountButton.click();
  await page.getByRole('button', { name: 'Zamknij profil', exact: true }).click();
  await page.locator('button[aria-haspopup="menu"]').click();
  await page.getByRole('menu').getByRole('button', { name: /Utwórz profil lokalny|Zaloguj się lub załóż konto/ }).click();
  await page.getByText('Wznów zapisany profil lokalny', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
}

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ profiles, active, vaults }) => {
    // Poprzednia próba mogła zostawić syntetyczne profile pod tym samym localhostem.
    localStorage.clear();
    localStorage.setItem('cvelocity:local-profiles', profiles);
    localStorage.setItem('cvelocity:profile', active);
    for (const [id, value] of Object.entries(vaults)) localStorage.setItem(`cvelocity:vault:${id}`, value);
  }, {
    profiles: envelope([profileA, profileB]),
    active: envelope(profileA),
    vaults: {
      [profileA.id]: envelope(vaultA),
      [profileB.id]: envelope(vaultB),
    },
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await assertActiveProfile(profileA, 'MARKER-A-ONLY');
  await page.screenshot({ path: PROFILE_A_SCREENSHOT, fullPage: true });

  await closeActiveProfileAndOpenChooser();
  await (await savedProfileButton(profileB)).click();
  await page.getByText('Profil lokalny wznowiony').waitFor({ state: 'visible', timeout: 10_000 });
  await assertActiveProfile(profileB, 'MARKER-B-ONLY');
  await page.screenshot({ path: PROFILE_B_SCREENSHOT, fullPage: true });

  // Po odświeżeniu nadal ma być otwarty ten sam profil, bez odczytu Vaultu A.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assertActiveProfile(profileB, 'MARKER-B-ONLY');

  await closeActiveProfileAndOpenChooser();
  await (await savedProfileButton(profileA)).click();
  await page.getByText('Profil lokalny wznowiony').waitFor({ state: 'visible', timeout: 10_000 });
  await assertActiveProfile(profileA, 'MARKER-A-ONLY');

  const stored = await page.evaluate(({ a, b }) => ({
    activeId: JSON.parse(localStorage.getItem('cvelocity:profile') || 'null')?.data
      ? JSON.parse(JSON.parse(localStorage.getItem('cvelocity:profile')).data).id
      : null,
    a: localStorage.getItem(`cvelocity:vault:${a}`),
    b: localStorage.getItem(`cvelocity:vault:${b}`),
  }), { a: profileA.id, b: profileB.id });
  if (stored.activeId !== profileA.id || !stored.a?.includes('MARKER-A-ONLY') || !stored.b?.includes('MARKER-B-ONLY')) {
    throw new Error('Przełączenie zmieniło lub utraciło dane źródłowe jednego z profili.');
  }
  if (errors.length) throw new Error(`Błędy strony: ${errors.join(' | ')}`);

  console.log(`Zrzuty: ${PROFILE_A_SCREENSHOT}, ${PROFILE_B_SCREENSHOT}`);
  console.log('OK: A → B → odświeżenie → A; Vaulty i znaczniki pozostały rozdzielone.');
} catch (error) {
  console.error('Stan strony przy błędzie:', (await page.locator('body').innerText().catch(() => '')).slice(0, 2500));
  await page.screenshot({ path: 'docs/evidence/local-profile-isolation-debug-2026-10-01.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
