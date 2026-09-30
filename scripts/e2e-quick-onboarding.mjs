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
 * - Dane testowe to jawnie fikcyjny monter HVAC (zawód fizyczny, nie IT),
 *   a treść ogłoszenia odpowiada presetowi `preset-hvac` z `JobMatcher.tsx`,
 *   żeby nie wymyślać równoległych wymagań.
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
  page.on('pageerror', (err) => problems.push(`pageerror: ${String(err)}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
  });
  return { context, page, problems };
}

/** Wspólny początek: strona startowa → CTA → formularz szybkiego startu. */
async function dochodzDoFormularza(page, { przezMenuMobilne }) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  await waitVisible(page.getByRole('heading', { name: /Jedno CV, jedno ogłoszenie/ }));

  if (przezMenuMobilne) {
    await page.getByRole('button', { name: 'Otwórz menu nawigacji' }).click();
    // Nazwa drawera to prop `title="KIERIVO"` z Shell.tsx, nie domyślne
    // „Menu Główne" z MobileSidebar (tego Shell nie używa).
    const menu = page.getByRole('dialog', { name: 'KIERIVO' });
    await waitVisible(menu);
    // Zakres do drawera: pasek desktopowy też jest w DOM, tylko ukryty CSS-em.
    await menu.getByRole('button', { name: 'Sprawdź dopasowanie' }).click();
  } else {
    await page.getByRole('button', { name: /Sprawdź swoje CV/ }).first().click();
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

  // 2. Dokładnie trzy problemy: extractTopThreeProblems zawsze zwraca trójkę
  //    (braki formalne → twarde → dopełnienie poradami), więc asercja jest
  //    odporna na konkretny scoring tego CV.
  await waitVisible(page.getByText('3 najważniejsze rzeczy do poprawy w Twoim CV'));
  for (const n of [1, 2, 3]) {
    const punkt = page.getByText(`Punkt #${n}`, { exact: true });
    check(`problem #${n} jest widoczny`, await punkt.count() >= 1);
  }
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
      await page.screenshot({ path: 'docs/audyt-szybki-podglad-cv-desktop-2026-09-30.png', fullPage: true });
      const krytyczne = problems.filter((p) => /pageerror|dynamically imported module|Loading chunk/i.test(p));
      check('brak błędów strony i chunków', krytyczne.length === 0, krytyczne.join(' | ').slice(0, 400));
    } catch (err) {
      failures.push(`desktop: ${err.message}`);
      console.error(`  BŁĄD: desktop — ${err.message}`);
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
      await dialog.getByRole('tab', { name: 'Edytor Dokumentu' }).click();
      await page.screenshot({ path: 'docs/audyt-szybki-edytor-mobile-2026-09-30.png' });

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

      const krytyczne = problems.filter((p) => /pageerror|dynamically imported module|Loading chunk/i.test(p));
      check('brak błędów strony i chunków (mobile)', krytyczne.length === 0, krytyczne.join(' | ').slice(0, 400));
    } catch (err) {
      failures.push(`mobile: ${err.message}`);
      console.error(`  BŁĄD: mobile — ${err.message}`);
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
