# Rejestr czynności przetwarzania (RoPA)

> **Status: szkic do przeglądu prawnego.** Art. 30 RODO. Rejestr prowadzi administrator; przy tej skali nie jest wymagane zgłoszenie IOD, ale sam rejestr — tak.
>
> Dokument opisuje **stan faktyczny kodu**. Czynności planowane są wyraźnie oznaczone i nie są jeszcze wykonywane.

**Administrator:** Adrian Koziński (dane rejestrowe do uzupełnienia)
**Kontakt:** `krymszuch00@outlook.com`
**Data sporządzenia:** do uzupełnienia przy publikacji

---

## Czynność 1 — Prowadzenie profilu kandydata w przeglądarce

| Element | Opis |
|---|---|
| **Cel** | Umożliwienie użytkownikowi zapisania danych do CV i ponownego użycia ich przy kolejnej wizycie |
| **Kategorie osób** | Osoby poszukujące pracy, korzystające z aplikacji |
| **Kategorie danych** | Imię i nazwisko, e-mail (opcjonalnie), telefon, miejscowość, doświadczenie zawodowe, wykształcenie, umiejętności, certyfikaty, projekty, opcjonalnie zdjęcie |
| **Podstawa prawna** | Art. 6 ust. 1 lit. b — wykonanie usługi na żądanie osoby |
| **Odbiorcy** | Brak. Dane nie opuszczają urządzenia użytkownika |
| **Transfer poza EOG** | Nie występuje |
| **Termin usunięcia** | Do usunięcia przez użytkownika; brak automatycznego terminu, bo administrator nie ma dostępu do tych danych |
| **Zabezpieczenia** | **Brak szyfrowania w spoczynku** — dane leżą w `localStorage` przeglądarki jawnym tekstem. Świadome i opisane w `SECURITY.md`. Ryzyko: dostęp do urządzenia użytkownika, XSS |
| **Gdzie w kodzie** | `src/lib/localProfile.ts` |

**Uwaga o danych szczególnej kategorii:** zdjęcie w CV to wizerunek (art. 9 RODO). Pozostaje wyłącznie na urządzeniu użytkownika i **nie jest wysyłane do modelu w żadnej postaci** (`stripSensitiveFields` w `src/server/pseudonymize.ts`). Decyzja o docelowym trybie obsługi zdjęcia — do podjęcia przed uruchomieniem kont.

---

## Czynność 2 — Pobranie ogłoszenia o pracę ze wskazanego adresu

| Element | Opis |
|---|---|
| **Cel** | Odczytanie treści ogłoszenia, które użytkownik chce porównać ze swoim CV |
| **Kategorie osób** | Użytkownicy aplikacji; pośrednio osoby wymienione w ogłoszeniu (np. kontakt do rekrutera) |
| **Kategorie danych** | Adres URL podany przez użytkownika, treść pobranej strony, adres IP użytkownika (limitowanie zapytań) |
| **Podstawa prawna** | Art. 6 ust. 1 lit. b — działanie na wyraźne żądanie; art. 6 ust. 1 lit. f w zakresie IP (ochrona przed nadużyciem) |
| **Odbiorcy** | Serwis, z którego pobierana jest strona (widzi nasz adres IP i nagłówek User-Agent) |
| **Transfer poza EOG** | Możliwy, zależnie od lokalizacji pobieranego serwisu |
| **Termin usunięcia** | Cache wyniku wygasa po 1 godzinie. Klucz cache'u to **skrót SHA-256 adresu**, nie sam adres |
| **Zabezpieczenia** | Walidacja adresu i blokada zasobów wewnętrznych (`ipGuard.ts`), przypięcie zwalidowanego IP przeciw DNS rebinding, limit 2 MB, timeout, rewalidacja przekierowań, egzekwowanie `robots.txt` |
| **Gdzie w kodzie** | `src/server/net/safeFetch.ts`, `src/server/net/robots.ts`, `src/server/extract/cache.ts` |

---

## Czynność 3 — Analiza treści ogłoszenia przez model językowy

| Element | Opis |
|---|---|
| **Cel** | Wyodrębnienie wymagań, obowiązków i słów kluczowych z ogłoszenia |
| **Kategorie osób** | Pośrednio osoby, których dane pojawiają się w treści ogłoszenia |
| **Kategorie danych** | Treść ogłoszenia **po pseudonimizacji** — e-maile, telefony, PESEL i odnośniki zastąpione symbolami |
| **Podstawa prawna** | Art. 6 ust. 1 lit. b |
| **Odbiorcy** | Google (Gemini API) jako podmiot przetwarzający |
| **Transfer poza EOG** | **Tak — USA.** Podstawa do ustalenia i udokumentowania (SCC albo DPF) |
| **Termin usunięcia** | Po stronie administratora nie przechowujemy treści zapytań. Retencja po stronie Google — wg umowy powierzenia |
| **Zabezpieczenia** | Pseudonimizacja przed wysłaniem, bramka `assertNoPii` przerywająca wysyłkę przy wykryciu danych osobowych, klucz API wyłącznie po stronie serwera, brak treści promptów w logach |
| **Gdzie w kodzie** | `src/server/pseudonymize.ts`, `src/server/gemini.ts`, `src/server/routes/ai.routes.ts` |

