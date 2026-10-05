/**
 * E2E: szybki start — wklej CV i ogłoszenie, wynik, przejście do trybu zaawansowanego.
 *
 * Pokrywa ręczny przejazd, którego nie zastępują testy jednostkowe: pełną ścieżkę
 * od pustego profilu przez formularz, wynik i modal trybu zaawansowanego, na
 * desktopie i na mobilnym viewporcie 375 px.
 *
 * Dlaczego scenariusz wygląda tak, a nie dosłownie jak w briefie:
 * - HomeView (src/views/HomeView.tsx) to strona marketingowa bez pól formularza.
 *   Wklejanie CV i ogłoszenia żyje w sekcji „Sprawdź dopasowanie" (zakładka
 *   `aplikuj`), w trybie uproszczonym `QuickOnboardingFlow`, do którego prowadzi
 *   główne wezwanie do działania na stronie startowej. Test idzie dokładnie tą
 *   drogą, którą idzie użytkownik: Start → CTA → formularz.
 * - Jedyny edytor dokumentu w tym przepływie to `CVWordBuilder` (zakładka
 *   „Edytor Dokumentu" w oknie trybu zaawansowanego). `RichTextCvEditor` nie ma
 *   żadnego konsumenta, więc testowanie jego toolbara testowałoby martwy kod.
 * - Dane testowe to jawnie fikcyjny profil IT Support. Pozwalają sprawdzić,
 *   czy wynik szybkiego testu i widok zaawansowany zachowują te same fakty CV.
 *
 * Uruchomienie (Playwright nie jest zależnością repo — instalujemy doraźnie,
 * ten sam wzorzec co scripts/e2e-doradca.mjs):
 *   npx --yes playwright@1 install chromium
 *   npm run test:e2e:quick                 # headless, http://localhost:3000
 *   BASE_URL=http://localhost:3000 npm run test:e2e:quick
 *   HEADFUL=1 npm run test:e2e:quick       # z widoczną przeglądarką
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const HEADFUL = process.env.HEADFUL === '1';
const SLOWMO_MS = Number(process.env.SLOWMO_MS || 0);

let chromium;
try {
  const modPath = process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
  ({ chromium } = await import(modPath));
} catch {
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      'Brak pakietu playwright. Zainstaluj go doraźnie:\n' +
        '  npx --yes playwright@1 install chromium'
    );
    process.exit(2);
  }
}

/* ------------------------------------------------------------------ dane */

// Jawnie syntetyczne CV do regresji zgłoszonych błędów parsera i dopasowania.
const CV_TEXT = [
  'Alicja Testowa',
  'Kraków | alicja.testowa@example.com',
  '',
  'PODSUMOWANIE ZAWODOWE',
  'Specjalistka wsparcia IT z doświadczeniem w Windows 11, Microsoft 365, Exchange Online i TCP/IP.',
  '',
  'UMIEJĘTNOŚCI',
  'Windows 11, Microsoft 365, Exchange Online, Active Directory, TCP/IP, obsługa klienta',
  '',
  'DOŚWIADCZENIE ZAWODOWE',
  'Specjalistka wsparcia IT — Testowa Sp. z o.o. — 2022–2025',
  'Obsługa zgłoszeń, konfiguracja kont Microsoft 365, diagnoza Windows 11.',
  '',
  'EDUKACJA',
  'Technik informatyk — Zespół Szkół Technicznych — 2016–2020',
].join('\n');

const JD_TEXT = [
  'Specjalista IT Support',
  'Testowa Firma',
  '',
  'Wymagania:',
  'Windows 11, Microsoft 365, Exchange Online, TCP/IP, obsługa klienta.',
  '',
  'Mile widziane: Intune, Entra ID, PowerShell.',
].join('\n');

// Wyraz-wskaźnik: występuje w ogłoszeniu, nie występuje w CV. Jeśli po przejściu
// do trybu zaawansowanego mapper słów kluczowych nadal go pokazuje, ogłoszenie
// przetrwało przejście między trybami bez utraty treści.
const JD_MARKER = 'Entra ID';

