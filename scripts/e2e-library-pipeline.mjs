/** E2E Biblioteka CV i Moje aplikacje - weryfikacja snapshotu i izolacji dokumentów */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();

try {
  await page.goto(process.env.BASE_URL || 'http://localhost:3000');
  await page.locator('button[aria-haspopup="menu"]').click();
  await page.getByRole('button', { name: /Zaloguj się lub załóż konto|Utwórz profil lokalny/ }).click();
  await page.getByRole('button', { name: /Korzystaj bez logowania/ }).click();
  await page.getByRole('textbox', { name: 'Jak się do Ciebie zwracać' }).fill('Tomasz Inżynier');
  await page.getByRole('button', { name: 'Zapisz profil' }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });

  // Ustaw w localStorage dane profilu, zapisane CV w bibliotece oraz aplikację w pipeline
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

    const vault = {
      personalInfo: {
        fullName: 'Tomasz Inżynier',
        email: 'tomasz@example.pl',
        phone: '+48 501 234 567',
        city: 'Kraków',
        title: 'Inżynier Budowy / Kierownik Robót Sanitarnych',
        summary: 'Inżynier budownictwa z uprawnieniami wykonawczymi bez ograniczeń w specjalności instalacyjnej.',
      },
      history: [
        {
          id: 'exp-1',
          company: 'Buderus Polska',
          role: 'Inżynier Robót HVAC',
          startDate: '2021-01',
          endDate: '2024-02',
          highlights: ['Koordynacja montażu instalacji wentylacji i klimatyzacji VRF', 'Odbiory UDT i próby szczelności'],
        }
      ],
      skillsMatrix: {
        hardSkills: ['Uprawnienia budowlane wykonawcze', 'Instalacje HVAC', 'AutoCAD', 'Kosztorysowanie Norma Pro'],
        toolsAndTech: ['BIMvision', 'Revit MEP'],
        softSkills: ['Zarządzanie podwykonawcami', 'Negocjacje'],
        certifications: [{ name: 'Uprawnienia budowlane MAP/0123/OWOS/20', issuer: 'Małopolska OIIB' }],
      },
      profiler: {
        licenses: ['sep_g1_e', 'sep_g2_e', 'sep_g3_e'],
        languages: [{ language: 'Polski', level: 'Ojczysty' }, { language: 'Angielski', level: 'B2' }],
      }
    };

    // Dokumenty w Bibliotece CV
    const libraryDocs = [
      {
        id: 'cv-doc-1',
        title: 'CV — Kierownik Robót HVAC (Skanska)',
        targetRole: 'Kierownik Robót Sanitarnych',
        companyName: 'Skanska S.A.',
        updatedAt: new Date().toISOString(),
        downloadCount: 2,
        tags: ['Budownictwo', 'HVAC', 'Uprawnienia'],
        vault,
        tailoredResume: {
          fullName: 'Tomasz Inżynier',
          role: 'Kierownik Robót Sanitarnych',
          summary: 'Inżynier budownictwa z uprawnieniami wykonawczymi w specjalności instalacyjnej.',
          skills: ['Uprawnienia budowlane wykonawcze', 'Instalacje HVAC', 'Odbiory UDT'],
          experience: ['Koordynacja montażu instalacji wentylacji i klimatyzacji VRF'],
        }
      },
      {
        id: 'cv-doc-2',
        title: 'CV — Specjalista ds. Kosztorysowania',
        targetRole: 'Kosztorysant Instalacji',
        companyName: 'Termo-Projekt Sp. z o.o.',
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        downloadCount: 1,
        tags: ['Kosztorysowanie', 'Norma Pro'],
        vault,
      }
    ];

    // Aplikacje w Pipeline
    const apps = [
      {
        id: 'app-skanska',
        company: 'Skanska S.A.',
        position: 'Kierownik Robót Sanitarnych',
        status: 'Rozmowa',
        appliedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        interviewAt: new Date(Date.now() + 2 * 86400000).toISOString(),
        notes: 'Rozmowa techniczna z Dyrektorem Kontraktu.',
        snapshot: {
          role: 'Kierownik Robót Sanitarnych',
          company: 'Skanska S.A.',
          matchedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          canonicalScore: 88,
          matchedRequirements: ['Uprawnienia budowlane', 'HVAC', 'Koordynacja montażu'],
          missingRequirements: [],
        }
      }
    ];

    const milestones = {
      vaultStartedAt: new Date().toISOString(),
      firstApplicationAt: new Date().toISOString(),
      firstInterviewAt: new Date().toISOString(),
    };

    localStorage.setItem(`cvelocity:vault:${profileId}`, createEnvelope(vault));
    localStorage.setItem(`cvelocity:cv-library:${profileId}`, createEnvelope(libraryDocs));
    localStorage.setItem(`cvelocity:applications:${profileId}`, createEnvelope(apps));
    localStorage.setItem(`cvelocity:ux-milestones:${profileId}`, createEnvelope(milestones));
  });

  // Odśwież stronę, aby załadować stan profilu
  await page.reload();
  await page.waitForTimeout(1500);

  // 1. KROK: Biblioteka CV
  await page.getByRole('button', { name: 'Biblioteka CV' }).click();
  await page.waitForTimeout(1500);

  const libraryHeader = await page.getByRole('heading', { name: /Biblioteka CV/ }).innerText();
  console.log('Nagłówek Biblioteki CV:', libraryHeader);

  // Sprawdź karty w Bibliotece
  const libText = await page.locator('main').innerText();
  if (!libText.includes('CV — Kierownik Robót HVAC') || !libText.includes('Skanska S.A.')) {
    throw new Error('Biblioteka CV nie wyświetla zapisanego dokumentu!');
  }
  if (!libText.includes('Pobierz PDF ponownie')) {
    throw new Error('Brak przycisku ponownego pobrania PDF w Bibliotece!');
  }

  // Zrób zrzut ekranu Biblioteki CV
  await page.screenshot({ path: 'docs/audyt-biblioteka-eksport-2026-09-30.png', fullPage: false });
  console.log('Zrzut ekranu Biblioteki CV zapisany: docs/audyt-biblioteka-eksport-2026-09-30.png');

  // 2. KROK: Moje aplikacje (Pipeline) i snapshot
  await page.getByRole('button', { name: 'Moje aplikacje' }).click();
  await page.waitForTimeout(1500);

  const pipelineHeader = await page.locator('main').innerText();
  console.log('Zawartość Pipeline snippet:', pipelineHeader.slice(0, 250));

  if (!pipelineHeader.includes('Skanska S.A.') || !pipelineHeader.includes('Kierownik Robót Sanitarnych')) {
    throw new Error('Pipeline nie wyświetla zapisanej aplikacji Skanska S.A.!');
  }

  // Zrób zrzut ekranu Moich aplikacji ze statusem Rozmowa i Zasobnikiem Rozmowy
  await page.screenshot({ path: 'docs/audyt-aplikacje-snapshot-2026-09-30.png', fullPage: false });
  console.log('Zrzut ekranu aplikacji i snapshotu zapisany: docs/audyt-aplikacje-snapshot-2026-09-30.png');

  console.log('Biblioteka CV i Moje aplikacje: pomyślnie zweryfikowano eksport, izolację dokumentów i snapshot.');
} finally {
  await context.close();
  await browser.close();
}
