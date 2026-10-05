const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
let chromium;
try {
  const modPath = process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
  ({ chromium } = await import(modPath));
} catch {
  ({ chromium } = await import('playwright'));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

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

const profile = {
  id: 'audit-jd-optionality',
  name: 'Profil syntetyczny ATS',
  type: 'local',
  createdAt: '2026-10-01T00:00:00.000Z',
};
const vault = {
  version: '1.0.0',
  updatedAt: '2026-10-01T00:00:00.000Z',
  profiler: {
    flags: [], experienceLevel: 'MID',
    location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
    languages: [],
  },
  personalInfo: {
    fullName: profile.name,
    email: 'audit-jd-optionality@example.invalid',
    phone: '', location: '', title: 'IT Support Specialist',
    summary: 'Doświadczenie w obsłudze użytkowników, diagnozowaniu problemów i wsparciu IT.',
  },
  skillsMatrix: { hardSkills: [], softSkills: [], toolsAndTech: [], certifications: [] },
  history: [], education: [], projects: [],
};

try {
  await page.route('**/api/fetch-jd-url', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        url: 'https://example.invalid/jobs/technik-serwisu',
        finalUrl: 'https://example.invalid/jobs/technik-serwisu',
        title: 'Technik serwisu',
        company: '',
        descriptionRaw: 'Technik serwisu\nRequirements\nMiejsce pracy: Warszawa\nRequirements\nJavaScript is a plus.\nServiceNow is required.',
        location: '',
        salary: '',
        remote: false,
        skills: [],
        extraction: { tier: 'text', structured: false, fromCache: false },
      }),
    });
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ profileData, vaultData }) => {
    localStorage.clear();
    localStorage.setItem('cvelocity:local-profiles', profileData.list);
    localStorage.setItem('cvelocity:profile', profileData.active);
    localStorage.setItem(`cvelocity:vault:${profileData.id}`, vaultData);
  }, {
    profileData: {
      id: profile.id,
      list: envelope([profile]),
      active: envelope(profile),
    },
    vaultData: envelope(vault),
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Oferty' }).click();
  await page.getByRole('tab', { name: 'Tryb zaawansowany' }).click();
  await page.getByLabel('Adres URL Ogłoszenia Rekrutacyjnego').fill('https://example.invalid/jobs/technik-serwisu');
  await page.getByRole('button', { name: 'Pobierz i Dopasuj Ofertę' }).click();

  const heading = page.getByRole('heading', { name: 'Dopasowanie do oferty: Technik serwisu', exact: true });
  await heading.waitFor({ state: 'visible', timeout: 15_000 });
  check(await heading.count() === 1, 'nagłówek wyniku nie zawiera nazwy sekcji jako firmy');
  const body = await page.locator('body').innerText();
  check(body.includes('Trasa: → Warszawa'), 'jawna lokalizacja z treści nie trafia do danych oferty');
  check(body.includes('0 / 1'), 'opcjonalny JavaScript nadal zwiększa licznik obowiązkowych wymagań');
  const missingStart = body.indexOf('BRAKUJE (');
  const missingBlock = missingStart >= 0 ? body.slice(missingStart, missingStart + 100) : '';
  check(missingBlock.startsWith('BRAKUJE (1)\nServiceNow'), 'lista luk nie ogranicza się do obowiązkowego ServiceNow');
  await page.getByText('Brakuje (1)', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/evidence/jd-company-metadata-guard-2026-10-01.png', fullPage: true });
  console.log('Zapisano zrzut widoku analizy: JavaScript jako atut, ServiceNow jako jedyna luka i zachowana lokalizacja.');
} catch (error) {
  try {
    await page.screenshot({ path: 'docs/evidence/jd-company-metadata-guard-failed-2026-10-01.png', fullPage: true });
    console.error(`Treść ekranu przy błędzie E2E:\n${(await page.locator('body').innerText()).slice(0, 5000)}`);
  } catch {
    // Zachowaj pierwotny błąd, jeśli przeglądarka zdążyła się zamknąć.
  }
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`E2E nie przeszedł:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('E2E parsera firmy zakończyło się powodzeniem.');