---

## Czynność 4 — Rejestrowanie zużycia modelu i zdarzeń technicznych

| Element | Opis |
|---|---|
| **Cel** | Kontrola kosztów API i wykrywanie nadużyć |
| **Kategorie osób** | Użytkownicy aplikacji |
| **Kategorie danych** | Liczba tokenów, nazwa operacji, znacznik czasu, adres IP (limitowanie), identyfikator błędu |
| **Podstawa prawna** | Art. 6 ust. 1 lit. f — prawnie uzasadniony interes |
| **Odbiorcy** | Dostawca hostingu (logi) |
| **Termin usunięcia** | Wg retencji dostawcy — do ustalenia przy wdrożeniu |
| **Zabezpieczenia** | **Do logów nie trafia treść promptu ani odpowiedzi modelu** — wyłącznie liczby i nazwy operacji |
| **Gdzie w kodzie** | `src/server/usageLedger.ts`, `src/server/middleware/errorHandler.ts` |

---

## Czynność 5 — Korpus podpowiedzi do formularzy *(schemat gotowy, przetwarzanie jeszcze nie rusza)*

| Element | Opis |
|---|---|
| **Cel** | Podpowiadanie nazw umiejętności, narzędzi i uprawnień typowych dla danego stanowiska, na podstawie tego, co podali inni użytkownicy |
| **Kategorie osób** | Użytkownicy, którzy wyrazili odrębną zgodę |
| **Kategorie danych** | Wyłącznie **znormalizowane nazwy** umiejętności, narzędzi i uprawnień, powiązane ze znormalizowaną nazwą firmy i stanowiska oraz z identyfikatorem konta. **Nie trafia tu treść CV**: żadnych opisów obowiązków, osiągnięć, dat zatrudnienia, widełek ani nazwisk |
| **Podstawa prawna** | Art. 6 ust. 1 lit. a — zgoda. Dobrowolna; jej brak nie ogranicza działania aplikacji |
| **Odbiorcy** | Inni użytkownicy, wyłącznie w postaci **zagregowanej powyżej progu k ≥ 5 różnych osób**. Pojedynczy wkład nie jest widoczny dla nikogo poza jego autorem |
| **Transfer poza EOG** | Nie występuje — baza w regionie `eu-central-1` |
| **Termin usunięcia** | Do usunięcia przez użytkownika. Cofnięcie zgody i „usuń moje dane" kasują wkład, co może zbić wartość poniżej progu i usunąć ją z podpowiedzi |
| **Zabezpieczenia** | RLS: właściciel widzi wyłącznie swoje wiersze, czytania cudzych nie ma w żadnej polityce. Jedyne wyjście z korpusu to funkcja `suggestion_corpus()` z progiem k-anonimowości wpisanym w zapytanie i odebranym prawem wykonania dla `anon` i `authenticated`. Zgody są dopisywane, nigdy nadpisywane — cofnięcie to osobny wiersz |
| **Gdzie w kodzie** | `supabase/migrations/0003_pytania_i_korpus.sql`, `src/lib/formSuggestions.ts` |

> **Stan na dziś:** tabele istnieją, ale nie ma ani jednej trasy zapisującej do
> nich dane i nie ma logowania po stronie klienta. Przetwarzanie zaczyna się
> dopiero z pierwszym wdrożeniem przepływu zgody — do tego czasu ten wpis
> opisuje **przygotowany fundament**, nie czynność wykonywaną.

---

## Czynność 6 — Prowadzenie kont użytkowników

| Element | Opis |
|---|---|
| **Cel** | Umożliwienie zapisania CV poza urządzeniem, odzyskania go po wyczyszczeniu przeglądarki i pracy na kilku urządzeniach |
| **Kategorie osób** | Osoby, które świadomie założyły konto. Tryb lokalny (bez konta) działa nadal i nie podlega tej czynności |
| **Kategorie danych** | Adres e-mail, nazwa wyświetlana, skrót hasła (liczony i przechowywany przez Supabase Auth — administrator nigdy nie widzi hasła; dotyczy wyłącznie kont e-mailowych), znaczniki czasu logowania, treść Master Vaultu. Przy logowaniu dostawcą (Google, Microsoft, LinkedIn) zamiast hasła: identyfikator konta u dostawcy, imię i nazwisko oraz e-mail przekazane w żądaniu logowania — **bez** kontaktów, zdjęć i treści profilu dostawcy |
| **Podstawa prawna** | Art. 6 ust. 1 lit. b — wykonanie usługi na żądanie osoby |
| **Odbiorcy** | Supabase (hosting bazy i uwierzytelnianie), Resend (wysyłka wiadomości potwierdzających i resetu hasła), a przy logowaniu dostawcą: Google / Microsoft / LinkedIn (wyłącznie jako uwierzytelniacz — przekazują to, co niezbędne do zalogowania) |
| **Transfer poza EOG** | Baza w regionie `eu-central-1`. Wysyłka poczty — wg umowy z Resend |
| **Termin usunięcia** | Natychmiast na żądanie. Przycisk „Usuń konto” wywołuje funkcję brzegową `usun-konto`, która kasuje dane funkcją `delete_user_data`, a następnie samo konto |
| **Zabezpieczenia** | RLS na każdej tabeli — użytkownik sięga wyłącznie własnych wierszy; potwierdzanie adresu e-mail; polityka haseł min. 12 znaków; odrzucanie haseł obecnych w znanych wyciekach; komunikaty błędów nieujawniające, czy dany adres ma konto |
| **Gdzie w kodzie** | `src/context/AuthContext.tsx`, `src/lib/cloudVault.ts`, `supabase/functions/usun-konto/` |

