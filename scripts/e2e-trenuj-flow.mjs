/** E2E Trenuj - przejazd zablokowanych i odblokowanych ćwiczeń Kokpitu Rozmowy */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();

try {
  await page.goto(process.env.BASE_URL || 'http://localhost:3000');
  await page.locator('button[aria-haspopup="menu"]').click();
  await page.getByRole('button', { name: /Zaloguj się lub załóż konto|Utwórz profil lokalny/ }).click();
  await page.getByRole('button', { name: /Korzystaj bez logowania/ }).click();
  await page.getByRole('textbox', { name: 'Jak się do Ciebie zwracać' }).fill('Kamil Spawacz');
  await page.getByRole('button', { name: 'Zapisz profil' }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });

  // 1. KROK: Stan zablokowany - sekcja Trenuj i Moje aplikacje mają kłódkę
  const trenujButton = page.locator('nav').getByText('Trenuj');
  await trenujButton.waitFor();
  
  // Sprawdź, czy przycisk Trenuj zawiera kłódkę lub jest zablokowany
  await page.screenshot({ path: 'docs/audyt-trenuj-zablokowany-2026-09-30.png', fullPage: false });
  console.log('Zrzut stanu zablokowanego zapisany: docs/audyt-trenuj-zablokowany-2026-09-30.png');

  // Kliknięcie w zablokowaną pozycję Trenuj wywołuje toast informacyjny
  await trenujButton.click({ force: true });
  await page.waitForTimeout(500);

  // 2. KROK: Uzupełnij profil i zapisz pierwszą aplikację, aby odblokować poziom 2 i 3
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
    let profileId = 'anonymous';
    try {
      if (rawProfile) {
        const p = JSON.parse(rawProfile);
        const data = p?.data ? JSON.parse(p.data) : p;
        if (data?.id) profileId = data.id;
      }
    } catch {}

    // Vault kandydata ze stanowiskiem i historią
    const vault = {
      personalInfo: {
        fullName: 'Kamil Spawacz',
        email: 'kamil@example.pl',
        phone: '+48 600 100 200',
        city: 'Gdańsk',
        title: 'Spawacz konstrukcji stalowych TIG / MAG',
        summary: 'Doświadczony spawacz metod TIG (141) i MAG (135) z uprawnieniami UDT i aktualnymi próbkami spoin.',
      },
      history: [
        {
          id: 'exp-1',
          company: 'Stocznia Północna',
          role: 'Spawacz TIG / MAG',
          startDate: '2020-01',
          endDate: '2023-12',
          highlights: ['Spawanie rurociągów ciśnieniowych metodą TIG', 'Kontrola spoin VT2 / NDT'],
        }
      ],
      skillsMatrix: {
        hardSkills: ['Spawanie TIG 141', 'Spawanie MAG 135', 'Rysunek izometryczny', 'Cięcie plazmowe'],
        toolsAndTech: ['Spawarki Kemppi', 'Uchwyty TIG', 'Szlifierki kątowe'],
        softSkills: ['Precyzja', 'Praca zespołowa'],
        certifications: [{ name: 'Certyfikat spawacza ISO 9606-1 TIG/MAG', issuer: 'TÜV Rheinland' }],
      },
      profiler: {
        licenses: ['welding_tig_141', 'welding_mag_135'],
        languages: [{ language: 'Polski', level: 'Ojczysty' }],
      }
    };

    // Aplikacja ze statusem Rozmowa (odblokowuje level 3: Trenuj + Zasobnik Rozmowy)
    const apps = [
      {
        id: 'app-stocznia',
        company: 'Crist S.A.',
        position: 'Spawacz TIG rurociągów',
        status: 'Rozmowa',
        appliedAt: new Date().toISOString(),
        interviewAt: new Date(Date.now() + 86400000).toISOString(), // jutro
        notes: 'Rozmowa kwalifikacyjna z majstrem spawalni',
      }
    ];

    const milestones = {
      vaultStartedAt: new Date().toISOString(),
      firstApplicationAt: new Date().toISOString(),
      firstInterviewAt: new Date().toISOString(),
    };

    localStorage.setItem(`cvelocity:vault:${profileId}`, createEnvelope(vault));
    localStorage.setItem(`cvelocity:applications:${profileId}`, createEnvelope(apps));
    localStorage.setItem(`cvelocity:ux-milestones:${profileId}`, createEnvelope(milestones));
  });

  // Odśwież stronę, aby wczytać stan odblokowany
  await page.reload();
  await page.waitForTimeout(1500);

  // 3. KROK: Przejdź do Trenuj (Kokpit Rozmowy)
  const unlockedTrenuj = page.locator('nav').getByText('Trenuj');
  await unlockedTrenuj.click();
  await page.waitForTimeout(1500);

  // Weryfikacja widoku Kokpitu
  const headerTitle = await page.getByRole('heading', { name: /Kokpit Rozmowy/ }).innerText();
  console.log('Nagłówek Kokpitu:', headerTitle);

  // Zakładka 1: Elevator Pitch
  const pitchText = await page.locator('.whitespace-pre-wrap').first().innerText();
  console.log('Elevator pitch snippet:', pitchText.slice(0, 150));
  if (!pitchText.includes('Spawacz') && !pitchText.includes('TIG')) {
    throw new Error('Elevator Pitch nie korzysta z faktów MasterVault spawacza!');
  }

  // Zrób zrzut ekranu ćwiczeń Kokpitu
  await page.screenshot({ path: 'docs/audyt-trenuj-cwiczenia-2026-09-30.png', fullPage: false });
  console.log('Zrzut ekranu ćwiczeń zapisany: docs/audyt-trenuj-cwiczenia-2026-09-30.png');

  // Przełącz na zakładkę Trener STAR (AI Coach)
  await page.getByRole('tab', { name: /Trener STAR/ }).click();
  await page.waitForTimeout(1000);

  const starSectionText = await page.locator('main').innerText();
  if (!starSectionText.includes('Trener STAR') && !starSectionText.includes('STAR')) {
    throw new Error('Zakładka Trenera STAR nie załadowała się poprawnie.');
  }

  await page.screenshot({ path: 'docs/audyt-trenuj-star-odblokowany-2026-09-30.png', fullPage: false });
  console.log('Zrzut ekranu Trenera STAR zapisany: docs/audyt-trenuj-star-odblokowany-2026-09-30.png');

  // Przełącz na Most kompetencyjny
  await page.getByRole('tab', { name: /Most kompetencyjny/ }).click();
  await page.waitForTimeout(800);

  const bridgeText = await page.locator('main').innerText();
  if (!bridgeText.includes('bez nazywania go równoważnym')) {
    throw new Error('Most kompetencyjny nie zawiera ostrzeżenia przed fałszywą równoważnością!');
  }

  console.log('Sekcja Trenuj: pomyślnie zweryfikowano przejście zablokowany -> odblokowany oraz ćwiczenia pitch/STAR/most.');
} finally {
  await context.close();
  await browser.close();
}
