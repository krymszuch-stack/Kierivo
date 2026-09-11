# D04 — protokół odbioru kont, resetu hasła i RLS

Data odbioru: 2026-09-11  
Zakres: D04 · Fundament · konta, PASSWORD_RECOVERY, usunięcie konta, granty i RLS  
Powiązany PR: #111 — `D04: domknij konta, reset hasła i RLS`  
Gałąź odbiorowa: `d04-auth-rls`

> Raport celowo nie zawiera haseł, access tokenów, refresh tokenów, service-role key ani pełnych jednorazowych linków e-mail.

## Kryterium „gotowe gdy”

D04 uznajemy za odebrane na poziomie kodu i izolowanego środowiska integracyjnego, gdy:

1. użytkownik może potwierdzić konto, zalogować się, poprosić o reset hasła, ustawić nowe hasło i zalogować się nim;
2. wygasły lub nieprawidłowy link recovery kończy się kontrolowanym polskim komunikatem i możliwością zamówienia nowego linku;
3. użytkownik może usunąć konto przez zweryfikowany kanał, a dane właściciela znikają;
4. stary token po usunięciu konta nie daje dostępu do danych i nie pozwala ich odtworzyć;
5. RLS izoluje konta A/B dla odczytu i zapisu;
6. wrażliwe RPC nie są dostępne dla `anon` ani `authenticated`;
7. stan migracji jest opisany na podstawie historii środowiska oraz faktycznego schematu, bez założenia „plik istnieje = został zastosowany”.

## 1. Stan migracji i backup audytowy

Punkt odniesienia przed D04 jest zapisany w:

`docs/historia/d04-supabase-snapshot-2026-09-11.md`

Snapshot zawiera:

- listę 11 rekordów migracji zgłaszanych przez hostowane `cvelocity-prod`,
- listę plików `supabase/migrations` z aktualnego `main` przed D04,
- mapowanie plik → historia → faktyczny efekt w schemacie,
- jawne oznaczenie driftu historii dla `0004_karnet_aplikacyjny.sql`, `0008_client_errors.sql` i `0009_karnet_pool.sql`: ich efekty są obecne w schemacie, ale brak jednoznacznego rekordu historii odpowiadającego konkretnemu plikowi,
- snapshot RLS, ACL wrażliwych funkcji oraz wdrożonych Edge Functions.

Nie wykonano destrukcyjnego `test:rls` na `cvelocity-prod`.

## 2. Osobne środowisko testowe

D04 ma własną bramkę `.github/workflows/d04-auth-rls.yml`.

Każdy odbiór:

1. uruchamia świeży lokalny stos Supabase w GitHub Actions,
2. stosuje migracje z gałęzi PR,
3. wymusza potwierdzenie e-mail dla nowego konta,
4. uruchamia repozytoryjne Edge Functions,
5. używa lokalnego Mailpit do potwierdzenia dostarczenia wiadomości,
6. wykonuje `npm run test:rls`,
7. wykonuje `npm run test:auth-lifecycle`,
8. wykonuje `supabase db lint --level error`,
9. niszczy lokalny stos po jobie.

`scripts/test-rls.mjs` ma dodatkowy bezpiecznik: dla zdalnego `SUPABASE_URL` odmawia wykonania bez długiego, jawnego opt-in. Pełny `test-auth-lifecycle` działa wyłącznie na localhost/127.0.0.1/::1.

## 3. Dowód RLS A/B

`scripts/test-rls.mjs` tworzy dwa losowe konta testowe i sprawdza m.in.:

- B nie odczytuje vaultu A,
- B nie odczytuje aplikacji A,
- A odczytuje własny vault,
- B nie może utworzyć wiersza jako A,
- B nie może nadpisać ani usunąć vaultu A,
- B nie może sam nadać sobie aktywnej subskrypcji,
- B nie może wyzerować liczników,
- klient nie może bezpośrednio wykonać serwerowego `consume_quota`,
- limit pięciu użyć odrzuca szóste,
- 10 równoległych rezerwacji przy limicie 5 daje dokładnie 5 sukcesów i 5 odmów,
- `delete_user_data` usuwa dane właściciela,
- po usunięciu użytkownika stary token nie potwierdza użytkownika, nie odczytuje jego vaultu i nie odtwarza danych.

## 4. Granty i migracja D04

Audyt hostowanego projektu wykazał, że część starych szerokich grantów tabel dla `anon` i `authenticated` nadal istnieje, mimo prawidłowych polityk RLS.

D04 dodaje:

`supabase/migrations/20260911070000_harden_data_api_grants.sql`

Migracja działa według zasady „revoke, potem explicit grant”:

- odbiera legacy prawa klienta,
- nadaje tylko operacje faktycznie używane przez przeglądarkę,
- zachowuje publiczny odczyt wyłącznie dla świadomie publicznego korpusu,
- odbiera `anon/authenticated/PUBLIC` wykonywanie wrażliwych SECURITY DEFINER RPC,
- zostawia wykonanie tych RPC dla `service_role`.

