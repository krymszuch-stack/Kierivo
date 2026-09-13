# Polityka bezpieczeństwa

## Zasada tego dokumentu

**Nie ma tu żadnego twierdzenia, którego nie da się wskazać palcem w kodzie.**

Poprzednia wersja tego pliku deklarowała model „Zero-Knowledge, Client-Side Encryption (AES-256-GCM z PBKDF2, 600 000 iteracji)" i dane „encrypted at all times". Żadne z tych zdań nie było prawdziwe dla ścieżki, która faktycznie się wykonywała. Deklarowanie ochrony, której nie ma, przy danych osobowych jest gorsze niż milczenie — użytkownik podejmuje wtedy decyzje na fałszywej przesłance.

Dokument opisuje stan na dziś. Sekcja „Znane ograniczenia" jest jego obowiązkową częścią i nie zniknie, gdy zrobi się niewygodna — będzie się skracać w miarę, jak kolejne pozycje faktycznie znikną z kodu.

---

## Stan obecny: prototyp działający w przeglądarce

KIERIVO pracuje domyślnie w trybie `BACKEND_MODE=local`: bez kont i bez bazy, cała praca odbywa się lokalnie, poza wyraźnie wskazanymi wywołaniami AI.

Warstwa serwerowa dla kont, trwałych danych i płatności (`BACKEND_MODE=cloud`) jest **zbudowana i pokryta testami granicznymi w CI, ale nie jest jeszcze podpięta do interfejsu**. Znaczy to dokładnie tyle: trasy `/api/me`, `/api/vault`, `/api/applications` i `/api/billing/*` odrzucają żądania bez ważnego tokenu, a `supabase/migrations/0001_init.sql` zakłada polityki RLS — natomiast żaden ekran aplikacji jeszcze z nich nie korzysta. Do czasu podpięcia obowiązują ograniczenia opisane niżej.

### Co jest chronione i gdzie to sprawdzić

| Kontrola | Gdzie w kodzie |
|---|---|
| **Klucz Gemini wyłącznie po stronie serwera** — nigdy nie trafia do przeglądarki ani do repozytorium | `src/server/config.ts`, `src/server/geminiClient.ts`; `.env` w `.gitignore` |
| **Ochrona przed SSRF** przy pobieraniu ogłoszeń z URL: walidacja adresu, blokada zakresów prywatnych, loopback, link-local (w tym metadanych chmury `169.254.169.254`) i CGNAT, **przypięcie zwalidowanego IP** (bez tego walidacja DNS jest podatna na rebinding), rewalidacja każdego przekierowania, timeout 8 s, limit 2 MB | `src/server/net/ipGuard.ts`, `src/server/net/safeFetch.ts` + testy |
| **Endpoint nie zwraca surowej treści pobranej strony** — wyłącznie wyekstrahowane pola. Degraduje ewentualny SSRF do „blind" | `src/server/routes/jobs.routes.ts` |
| **Allowlista CORS** z `Vary: Origin` zamiast gwiazdki | `server.ts` |
| **Nagłówki bezpieczeństwa** (helmet + jawne CSP, `X-Frame-Options: DENY`, wyłączony `x-powered-by`) | `server.ts`; dla frontendu `vercel.json` |
| **Limity zapytań** osobne dla endpointów AI i pobierania URL-i | `src/server/middleware/rateLimiter.ts` |
| **Błędy nie wyciekają na zewnątrz** — klient dostaje identyfikator żądania, pełny błąd zostaje w logach serwera | `src/server/middleware/errorHandler.ts` |
| **Walidacja konfiguracji przy starcie** — brak wymaganego klucza przerywa uruchomienie, zamiast ujawniać się błędem przy pierwszym żądaniu | `src/server/config.ts` |
| **Kontener nie działa jako root** | `Dockerfile` |
| **Ocena ATS i parsowanie CV liczą się lokalnie** — te funkcje nie wysyłają dokumentu nigdzie | `src/lib/atsSimulator.ts`, `src/lib/cvUniversalParser.ts` |
| **Pseudonimizacja na granicy modelu** — dane identyfikujące zamieniane na placeholdery przed wysłaniem, `photoUrl` usuwany całkowicie, bramka `assertNoPii` jako siatka bezpieczeństwa | `src/server/pseudonymize.ts` + testy na rzeczywistych ścieżkach |
| **Realne rozliczanie zużycia modelu** — liczba tokenów i szacowany koszt trafiają do ustrukturyzowanego logu i do `ai_usage_events`; **nigdy treść promptu ani odpowiedzi** | `src/server/usageLedger.ts` |
| **Weryfikacja tokenu u dostawcy, nie samo dekodowanie JWT** — token jest sprawdzany przez `auth.getUser()`, więc podpis musi się zgadzać. Samo odczytanie ładunku przyjęłoby dowolny token wymyślony przez klienta | `src/server/middleware/requireAuth.ts` |
| **Identyfikator użytkownika wyłącznie z podpisanego tokenu** — nigdy z ciała żądania ani z parametru ścieżki. Klient `service_role` omija RLS, więc `user_id` wzięty od klienta byłby zaproszeniem do odczytu cudzych danych | wszystkie trasy w `src/server/routes/` |
| **RLS na każdej tabeli**; `subscriptions`, `plans`, `usage_counters` i `ai_usage_events` są dla użytkownika **tylko do odczytu** — status subskrypcji zmienia wyłącznie webhook Stripe'a | `supabase/migrations/0001_init.sql` |
| **Limit sprawdzany i pobierany w jednej transakcji SQL** — dwie równolegle otwarte karty nie mogą obie zużyć ostatniego kredytu | funkcja `consume_quota` w migracji, `src/server/quota.ts` |
| **Weryfikacja podpisu webhooka na surowym ciele żądania** + odrzucanie duplikatów po `stripe_event_id` (Stripe dostarcza zdarzenia co najmniej raz) | `src/server/routes/stripe.routes.ts`, `server.ts` |
| **Walidacja ciał żądań schematami `zod`** wspólnymi dla klienta i serwera | `src/types/contracts.ts`, `src/server/middleware/validate.ts` |
| **CI pilnuje granicy uwierzytelnienia i sekretów** — trasy kont bez tokenu muszą zwrócić 401, a `dist/client/` nie może zawierać `service_role` ani kluczy Stripe'a | `.github/workflows/ci.yml` |

