/**
 * Tłumaczenie błędów uwierzytelniania na polski.
 *
 * Dwa powody, dla których to nie jest zwykły słownik:
 *
 * 1. **Interfejs tej aplikacji jest po polsku.** Surowy komunikat GoTrue
 *    („Invalid login credentials") w polskim formularzu wygląda jak awaria,
 *    a nie jak informacja.
 * 2. **Komunikat nie może zdradzać, czy dany adres istnieje w bazie.** Gdyby
 *    logowanie odpowiadało inaczej na „nie ma takiego konta", a inaczej na
 *    „złe hasło", formularz stałby się narzędziem do sprawdzania, kto korzysta
 *    z aplikacji — a lista osób szukających pracy jest informacją, której nikt
 *    nie chciałby ujawnić swojemu pracodawcy.
 *
 * Stąd zasada: **jeden komunikat dla obu przypadków**, bez wyjątków.
 */

/** Kształt błędu z `@supabase/supabase-js`, sprowadzony do tego, co czytamy. */
export interface AuthErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

const OGOLNY = 'Coś poszło nie tak. Spróbuj ponownie za chwilę.';

/**
 * Jedno zdanie dla „nie ma takiego konta" i dla „złe hasło".
 * Wyniesione do stałej, żeby nie dało się przypadkiem rozdzielić tych dwóch
 * przypadków przy późniejszej edycji.
 */
const ZLE_DANE = 'Nieprawidłowy e-mail lub hasło.';

/**
 * Dopasowanie po fragmencie komunikatu, nie po pełnej równości: GoTrue
 * dopisuje do treści szczegóły (liczbę sekund, nazwę pola), a lista kodów
 * błędów zmienia się między wersjami. Fragment przeżyje jedno i drugie.
 */
const MAPA: Array<[RegExp, string]> = [
  [/invalid login credentials/i, ZLE_DANE],
  [/email not confirmed/i, 'Potwierdź adres e-mail — link wysłaliśmy przy rejestracji.'],
  [/user already registered|already been registered/i,
    // Celowo NIE mówimy „takie konto już istnieje" — to byłaby ta sama
    // informacja, przed którą chroni `ZLE_DANE`, tylko podana wprost.
    'Jeśli ten adres nie ma jeszcze konta, wysłaliśmy na niego link aktywacyjny.'],
  [/password should be at least/i, 'Hasło jest za krótkie.'],
  [/weak password/i, 'To hasło jest za słabe.'],
  [/for security purposes|rate limit|too many requests/i,
    'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.'],
  [/email rate limit exceeded/i,
    'Wysłaliśmy już maksymalną liczbę wiadomości. Spróbuj za godzinę.'],
  [/token has expired|otp_expired|invalid.*token/i,
    'Link wygasł. Poproś o nowy.'],
  [/unable to validate email|invalid email/i, 'Ten adres e-mail wygląda na nieprawidłowy.'],
  [/same password/i, 'Nowe hasło musi różnić się od poprzedniego.'],
  [/network|fetch failed|failed to fetch/i,
    'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.'],
];

/**
 * Zwraca polski komunikat dla użytkownika.
 *
 * Nieznany błąd dostaje treść ogólną — **nigdy surowy tekst od dostawcy**.
 * Komunikat, którego nie przewidzieliśmy, potrafi zawierać nazwę wewnętrznego
 * pola albo fragment zapytania; to nie jest informacja dla osoby, która chce
 * się zalogować.
 */
export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (!error) return OGOLNY;

  const text = `${error.code ?? ''} ${error.message ?? ''}`.trim();
  if (!text) return OGOLNY;

  for (const [wzorzec, komunikat] of MAPA) {
    if (wzorzec.test(text)) return komunikat;
  }

  return OGOLNY;
}

/**
 * Czy błąd znaczy „konto istnieje, ale e-mail niepotwierdzony".
 * Potrzebne, żeby pokazać ekran z ponownym wysłaniem linku zamiast samego
 * komunikatu — to jedyny przypadek, w którym rozróżnienie jest bezpieczne,
 * bo osoba i tak podała poprawne hasło do tego konta.
 */
export function isEmailNotConfirmed(error: AuthErrorLike | null | undefined): boolean {
  return /email not confirmed/i.test(`${error?.code ?? ''} ${error?.message ?? ''}`);
}

/**
 * Tłumaczenie błędów, które wracają **parametrami w adresie** po nieudanym
 * powrocie z dostawcy OAuth (anulowanie w oknie Google/Microsoft/LinkedIn,
 * wyłączony dostawca po stronie Supabase). Ta sama zasada co wyżej: polski
 * komunikat, nigdy surowy tekst dostawcy — `error_description` od LinkedIn
 * potrafi zawierać techniczny opis po angielsku, którego nie wolno pokazać
 * użytkownikowi wprost.
 */
const OAUTH_MAPA: Array<[RegExp, string]> = [
  // Dostawcy piszą to różnie: „User cancelled", „cancelled by user",
  // „cancellation" — wspólny mianownik to samo „cancel".
  [/access_denied|cancel/i,
    'Logowanie zostało anulowane w oknie dostawcy. Spróbuj ponownie i zaakceptuj dostęp.'],
  [/unsupported_provider|provider\s+is\s+not\s+enabled|invalid\s+provider/i,
    'To sposób logowania nie jest jeszcze włączony. Użyj e-maila i hasła albo innego przycisku.'],
  [/unauthorized_client|invalid_client/i,
    'Logowanie tym dostawcą jest chwilowo niedostępne po jego stronie. Spróbuj innym sposobem.'],
  [/redirect_uri|callback/i,
    'Logowanie tym dostawcą jest źle skonfigurowane. Powiadom nas przez kontakt w stopce.'],
];

export function oauthErrorMessage(code: string | null | undefined, description: string | null | undefined): string {
  const text = `${code ?? ''} ${description ?? ''}`.trim();
  if (!text) return OGOLNY;

  for (const [wzorzec, komunikat] of OAUTH_MAPA) {
    if (wzorzec.test(text)) return komunikat;
  }

  return OGOLNY;
}