Migracja została zastosowana i przetestowana w świeżej bazie odbiorowej. Nie twierdzimy, że jest już zastosowana na produkcji przed merge/deploy PR #111.

## 5. PASSWORD_RECOVERY i wygasły link

Obsługa znajduje się w:

- `src/context/AuthContext.tsx`,
- `src/lib/authRecovery.ts`,
- `src/features/auth/PasswordRecoveryModal.tsx`,
- `src/components/GlobalShell.tsx`.

Przepływ:

1. `resetPasswordForEmail` wysyła link z powrotem na bieżący `window.location.origin`,
2. Supabase emituje `PASSWORD_RECOVERY`,
3. aplikacja otwiera globalny formularz nowego hasła,
4. hasło przechodzi politykę lokalną i sprawdzenie wycieku,
5. zapis wykonywany jest przez `auth.updateUser({ password })`,
6. po powodzeniu użytkownik dostaje jednoznaczne potwierdzenie,
7. rezygnacja z aktywnej sesji recovery wylogowuje ją zamiast pozostawiać ukryte uwierzytelnienie.

Dla wygasłego/nieprawidłowego tokenu aplikacja rozpoznaje błąd przekazany w URL, tłumaczy go na polski, usuwa techniczne parametry z paska adresu i pozwala poprosić o nowy link.

Test jednostkowy `src/lib/__tests__/authRecovery.test.ts` potwierdza m.in. komunikat:

`Link wygasł. Poproś o nowy.`

oraz nie przechwytuje niespokrewnionych błędów OAuth.

## 6. Dowód pełnego cyklu konta

`scripts/test-auth-lifecycle.mjs` wykonuje na izolowanym Supabase:

1. anonimowe wywołanie `sprawdz-haslo` z samym 5-znakowym prefiksem SHA-1,
2. rejestrację nowego losowego konta testowego,
3. potwierdzenie, że bez e-maila nie powstaje aktywna sesja,
4. odebranie wiadomości potwierdzającej w Mailpit,
5. sprawdzenie domeny powrotu,
6. potwierdzenie konta,
7. logowanie starym hasłem,
8. żądanie resetu hasła,
9. odebranie maila recovery w Mailpit,
10. sprawdzenie domeny powrotu recovery,
11. ustanowienie sesji recovery,
12. zmianę hasła przez `updateUser`,
13. potwierdzenie, że stare hasło przestało działać,
14. logowanie nowym hasłem,
15. utworzenie danych właściciela,
16. wywołanie `usun-konto` jako zalogowany użytkownik,
17. potwierdzenie usunięcia użytkownika z Auth oraz jego vaultu,
18. potwierdzenie, że wcześniej wydany token nie daje już dostępu do danych ani możliwości ich odtworzenia.

## 7. Edge Functions

W hostowanym `cvelocity-prod` zweryfikowano przed odbiorem:

- `usun-konto` — aktywna, `verify_jwt = true`,
- `sprawdz-haslo` — aktywna, `verify_jwt = false` świadomie, ponieważ działa także przed rejestracją i otrzymuje jedynie prefiks SHA-1, nigdy hasło.

D04 nie tworzy drugiej równoległej trasy do tych operacji. Klient nadal korzysta z istniejących, zweryfikowanych funkcji.

## 8. Wyniki automatycznego odbioru

Dla commita `a44f3f14023cecd7f46a56d44ba2a740dafb1e78`:

- `CVELOCITY CI` run #232 — sukces,
- `D04 AUTH + RLS` run #2 — sukces,
- w run #2 krok `Start isolated Supabase and run D04 acceptance` zakończył się sukcesem wraz z `db lint`.

Run integracyjny:

`https://github.com/krymszuch-stack/cvelocity/actions/runs/34572754761`

Zwykłe CI:

`https://github.com/krymszuch-stack/cvelocity/actions/runs/34572754760`

## 9. Granica dowodu hostowanego środowiska

Automatyczny odbiór dowodzi działania kodu, migracji, Supabase Auth, lokalnej dostawy e-mail, Edge Functions, RLS i pełnego lifecycle na odrębnym środowisku.

Przez dostępne API zweryfikowano aktywność produkcyjnych Edge Functions i faktyczny stan schematu/polityk. Nie odczytano bezpośrednio z hostowanego dashboardu listy `Authentication → URL Configuration` ani konfiguracji zewnętrznego SMTP.

Dlatego przed dopuszczeniem kont produkcyjnych w becie pozostaje operacyjny check konfiguracji hostowanej:

- domena używana przez użytkownika jest na liście dozwolonych redirect URL Supabase Auth,
- mail potwierdzający i recovery dochodzi do rzeczywistej skrzynki przez produkcyjny kanał SMTP.

Nie jest to brak logiki D04, tylko ostatnia weryfikacja konfiguracji środowiska hostowanego.

## Status

**D04: ODEBRANE na poziomie kodu, migracji na świeżej bazie, RLS i pełnego izolowanego cyklu Auth.**

**Beta z kontami produkcyjnymi pozostaje zablokowana do czasu zastosowania migracji po merge oraz potwierdzenia redirect URL + realnej dostawy e-mail w hostowanym Supabase.**
