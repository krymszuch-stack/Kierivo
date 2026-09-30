/**
 * E2E Dodatkowe dowody:
 * 1. Pełny eksport z własnym osiągnięciem STAR w DocumentRenderer (docs/audyt-star-pelny-eksport-2026-09-30.png)
 * 2. Baner i modal porównania wersji CV przy konflikcie CAS (docs/audyt-konflikt-wersji-cv-2026-09-30.png)
 */
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs'
);

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();

try {
  console.log('1. Generowanie zrzutu pełnego podglądu CV z osiągnięciem STAR...');
  await page.goto(process.env.BASE_URL || 'http://localhost:3000');

  // Pomocnik FNV-1a dla koperty cvelocity
  function fnv1a(input) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function createEnvelope(value) {
    const dataString = JSON.stringify(value);
    return JSON.stringify({
      cvel: 2,
      crc: fnv1a(dataString),
      data: dataString,
    });
  }

  // Wstrzyknij profil lokalny z faktami i osiągnięciem STAR
  await page.evaluate(() => {
    function fnv1a(input) {
      let hash = 0x811c9dc5;
      for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    }
    function createEnvelope(val) {
      const s = JSON.stringify(val);
      return JSON.stringify({ cvel: 2, crc: fnv1a(s), data: s });
    }

    const profileId = 'user-star-proof';
    const profile = { id: profileId, name: 'Michał Spawacz-Monter', type: 'local', createdAt: new Date().toISOString() };
    localStorage.setItem('cvelocity:profile', createEnvelope(profile));
    localStorage.setItem('cvelocity:active_profile_id', createEnvelope(profileId));

    const vault = {
      personalInfo: {
        fullName: 'Michał Kowalski',
        email: 'michal.kowalski@example.pl',
        phone: '+48 601 234 567',
        city: 'Gdańsk',
        title: 'Spawacz TIG / Monter Instalacji Przemysłowych',
        summary: 'Doświadczony spawacz TIG i monter instalacji technologicznych z uprawnieniami SEP G3 i UDT.',
      },
      history: [
        {
          id: 'exp-star-1',
          company: 'Stocznia Północna S.A.',
          role: 'Spawacz TIG / Monter Rurociągów',
          startDate: '2020-01',
          endDate: '2024-06',
          current: false,
          description: 'Spawanie instalacji ciśnieniowych ze stali nierdzewnej pod nadzorem UDT i DNV.',
          highlights: [
            'Własne osiągnięcie STAR: Samodzielne zrealizowanie 120 spoin rurociągów chłodniczych z wynikiem 100% pozytywnych badań rentgenowskich (RTD) bez poprawek.',
            'Optymalizacja czasu montażu kolektorów parowych o 15% przy zachowaniu pełnej zgodności z procedurą WPS.',
          ],
        },
      ],
      education: [
        {
          id: 'edu-1',
          school: 'Technikum Mechaniczne w Gdańsku',
          degree: 'Technik Mechanik',
          field: 'Budowa Maszyn',
          startDate: '2015-09',
          endDate: '2019-06',
          current: false,
        },
      ],
      skills: [
        { id: 'sk-1', name: 'Spawanie TIG (141)', category: 'hard' },
        { id: 'sk-2', name: 'Spawanie MAG (135)', category: 'hard' },
        { id: 'sk-3', name: 'Rysunek izometryczny', category: 'hard' },
        { id: 'sk-4', name: 'Próby ciśnieniowe', category: 'hard' },
      ],
      formalQualifications: [
        { id: 'fq-1', qualificationId: 'welding_tig', name: 'Uprawnienia spawalnicze TIG 141 (UDT)', issuedDate: '2021-03' },
        { id: 'fq-2', qualificationId: 'sep_g3_e', name: 'SEP G3 E — eksploatacja urządzeń gazowych', issuedDate: '2022-05' },
      ],
      projects: [],
      languages: [{ id: 'lang-1', name: 'Angielski', level: 'B1' }],
      drivingLicenses: ['B'],
      targetRoles: ['Spawacz TIG', 'Monter rurociągów'],
    };

    localStorage.setItem(`cvelocity:vault:${profileId}`, createEnvelope(vault));
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Otwórz Generator gotowego CV z paska bocznego
  const cvBtn = page.getByRole('button', { name: 'Generator CV' }).first();
  await cvBtn.waitFor({ state: 'visible', timeout: 10000 });
  await cvBtn.click();

  // Poczekaj na modal generatora
  const modal = page.locator('[role="dialog"]').filter({ hasText: /Generator gotowego CV/i });
  await modal.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(2000);

  // Wykonaj zrzut pełnego podglądu z własnym osiągnięciem STAR
  await page.screenshot({
    path: 'docs/audyt-star-pelny-eksport-2026-09-30.png',
  });
  console.log('  Zapisano: docs/audyt-star-pelny-eksport-2026-09-30.png');

  // Zamknij modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 2. Generowanie zrzutu widoku konfliktu synchronizacji i porównania wersji CV
  console.log('2. Generowanie zrzutu widoku konfliktu synchronizacji CAS...');
  await page.evaluate(() => {
    function fnv1a(input) {
      let hash = 0x811c9dc5;
      for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    }
    function createEnvelope(val) {
      const s = JSON.stringify(val);
      return JSON.stringify({ cvel: 2, crc: fnv1a(s), data: s });
    }

    const cloudUser = {
      id: 'user-cloud-conflict-proof',
      name: 'Marek Nowak',
      email: 'marek.nowak@example.pl',
      type: 'cloud',
      createdAt: '2026-09-01T10:00:00.000Z',
    };
    localStorage.setItem('cvelocity:profile', createEnvelope(cloudUser));
    localStorage.setItem('cvelocity:active_profile_id', createEnvelope(cloudUser.id));

    // Symuluj stan outboxa z konfliktem zapisu CAS
    const conflictState = {
      ownerId: cloudUser.id,
      localVault: {
        personalInfo: { fullName: 'Marek Nowak', title: 'Monter Konstrukcji Stalowych (Wersja Lokalna)' },
        history: [{ id: 'h1', company: 'Mont-Stal', role: 'Monter' }],
        education: [{ id: 'e1', school: 'ZSZ Mechaniczne' }],
        projects: [],
      },
      remoteVault: {
        personalInfo: { fullName: 'Marek Nowak', title: 'Monter Konstrukcji i Dźwigów (Wersja z Chmury)' },
        history: [{ id: 'h1', company: 'Mont-Stal', role: 'Starszy Monter' }, { id: 'h2', company: 'Mostostal', role: 'Monter' }],
        education: [{ id: 'e1', school: 'ZSZ Mechaniczne' }],
        projects: [{ id: 'p1', name: 'Hala magazynowa 5000m2' }],
      },
      remoteUpdatedAt: '2026-09-30T04:00:00.000Z',
    };

    localStorage.setItem(`cvelocity:cloud-vault-conflict:${cloudUser.id}`, createEnvelope(conflictState));
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Sprawdź czy baner konfliktu jest widoczny
  const compareBtn = page.getByRole('button', { name: /Porównaj wersje CV/i });
  if (await compareBtn.count() > 0) {
    await compareBtn.click();
    await page.waitForTimeout(800);
  }

  await page.screenshot({
    path: 'docs/audyt-konflikt-wersji-cv-2026-09-30.png',
  });
  console.log('  Zapisano: docs/audyt-konflikt-wersji-cv-2026-09-30.png');

  console.log('Wszystkie dodatkowe dowody zostały wygenerowane pomyślnie.');
} catch (err) {
  console.error('Błąd podczas generowania dowodów:', err);
  process.exit(1);
} finally {
  await browser.close();
}