// Przyciski formatowania CVWordBuilder — każdy ma być w całości w viewporcie 375 px.
const TOOLBAR_BUTTONS = [
  'Pogrubienie',
  'Kursywa',
  'Nagłówek 1',
  'Nagłówek 2',
  'Lista punktowana',
  'Kod inline',
  'Cytat',
];

/* --------------------------------------------------------------- pomocnicze */

const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  OK: ${name}`);
  } else {
    failures.push(name);
    console.error(`  BŁĄD: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function isCriticalPageError(problem) {
  const runtimeFailure = /pageerror|dynamically imported module|Loading chunk/i.test(problem);
  // Tryb developerski Vite w middleware mode emituje klienta HMR, mimo że
  // Express nie przejmuje upgrade WebSocket. Ten błąd pochodzi z @vite/client,
  // a nie z kodu aplikacji; błędy ładowania modułów nadal zostają.
  const zamknietyHmr = problem.includes('WebSocket closed without opened.') &&
    problem.includes('/@vite/client:');
  return runtimeFailure && !zamknietyHmr;
}

async function waitVisible(locator, timeout = 20_000) {
  await locator.waitFor({ state: 'visible', timeout });
}

/**
 * Świeży profil = nowy kontekst przeglądarki. Pusty localStorage oznacza pusty
 * vault (createEmptyVault), a pusty vault przełącza JobMatcher w tryb `quick`
 * — dokładnie stan użytkownika po pierwszym wejściu na stronę.
 */
async function freshPage(browser, { viewport, hasTouch = false, isMobile = false }) {
  const context = await browser.newContext({ viewport, hasTouch, isMobile });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.stack || String(err)}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
  });
  return { context, page, problems };
}

/** Wspólny początek: strona startowa → CTA → formularz szybkiego startu. */
async function dochodzDoFormularza(page, { przezMenuMobilne }) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  await waitVisible(page.getByRole('heading', { name: /^(Dzień dobry|Dobry wieczór)(, .+)?\.$/ }));

  if (przezMenuMobilne) {
    await page.getByRole('button', { name: 'Otwórz menu nawigacji' }).click();
    // Nazwa drawera to prop `title="KIERIVO"` z Shell.tsx, nie domyślne
    // „Menu Główne" z MobileSidebar (tego Shell nie używa).
    const menu = page.getByRole('dialog', { name: 'KIERIVO' });
    await waitVisible(menu);
    // Drawer i pasek desktopowy współdzielą nawigację, ale test klika element
    // wewnątrz otwartego drawera, by uniknąć ukrytej kopii.
    await menu.getByRole('button', { name: 'Oferty' }).click();
  } else {
    await page.getByRole('button', { name: 'Wklej ofertę pracy' }).click();
  }

  // JobMatcher ładuje się leniwie (React.lazy), więc czekamy na pola, nie na URL —
  // nawigacja między zakładkami nie zmienia adresu.
  await waitVisible(page.locator('#onboarding-cv'));
  await waitVisible(page.locator('#onboarding-jd'));
}

