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
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Brak pakietu playwright. Zainstaluj go doraźnie:\n' +
      '  npx --yes playwright@1 install chromium'
  );
  process.exit(2);
}

/* ------------------------------------------------------------------ dane */

// Jawnie testowe CV montera instalacji grzewczych. Powyżej progu
// MIN_CV_CHARS (120), bez certyfikatu F-Gaz — ogłoszenie ma go wymagać,
// żeby wynik zawierał realny brak formalny, a nie dopchane porady.
const CV_TEXT = [
  'Jan Kowalski — Monter instalacji grzewczych, Warszawa.',
  'Telefon: 600 100 200, e-mail: jan.kowalski.test@example.com.',
  '',
  'Doświadczenie:',
  '2019–2026 Monter instalacji grzewczych — EkoTerm Serwis Sp. z o.o., Warszawa.',
  'Montaż i uruchamianie kotłów gazowych Junkers i Bosch, przeglądy okresowe,',
  'diagnostyka usterek, czytanie dokumentacji technicznej i schematów hydraulicznych.',
  'Praca w terenie na Mazowszu, raportowanie zleceń, przestrzeganie zasad BHP.',
  '',
  'Uprawnienia: SEP G3 eksploatacja, prawo jazdy kat. B.',
  'Umiejętności: lutowanie, pomiary ciśnień, regulacja palników, raportowanie.',
].join('\n');

// Pierwsza linia (4–60 znaków) staje się tytułem oferty w trybie zaawansowanym.
// Treść odpowiada presetowi `preset-hvac` z JobMatcher.tsx.
const JD_TEXT = [
  'Monter i Serwisant Pieców Gazowych',
  'EkoTerm Serwis Sp. z o.o., Warszawa i okolice. Poszukujemy montera i serwisanta',
  'urządzeń grzewczych i pomp ciepła na terenie województwa mazowieckiego.',
  'Wymagania: ważne uprawnienia SEP G3 (eksploatacja, mile widziany dozór),',
  'certyfikat F-Gaz dla personelu (kategoria I), doświadczenie w montażu,',
  'uruchamianiu i przeglądach kotłów gazowych (Junkers, Bosch, Vaillant),',
  'umiejętność czytania dokumentacji technicznej i schematów hydraulicznych,',
  'prawo jazdy kat. B i dyspozycyjność do pracy w terenie.',
].join('\n');

// Wyraz-wskaźnik: występuje w ogłoszeniu, nie występuje w CV. Jeśli po przejściu
// do trybu zaawansowanego mapper słów kluczowych nadal go pokazuje, ogłoszenie
// przetrwało przejście między trybami bez utraty treści.
const JD_MARKER = 'F-Gaz';

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
    const menu = page.getByRole('dialog', { name: 'Menu Główne' });
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

  // 1. Baner wyniku ogłasza się czytnikom przez role="status" + aria-label
  //    z liczbą procent (defekt a11y opisany w QuickOnboardingFlow).
  const baner = page.getByRole('status', {
    name: /Szacowany wynik przejścia filtra ATS \d+ procent/,
  });
  await waitVisible(baner);
  check('baner wyniku ma aria-label z liczbą procent', await baner.count() === 1);

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

  await waitVisible(page.getByText('Tryb zaawansowany', { exact: true }));
  check('przełączono w tryb zaawansowany', true);

  // Firma jest stałą przepływu quick („Pracodawca z ogłoszenia"), więc tytuł
  // dialogu dowodzi, że oferta pochodzi z wklejonego ogłoszenia, nie z presetu.
  const tytulDialogu = page.getByText(/Dopasowanie ATS dla:.*Pracodawca z ogłoszenia/);
  await waitVisible(tytulDialogu);
  check('modal trybu zaawansowanego otwarty dla wklejonej oferty', true);

  // Treść ogłoszenia: mapper dostaje jobOffer.description (= wklejony tekst),
  // więc wskaźnik F-Gaz musi być w jego polu edycji.
  const dialog = page.getByRole('dialog', { name: /Dopasowanie ATS dla:/ });
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

const browser = await chromium.launch({
  headless: !HEADFUL,
  slowMo: SLOWMO_MS,
});
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
      await przejdzDoZaawansowanego(page);
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
      const dialog = page.getByRole('dialog', { name: /Dopasowanie ATS dla:/ });
      await waitVisible(dialog);
      await dialog.getByRole('tab', { name: 'Edytor Dokumentu' }).click();

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