### Znane ograniczenia

To są rzeczy, które **nie** są chronione. Każda jest świadoma i każda ma przypisaną fazę naprawy.

1. **Brute-force na logowaniu ogranicza Supabase, nie my.** Logowanie idzie z przeglądarki wprost do GoTrue, więc omija limiter w `src/server/middleware/rateLimiter.ts` — ten chroni wyłącznie trasy Express. Obowiązują limity ustawione w panelu Supabase (*Authentication → Rate Limits*). Nasz limiter jest dodatkowo liczony per instancja procesu, więc przy skalowaniu poziomym i tak nie byłby twardą granicą.

   Ochrona przed hasłami z wycieków (HaveIBeenPwned) jest w Supabase funkcją planu Pro. Realizuje ją zamiast tego funkcja brzegowa `supabase/functions/sprawdz-haslo`: przeglądarka liczy SHA-1 lokalnie i wysyła **pięć pierwszych znaków** skrótu, a porównanie wraca do przeglądarki. Ani hasło, ani jego pełny skrót nie opuszczają urządzenia. Przy niedostępnym HIBP rejestracja przechodzi — cudza awaria nie może blokować zakładania konta.

   Polityka haseł (min. 12 znaków, klasy znaków, zakaz fragmentu adresu e-mail) jest w `src/lib/passwordPolicy.ts` i egzekwowana przed wysłaniem żądania. Komunikaty błędów nie zdradzają, czy dany adres ma konto (`src/lib/authErrors.ts`) — inaczej formularz logowania byłby narzędziem do sprawdzania, kto szuka pracy.

2. **Dane są zapisywane czystym tekstem.** CV i profil leżą w `localStorage` bez szyfrowania. Wcześniejsza wersja zapisywała obok kopię „zaszyfrowaną" kluczem `'default_key'` zaszytym w kodzie aplikacji — przy modelu zagrożeń „XSS czyta `localStorage`" nie chroni to przed niczym, bo atakujący wykonujący skrypt na stronie odczyta ten klucz z tego samego pakietu. Usunęliśmy pozorne szyfrowanie zamiast utrzymywać wrażenie ochrony; od tej wersji nie ma już w kodzie także funkcji WebCrypto, które tę ochronę pozorowały, nie mając ani jednego wywołania. Realne szyfrowanie w spoczynku (kopertowe, z kluczem poza bazą) przychodzi razem z przeniesieniem danych na serwer.

3. **Vault w chmurze zapisuje przeglądarka, nie serwer.** `src/lib/cloudVault.ts` rozmawia z tabelą `vaults` kluczem `anon`, a granicą jest **RLS**: polityki przepuszczają wyłącznie wiersz, w którym `auth.uid() = user_id` (`supabase/migrations/0001_init.sql`), co sprawdza `npm run test:rls`. Trasy `GET/PUT /api/vault` istnieją i robią to samo kluczem `service_role`, ale na dzisiejszym wdrożeniu są nieosiągalne — pod `cvelocity.oathcry.com` stoi sam frontend na Firebase Hosting, więc `/api/*` tam nie ma. Dwa kanały do jednej tabeli są świadome i opisane w komentarzu `cloudVault.ts`; różnią się wyłącznie tym, kto egzekwuje własność wiersza.