---

## Czynność 7 — Sprawdzanie hasła w bazie wycieków

| Element | Opis |
|---|---|
| **Cel** | Odrzucenie hasła, które już wyciekło i figuruje w słownikach atakujących |
| **Kategorie osób** | Osoby zakładające konto |
| **Kategorie danych** | **Pięć pierwszych znaków skrótu SHA-1 hasła.** Ani hasło, ani jego pełny skrót nie opuszczają urządzenia — model k-anonimowości sprawia, że odpowiedź obejmuje setki haseł naraz |
| **Podstawa prawna** | Art. 6 ust. 1 lit. f — prawnie uzasadniony interes (bezpieczeństwo kont) |
| **Odbiorcy** | HaveIBeenPwned. **Zapytanie wychodzi z naszej funkcji brzegowej, nie z przeglądarki użytkownika** — HIBP nie widzi ani adresu IP osoby zakładającej konto, ani żadnego identyfikatora |
| **Transfer poza EOG** | Tak — usługa poza EOG. Przekazywany jest wyłącznie pięcioznakowy prefiks skrótu, który nie identyfikuje ani osoby, ani hasła |
| **Termin usunięcia** | Nie przechowujemy niczego; zapytanie jest jednorazowe i bezstanowe |
| **Zabezpieczenia** | Walidacja formatu prefiksu, limit czasu 5 s, brak logowania treści. Przy niedostępności usługi rejestracja przechodzi (fail-open) |
| **Gdzie w kodzie** | `supabase/functions/sprawdz-haslo/`, `src/lib/leakedPassword.ts` |

---

## Czynności planowane — jeszcze nie wykonywane

| Czynność | Wejdzie wraz z | Uwaga |
|---|---|---|
| Przechowywanie CV na serwerze | Bazą danych | Wymaga szyfrowania kopertowego i odrębnej zgody |
| Analiza CV przez model | Uruchomieniem funkcji AI dla profilu | Pseudonimizacji **nie da się** zastosować do samego parsowania CV, bo jego zadaniem jest wydobycie danych identyfikujących — ta ścieżka wymaga odrębnej, wyraźnej zgody |
| Obsługa płatności | Stripe | Dane płatnicze przetwarza Stripe; administrator nie otrzymuje numerów kart |
| Wysyłka poczty transakcyjnej | Kontami użytkowników | Wybór dostawcy z EOG preferowany |

---

## Ocena skutków (DPIA)

Przy obecnym zakresie — dane zostają na urządzeniu użytkownika, brak profilowania, brak decyzji zautomatyzowanych — pełna DPIA nie jest wymagana.

**Przesłanki, które ją wymuszą:** przechowywanie CV na serwerze w skali wielu użytkowników, przetwarzanie wizerunku (art. 9), albo jakakolwiek forma automatycznej oceny kandydata mająca skutki wobec niego.

**Dlaczego korpus podpowiedzi (Czynność 5) tej przesłanki nie przekracza.** Nie przechowuje treści CV — wyłącznie znormalizowane nazwy umiejętności, bez opisów, dat i osiągnięć. Różnica jest celowa i jest jedynym powodem, dla którego schemat wygląda tak, a nie prościej: tabela z całym vaultem powiązanym z firmą byłaby „CV na serwerze w skali wielu użytkowników" i uruchomiłaby pełną DPIA. **Ta granica jest warunkiem, nie szczegółem implementacyjnym** — rozszerzenie korpusu o treść punktorów albo o daty wymaga DPIA przed wdrożeniem, nie po.

**Ryzyko do odnotowania już teraz:** funkcja analizy przerw w zatrudnieniu (`gapAnalysis` w ocenie ATS) wylicza luki w historii zawodowej. Wnioskowanie z nich może pośrednio dotykać zdrowia lub macierzyństwa. Decyzja: wynik pozostaje **wyłącznie po stronie klienta i nie jest nigdzie zapisywany**.

---

## Do uzupełnienia przed publikacją

- [ ] Dane rejestrowe administratora
- [ ] Umowy powierzenia z podprocesorami
- [ ] Podstawa transferu do USA
- [ ] Retencja logów u dostawcy hostingu
- [ ] Procedura zgłaszania naruszeń (72 h do UODO) — osobny dokument
- [ ] Przegląd prawnika