/** Wypełnienie formularza i sprawdzenie wyniku szybkiego testu ATS. */
async function sprawdzDopasowanie(page) {
  await page.locator('#onboarding-cv').fill(CV_TEXT);
  await page.locator('#onboarding-jd').fill(JD_TEXT);
  await page.getByRole('button', { name: 'Sprawdź', exact: true }).click();

  // 1. Wynik ma stabilną nazwę dostępnościową i nie jest opisywany jako szansa ATS.
  const baner = page.getByRole('status', {
    name: /Wynik dopasowania Kierivo \d+ procent/,
  });
  await waitVisible(baner);
  check('wynik ma aria-label z liczbą procent', await baner.count() === 1);
  const wynikText = await baner.innerText();
  check('wynik pokazuje pełne pokrycie wymaganych umiejętności', /Zgodność wymaganych umiejętności:\s*100%/.test(wynikText), wynikText);
  check('wynik nie jest nazywany szansą ATS', !/szans[ayę]/i.test(wynikText) && /Nie mierzy prawdopodobieństwa/i.test(wynikText), wynikText);
  check('Entra ID nie trafia do braków wymaganych', await page.getByText(/Entra ID/i).count() === 0);
  check('tytuł i firma nie trafiają do listy braków', await page.getByText(/specjalista it support testowa/i).count() === 0);

  // Pokazujemy wyłącznie ustalenia z analizy; pusta lista i lista krótsza niż
  // trzy elementy są prawidłowe, nie dopełniamy ich poradami bez dowodów.
  const findingsHeading = page.getByRole('heading', { name: /Wnioski z tej analizy \(\d+\)/ });
  await waitVisible(findingsHeading);
  const headingText = await findingsHeading.innerText();
  const findingsCount = Number(headingText.match(/\((\d+)\)/)?.[1] ?? NaN);
  const visibleFindings = await page.getByText(/^Punkt #\d+$/).count();
  check('licznik wniosków zgadza się z liczbą wyświetlonych pozycji', findingsCount === visibleFindings, `${findingsCount} vs ${visibleFindings}`);
  check('wynik nie dopełnia listy poradami bez dowodów',
    await page.getByText(/Wzmocnij osiągnięcia liczbami|Dopasuj nazewnictwo stanowisk|Skondensuj podsumowanie zawodowe/i).count() === 0);
  for (let n = 1; n <= Math.min(findingsCount, 3); n += 1) {
    const punkt = page.getByText(`Punkt #${n}`, { exact: true });
    check(`problem #${n} jest widoczny`, await punkt.count() >= 1);
  }
}

/** Niewielka ekstrakcja nie może dostać kategorycznej etykiety przy dobrym CV. */
async function sprawdzOgraniczoneDane(page) {
  await page.locator('#onboarding-cv').fill(CV_TEXT);
  await page.locator('#onboarding-jd').fill([
    'Specjalista IT Support',
    'Requirements',
    'ServiceNow ticketing system.',
    'About us',
    'We provide onboarding for new employees and a collaborative work environment.',
    'The recruitment process includes a conversation with the team manager and recruiter.',
  ].join('\n'));
  await page.getByRole('button', { name: 'Sprawdź', exact: true }).click();
  const result = page.getByRole('status', { name: /Wynik dopasowania Kierivo \d+ procent/ });
  await waitVisible(result);
  const body = await page.locator('body').innerText();
  check('mała próbka wymagań dostaje etykietę wstępną',
    body.includes('Wynik wstępny — ograniczone dane') && /Rozpoznano tylko 1 wymaganie/.test(body), body.slice(-900));
  await page.screenshot({ path: 'docs/evidence/quick-onboarding-limited-evidence-2026-10-01.png', fullPage: true });
}

/** Przejście do trybu zaawansowanego z dowodem, że ogłoszenie przetrwało. */
async function przejdzDoZaawansowanego(page) {
  await page.getByRole('button', { name: 'Pokaż szczegóły' }).click();

  // Aktywna zakładka niesie aria-selected="true" — to dowodzi przełączenia
  // trybu, a nie samej obecności napisu (napis występuje też w nagłówku paska).
  const tabZaawansowany = page.getByRole('tab', { name: 'Tryb zaawansowany' });
  await waitVisible(tabZaawansowany);
  check(
    'przełączono w tryb zaawansowany',
    (await tabZaawansowany.getAttribute('aria-selected')) === 'true'
  );

  const dialog = page.getByRole('dialog', { name: /Dopasowanie do oferty: Specjalista IT Support \(Testowa Firma\)/ });
  await waitVisible(dialog);
  check('modal zachowuje stanowisko i firmę z nagłówka oferty', true);
  // CV pokazuje sie dopiero po otwarciu jego zakladki; domyslny widok modalny
  // pokazuje rachunek dopasowania, a nie dokument.
  await dialog.getByRole('tab', { name: 'Generator gotowego CV' }).click();
  await waitVisible(dialog.locator('[data-cv-section="header"]'));
  const education = dialog.locator('[data-cv-section="education"]');
  check('wykształcenie występuje tylko raz', await education.getByText(/Technik informatyk/).count() === 1);
  check('TCP/IP pozostaje jedną umiejętnością', await dialog.locator('[data-cv-section="skills"]').getByText('TCP/IP', { exact: true }).count() === 1);
  check('TCP i IP nie są osobnymi umiejętnościami',
    await dialog.locator('[data-cv-section="skills"]').getByText('TCP', { exact: true }).count() === 0 &&
    await dialog.locator('[data-cv-section="skills"]').getByText('IP', { exact: true }).count() === 0);
  const summary = await dialog.locator('[data-cv-section="summary"]').innerText();
  check('podsumowanie pozostaje tekstem źródłowym bez dopisanego sloganu',
    summary.includes('Specjalistka wsparcia IT z doświadczeniem') && !summary.includes('Dopasowany profil zawodowy'), summary);
  check('podgląd nie dopisuje zgody RODO', !/Wyrażam zgodę/i.test(await dialog.innerText()));
  await page.screenshot({
    path: 'docs/evidence/quick-onboarding-cv-generator-desktop-2026-10-01.png',
    fullPage: true,
  });

  // Treść ogłoszenia: mapper dostaje jobOffer.description (= wklejony tekst),
  // więc opcjonalna fraza z wklejonej oferty musi pozostać w polu edycji.
  await dialog.getByRole('tab', { name: 'Mapper Słów Kluczowych' }).click();
  await dialog.getByRole('button', { name: /Edytuj \/ Wklej inne ogłoszenie/ }).click();
  const poleOgloszenia = dialog.getByLabel('Treść ogłoszenia o pracę (Job Description)');
  await waitVisible(poleOgloszenia);
  const zachowanaTresc = await poleOgloszenia.inputValue();
  check(
    `ogłoszenie zachowane w trybie zaawansowanym (znacznik „${JD_MARKER}")`,
    zachowanaTresc.includes(JD_MARKER),
    `pole ma ${zachowanaTresc.length} znaków`
  );
  await page.screenshot({
    path: 'docs/evidence/quick-onboarding-jd-mapper-desktop-2026-10-01.png',
    fullPage: true,
  });

  // Analiza stworzona z Vaultu wydobytego przez szybki formularz musi wskazywać
  // tę samą rewizję, którą rodzic faktycznie zapisał do profilu.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('heading', { name: 'Ostatnia analiza', exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
  const homeBody = await page.locator('body').innerText();
  const analysisStorage = await page.evaluate(() => Object.keys(localStorage)
    .filter((key) => key.includes('last-job-analysis'))
    .map((key) => {
      const raw = localStorage.getItem(key);
      return { key, value: raw ? JSON.parse(JSON.parse(raw).data) : null };
    }));
  check(
    'szybki onboarding zapisuje ostatnią analizę na Start',
    /Ostatnia analiza/i.test(homeBody) && homeBody.includes('Specjalista IT Support'),
    /Ostatnia analiza/i.test(homeBody) ? homeBody.slice(-1000) : `brak ostatniej analizy; storage: ${JSON.stringify(analysisStorage)}`
  );
  check(
    'wynik szybkiego onboardingu jest aktualny względem właśnie zapisanego profilu',
    !homeBody.includes('Profil zmienił się po tej analizie'),
    homeBody.slice(-1000)
  );
  await page.screenshot({ path: 'docs/evidence/home-quick-onboarding-current-analysis-2026-10-01.png', fullPage: true });
}

/* ------------------------------------------------------------------ przebiegi */

const launchOptions = {
  headless: !HEADFUL,
  slowMo: SLOWMO_MS,
};
if (process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe') {
  launchOptions.executablePath = process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
}

const browser = await chromium.launch(launchOptions);
console.log(`Przeglądarka: chromium ${HEADFUL ? 'headful' : 'headless'}`);

try {
  // --- Desktop 1280 px: pełny happy path ---------------------------------
  console.log('DESKTOP 1280 px: Start → formularz → wynik → tryb zaawansowany');
  {
    const { context, page, problems } = await freshPage(browser, {
      viewport: { width: 1280, height: 900 },
    });
    try {
      await dochodzDoFormularza(page, { przezMenuMobilne: false });
      check('wejście na HomeView i dotarcie do formularza', true);
      await sprawdzDopasowanie(page);
      await page.screenshot({ path: 'docs/audyt-szybki-wynik-desktop-2026-09-30.png', fullPage: true });
      await przejdzDoZaawansowanego(page);
      const krytyczne = problems.filter(isCriticalPageError);
      check('brak błędów modułów aplikacji i chunków (sygnał Vite HMR pominięty)', krytyczne.length === 0, krytyczne.join(' | ').slice(0, 400));
    } catch (err) {
      failures.push(`desktop: ${err.message}`);
      console.error(`  BŁĄD: desktop — ${err.message}`);
    } finally {
      await context.close();
    }
  }

  // --- Mała próbka wymagań: sprawdzenie etykiety w szybkim onboardingu -----
  console.log('DESKTOP: ograniczona ekstrakcja wymagań → wynik wstępny');
  {
    const { context, page, problems } = await freshPage(browser, {
      viewport: { width: 1280, height: 900 },
    });
    try {
      await dochodzDoFormularza(page, { przezMenuMobilne: false });
      await sprawdzOgraniczoneDane(page);
      const krytyczne = problems.filter(isCriticalPageError);
      check('brak błędów aplikacji w scenariuszu ograniczonych danych', krytyczne.length === 0, krytyczne.join(' | ').slice(0, 400));
    } catch (err) {
      failures.push(`ograniczone dane: ${err.message}`);
      console.error(`  BŁĄD: ograniczone dane — ${err.message}`);
    } finally {
      await context.close();
    }
  }

  // --- Mobile 375 px: wynik + toolbar edytora w ekranie --------------------
  console.log('MOBILE 375 px: menu → formularz → wynik → toolbar edytora');
  {
    const { context, page, problems } = await freshPage(browser, {
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    });
    try {
      await dochodzDoFormularza(page, { przezMenuMobilne: true });
      check('wejście przez mobilne menu do formularza', true);
      await sprawdzDopasowanie(page);

      await page.getByRole('button', { name: 'Pokaż szczegóły' }).click();
      const dialog = page.getByRole('dialog', { name: /Dopasowanie do oferty: Specjalista IT Support \(Testowa Firma\)/ });
      await waitVisible(dialog);
      const editorTab = dialog.getByRole('tab', { name: 'Edytor Dokumentu' });
      await editorTab.click();
      check('zakładka edytora jest aktywna', (await editorTab.getAttribute('aria-selected')) === 'true');
      await waitVisible(dialog.getByRole('button', { name: 'Pogrubienie' }));

      const szerokosc = page.viewportSize()?.width ?? 375;
      let toolbarMiesciSie = true;
      for (const nazwa of TOOLBAR_BUTTONS) {
        const przycisk = dialog.getByRole('button', { name: nazwa, exact: true });
        await waitVisible(przycisk);
        const box = await przycisk.boundingBox();
        const miesciSie = !!box && box.x >= -1 && box.x + box.width <= szerokosc + 1;
        if (!miesciSie) {
          toolbarMiesciSie = false;
          console.error(`  BŁĄD: przycisk „${nazwa}" poza ekranem (x=${box?.x}, w=${box?.width})`);
        }
      }
      check(`toolbar edytora CV mieści się w ${szerokosc} px`, toolbarMiesciSie);
      await page.screenshot({ path: 'docs/evidence/quick-onboarding-editor-mobile-2026-10-01.png' });

      const krytyczne = problems.filter(isCriticalPageError);
      check('brak błędów modułów aplikacji i chunków (sygnał Vite HMR pominięty, mobile)', krytyczne.length === 0, krytyczne.join(' | ').slice(0, 400));
    } catch (err) {
      failures.push(`mobile: ${err.message}`);
      console.error(`  BŁĄD: mobile — ${err.message}`);
    } finally {
      await context.close();
    }
  }

  // Osobny, syntetyczny stan odtwarza regułę 4: gotowy profil, zapisana
  // analiza i pusty Pipeline. Test quick-onboarding wyżej ma profil 45%, więc
  // poprawnie zatrzymuje się wcześniej na rekomendacji uzupełnienia profilu.
  console.log('DESKTOP: gotowy profil + istniejąca analiza + pusty Pipeline');
  {
    const { context, page, problems } = await freshPage(browser, {
      viewport: { width: 1280, height: 900 },
    });
    try {
      await page.addInitScript(() => {
        const fnv1a = (input) => {
          let hash = 0x811c9dc5;
          for (let i = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
          }
          return (hash >>> 0).toString(16).padStart(8, '0');
        };
        const write = (key, value) => {
          const data = JSON.stringify(value);
          localStorage.setItem(key, JSON.stringify({ cvel: 2, crc: fnv1a(data), data }));
        };
        const profileId = 'e2e-next-action-proof';
        const updatedAt = '2026-10-01T10:00:00.000Z';
        const vault = {
          version: '1.0.0',
          updatedAt,
          profiler: {
            flags: [], experienceLevel: 'MID',
            location: { city: 'Kraków', radiusKm: 20, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
            languages: [],
          },
          personalInfo: {
            fullName: 'Alicja Testowa', email: 'alicja@example.test', phone: '', location: 'Kraków',
            linkedin: '', github: '', website: '', photoUrl: '', title: 'Specjalistka IT Support',
            summary: 'Syntetyczny profil do testu interfejsu.',
          },
          skillsMatrix: {
            hardSkills: ['Windows 11'], softSkills: [], toolsAndTech: ['Microsoft 365'],
            certifications: [{ id: 'synthetic-cert', name: 'Uprawnienie testowe', issuer: 'Test' }],
          },
          history: [{
            id: 'synthetic-exp', company: 'Firma Testowa', role: 'Specjalistka wsparcia', location: 'Kraków',
            startDate: '2022-01', endDate: '2025-01', isCurrent: false,
            highlights: [{ id: 'synthetic-highlight', text: 'Przykładowy wpis wyłącznie do testu.' }],
          }],
          education: [{ id: 'synthetic-edu', institution: 'Szkoła Testowa', degree: 'Technik', fieldOfStudy: 'IT', startDate: '2018', endDate: '2022' }],
          projects: [],
        };
        write('cvelocity:profile', { id: profileId, name: 'Alicja Testowa', email: 'alicja@example.test' });
        write(`cvelocity:vault:${profileId}`, vault);
        write(`cvelocity:applications:${profileId}`, []);
        write(`cvelocity:last-job-analysis:${profileId}`, {
          position: 'Specjalistka IT Support', company: 'Firma Testowa',
          strengths: ['Windows 11'], gaps: [], analyzedAt: updatedAt, profileUpdatedAt: updatedAt,
          requirementsCount: 1, matchedCount: 1,
        });
      });
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await waitVisible(page.locator('#next-action-title'));
      const homeBody = await page.locator('body').innerText();
      const title = await page.locator('#next-action-title').innerText();
      check(
        'istniejąca analiza nie jest nazywana pierwszą ofertą przy pustym Pipeline',
        title === 'Wklej ofertę do analizy' && !homeBody.includes('Wklej pierwszą ofertę pracy'),
        `title=${title}`
      );
      check('syntetyczna analiza jest widoczna na Start', /Ostatnia analiza/i.test(homeBody) && homeBody.includes('Specjalistka IT Support'));
      await page.screenshot({ path: 'docs/evidence/home-next-action-neutral-offer-2026-10-01.png', fullPage: true });
      const krytyczne = problems.filter(isCriticalPageError);
      check('brak błędów aplikacji w scenariuszu etykiety następnego kroku', krytyczne.length === 0, krytyczne.join(' | ').slice(0, 400));
    } catch (err) {
      failures.push(`neutralna etykieta następnego kroku: ${err.message}`);
      console.error(`  BŁĄD: neutralna etykieta następnego kroku — ${err.message}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\nWYNIK: ${failures.length} niepowodzeń:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nWYNIK: cały przejazd E2E na zielono (desktop + mobile 375 px).');
