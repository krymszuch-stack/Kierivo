/** E2E Audyt ATS - weryfikacja kart heurystycznych ze skalą wynik/100 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();

try {
  await page.goto(process.env.BASE_URL || 'http://localhost:3000');
  await page.locator('button[aria-haspopup="menu"]').click();
  await page.getByRole('button', { name: /Zaloguj się lub załóż konto|Utwórz profil lokalny/ }).click();
  await page.getByRole('button', { name: /Korzystaj bez logowania/ }).click();
  await page.getByRole('textbox', { name: 'Jak się do Ciebie zwracać' }).fill('Piotr Monter');
  await page.getByRole('button', { name: 'Zapisz profil' }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });

  // Uzupełnij profil faktami
  await page.getByRole('button', { name: /^Profil$/ }).click();
  await page.waitForTimeout(1000);

  const titleField = page.getByPlaceholder('np. Senior Frontend Architect');
  await titleField.fill('Monter instalacji sanitarnych i HVAC');

  // Doświadczenie
  await page.getByRole('button', { name: /Doświadczenie/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Dodaj pierwsze stanowisko' }).click();
  await page.getByPlaceholder('np. Szpital Wojewódzki, Mostostal S.A., Zakład Pracy...').fill('Hydro-Term Instalacje');
  await page.getByPlaceholder('np. Monter / Inżynier / Spawacz...').fill('Monter HVAC');
  await page.getByLabel('Data Rozpoczęcia (opcjonalne)').fill('01/2020');
  await page.getByLabel('Data Zakończenia (opcjonalne)').fill('12/2023');

  // Umiejętności
  await page.getByRole('button', { name: /Umiejętności/ }).first().click();
  await page.waitForTimeout(500);
  const skillInput = page.getByPlaceholder('Wpisz technologię (np. React, TypeScript, Docker, PostgreSQL) i naciśnij Enter...');
  await skillInput.fill('Instalacje HVAC');
  await page.getByRole('button', { name: 'Dodaj' }).first().click();
  await page.waitForTimeout(200);
  await skillInput.fill('Próby ciśnieniowe');
  await page.getByRole('button', { name: 'Dodaj' }).first().click();
  await page.waitForTimeout(200);
  await skillInput.fill('Zgrzewanie rur PP');
  await page.getByRole('button', { name: 'Dodaj' }).first().click();

  // Wpisz draft ogłoszenia do localStorage w poprawnej kopercie z sumą kontrolną FNV-1a
  await page.evaluate(() => {
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

    const rawProfile = localStorage.getItem('cvelocity:profile');
    console.log('rawProfile in LS:', rawProfile);
    let profileId = 'anonymous';
    try {
      if (rawProfile) {
        const p = JSON.parse(rawProfile);
        const data = p?.data ? JSON.parse(p.data) : p;
        if (data?.id) profileId = data.id;
      }
    } catch (e) {
      console.error(e);
    }
    console.log('Detected profileId:', profileId);

    const draft = {
      role: 'Monter instalacji sanitarnych i HVAC',
      jd: `Wymagania na stanowisko Monter HVAC:
- Doświadczenie na stanowisku monter instalacji sanitarnych lub HVAC (min. 3 lata)
- Znajomość zagadnień: instalacje HVAC, próby ciśnieniowe, montaż rurociągów
- Umiejętność zgrzewania rur PP
- Uprawnienia SEP G3 lub SEP G1`
    };

    const envelope = createEnvelope(draft);
    
    // Zapisz pod wszystkimi potencjalnymi wariantami klucza
    const keys = [
      `cvelocity:draft-ats-lab:${profileId}`,
      `cvelocity:draft-ats-lab:anonymous`,
      `cvelocity:draft-ats-lab`,
      `cvelocity_draft-ats-lab:${profileId}`,
      `cvelocity_draft-ats-lab:anonymous`
    ];
    for (const k of keys) {
      localStorage.setItem(k, envelope);
    }
  });

  // Przejdź do Audyt ATS klikając przycisk w menu bocznym
  await page.getByRole('button', { name: 'Audyt ATS' }).click();
  await page.waitForTimeout(2000);

  // Wypisz tekst widoku dla diagnozy
  const bodyText = await page.locator('main').innerText();
  console.log('Zawartość widoku po wejściu do Audyt ATS:', bodyText.slice(0, 400));

  // Sprawdź obecność sekcji profilów heurystycznych
  const profileSection = page.locator('#profile-heurystyczne');
  await profileSection.waitFor({ state: 'visible', timeout: 10000 });

  // Sprawdź czy widzimy karty ze skalą /100
  const sectionText = await profileSection.innerText();
  console.log('Sekcja profili heurystycznych:', sectionText);

  if (!sectionText.includes('/100')) {
    throw new Error('Sekcja profili heurystycznych nie zawiera skali /100!');
  }
  if (!sectionText.includes('Odczyt liniowy i struktura') || !sectionText.includes('Frazy i reguły logiczne')) {
    throw new Error('Brak wymaganych profili heurystycznych w sekcji.');
  }
  if (sectionText.includes('passProbability')) {
    throw new Error('Wykryto niedozwolone pole passProbability w widoku!');
  }

  // Przewiń do sekcji i zrób zrzut ekranu
  await profileSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'docs/audyt-ats-karty-liczbowe-2026-09-30.png', fullPage: false });
  console.log('Zrzut ekranu kart liczbowych ATS zapisany: docs/audyt-ats-karty-liczbowe-2026-09-30.png');
} finally {
  await context.close();
  await browser.close();
}