4. **Do modelu trafiają dwie rzeczy: treść ogłoszenia i profil kandydata.** Trasy sięgające Gemini to `/api/parse-jd` i `/api/generate-cheat-sheet`; **obie wymagają `requireAuth`** (`src/server/routes/ai.routes.ts`). Druga przyjmuje cały `MasterVault`, więc CV opuszcza przeglądarkę — po pseudonimizacji opisanej niżej. Pozostałe funkcje konsumujące profil (list motywacyjny, przeformułowanie punktorów, doradca) nadal nie są wystawione jako endpointy.

   Zanim te funkcje wrócą, granica modelu jest już zabezpieczona: `src/server/pseudonymize.ts` zamienia imię i nazwisko, e-mail, telefon, miasto i odnośniki na placeholdery, **`photoUrl` usuwa całkowicie** (wizerunek to art. 9 RODO), a bramka `assertNoPii` przerywa wysyłkę, gdyby jakakolwiek przyszła ścieżka ominęła pseudonimizację. Prawdziwe wartości wracają dopiero do wyniku pokazywanego użytkownikowi. Dowodzą tego testy uruchamiane na rzeczywistych ścieżkach `gemini.ts`, nie na samej funkcji pomocniczej (`src/server/__tests__/geminiBoundary.test.ts`).

   **Jeden świadomy wyjątek:** parsowanie CV przez model (`parseRawCvToVault`) nie może być pseudonimizowane, bo jego zadaniem jest właśnie wydobycie imienia, e-maila i telefonu — usunięcie ich z wejścia zniszczyłoby funkcję. Ta ścieżka wymaga osobnej zgody użytkownika i dlatego nie jest dziś wystawiona.

5. **Status subskrypcji jest w interfejsie nadal zapisywalny po stronie klienta.** Trzyma go `localStorage` (`src/store/useEntitlements.ts`), więc nie stanowi kontroli dostępu — jest etykietą i licznikiem, który ma reagować natychmiast, bez czekania na sieć. Sklep mówi to o sobie wprost w komentarzu na górze pliku.

   Serwerowa strona tego nie przyjmuje: `subscriptions` nie ma polityki zapisu dla użytkownika, a limit pobiera funkcja `consume_quota` w bazie. Warunek zdjęcia tego punktu z listy — trasy AI wymagające `requireAuth` — jest **już spełniony** (`ai.routes.ts`), więc etykieta w przeglądarce nie daje dostępu do niczego płatnego. Zostaje wyłącznie kosmetyka: interfejs potrafi przez chwilę pokazać status, którego serwer nie potwierdza.

6. **Przycisk odblokowania demo istniał w buildzie produkcyjnym.** `StripeCheckoutModal` pokazywał „Symuluj natychmiastowe odblokowanie", które nadawało status Pro bez płatności, każdemu, kto wszedł na cennik bez skonfigurowanego klucza Stripe'a. Naprawione: przycisk jest za `import.meta.env.DEV`, więc znika z pakietu produkcyjnego. Odnotowane tutaj, bo dotyczyło wydanego kodu.

7. **Brak kopii zapasowych i odtwarzania.** W trybie lokalnym wyczyszczenie danych przeglądarki kasuje wszystko bezpowrotnie — i interfejs mówi to wprost przy zakładaniu profilu. Konto w chmurze przenosi źródło kopii na Supabase, ale plan Free kopii **nie ma**, więc od pierwszego płacącego klienta plan Pro przestaje być opcjonalny (art. 32 RODO).

---

## Zgłaszanie podatności

Jeśli znajdziesz podatność (np. wektor XSS, obejście walidacji adresów, wyciek danych), **nie zakładaj publicznego zgłoszenia w GitHubie**.

* **Kontakt:** Adrian Koziński
* **E-mail:** `krymszuch00@outlook.com`
* **Temat:** `[SECURITY] KIERIVO — <krótki opis>`

### Co warto dołączyć

1. Opis podatności i jej możliwego wpływu.
2. Kroki odtworzenia lub proof of concept.
3. Wskazanie komponentu, pliku lub endpointu.
4. Propozycję naprawy, jeśli ją masz.

### Czego możesz się spodziewać

Projekt prowadzi jedna osoba, więc terminy są realistyczne, a nie korporacyjne:

1. **Potwierdzenie odbioru** — do 72 godzin.
2. **Wstępna ocena** — do 14 dni.
3. **Naprawa** — zależnie od wagi; przy poważnych podatnościach priorytetowo, przy pozostałych w kolejnym cyklu prac. Poinformuję Cię o terminie po ocenie.
4. **Ujawnienie** — po wdrożeniu poprawki, z podziękowaniem dla zgłaszającego, jeśli wyrazi na to zgodę.

Powyższe to deklaracja dobrej woli, nie umowa SLA.

### Zasady odpowiedzialnego ujawniania

* Daj czas na naprawę przed publicznym ujawnieniem.
* Nie uzyskuj dostępu do cudzych danych, nie modyfikuj ich i nie niszcz.
* Nie zakłócaj działania usługi.

---

## Wersje objęte wsparciem

| Wersja | Wsparcie | Uwagi |
|---|---|---|
| `main` | ✅ | Aktywnie rozwijana; prototyp przed pierwszym wydaniem produkcyjnym |
| < 1.0 | ❌ | Wersje rozwojowe, bez wsparcia |
