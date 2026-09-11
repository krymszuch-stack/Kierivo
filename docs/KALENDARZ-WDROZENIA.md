# Kalendarz wdrożenia — od prototypu do pierwszych przychodów

> Plan wykonawczy do audytu **„CVelocity — plan od działającego prototypu do
> pierwszych przychodów"** (29.08.2026). Audyt mówi **co** i **dlaczego**.
> Ten dokument mówi **kiedy**, **w jakiej kolejności** i **po czym poznasz, że
> dzień jest zamknięty**.
>
> Data startu: **sobota 29.08.2026**. Bramka GO/NO-GO: **piątek 18.09.2026**.
> Rozstrzygnięcie pilotażu: **niedziela 04.10.2026**.

Kalendarz jest propozycją, nie wyrokiem. Przed pierwszym dniem przeczytaj
sekcję 2 (założenia) i sekcję 11 (jak go przeskalować) — jeśli Twoja realna
pojemność jest inna, przesuwają się daty, ale **nie kolejność** i **nie
bramki**.

---

## 1. Weryfikacja audytu w kodzie — stan na 29.08.2026

Przed ułożeniem kalendarza sprawdziłem każdą tezę audytu w repozytorium.
Trzy rzeczy okazały się **łatwiejsze**, dwie **trudniejsze**, jedna była
**nieaktualna**. Kalendarz jest ułożony pod ten zweryfikowany stan, nie pod
opis z audytu.

| Teza audytu | Stan faktyczny w repo | Dowód |
|---|---|---|
| Produkcja serwuje tylko statyczny frontend | **Potwierdzone i wyjaśnione.** `firebase.json` przepisuje `**` → `/index.html` i buduje wyłącznie `build:client`. Backend nigdy nie był wdrożony — dlatego `/api/health` zwraca HTML. Dodatkowo w repo leży drugi, konkurencyjny plik hostingu (`vercel.json`, też frontend-only) | `firebase.json:5,9`, `vercel.json:3`, `.firebaserc:3` |
| Wdrożenie backendu to 3–5 dni | **Łatwiejsze niż w audycie.** Skrypt wdrożeniowy już istnieje, jest kompletny i sam bramkuje jakość: `npm run lint`, `npm test`, skan pakietu klienckiego pod kątem `sk_live`/`service_role`, sekrety z Secret Managera, test `/api/health` po deployu | `scripts/deploy-cloudrun.sh` |
| Trzeba osobnego adresu `api.cvelocity.pl` | **Niepotrzebne.** Jeden kontener serwuje i frontend, i API — Express oddaje `dist/client` statycznie, a `dist/server.mjs` obsługuje `/api/*`. Wystarczy skierować obecną domenę na Cloud Run zamiast na Firebase Hosting | `server.ts:179`, `Dockerfile` (CMD), `server.ts:171` |
| Cennik nie jest jedną prawdą | **Gorsze niż w audycie: checkout jest dziś martwy.** Widok cennika wysyła `price_cvelocity_pro_monthly`, `price_cvelocity_pro_annual` i `price_cvelocity_template_<nazwa>`. Katalog zna `pro_monthly`, `pro_yearly`, `template_executive_onetime`. Serwer szuka `plans.stripe_price_id = <to, co przyszło>` i **nie znajdzie nic** — każdy przycisk „kup" kończy się błędem, niezależnie od stanu backendu | `src/views/PricingView.tsx:44`, `:58` vs `src/lib/pricing.ts:33`, `src/server/routes/billing.routes.ts:72` |
| Karnet jest już w kodzie | **Połowicznie.** Baza ma plan `karnet` z **placeholderem** ceny, serwer ma aktywację i pulę AI, UI ma bramkę — ale w katalogu klienckim (`pricing.ts`) karnetu **nie ma w ogóle**. Nie da się go dziś kupić żadną ścieżką | `supabase/migrations/20260828225511_...sql:71` (`price_karnet_placeholder`), `stripe.routes.ts:112`, `ApplicationPassGate.tsx:34`, brak wpisu w `CATALOG` (`pricing.ts:80`) |
| Obietnice ATS są za mocne | **Potwierdzone.** Wyniki dla nazwanych systemów są wyliczane z własnej heurystyki mnożonej przez stałe (`overallScore * 0.92 + structureScore * 0.08` jako „Workday"). Nagłówek mówi „Konsensus Rynkowy", a menu obiecuje audyt „pod kątem Workday, Taleo, Greenhouse i iCIMS" | `src/features/matcher/AtsSimulatorView.tsx:29–32`, `src/features/ats/AtsLabView.tsx:126`, `src/components/layout/Sidebar.tsx:168` |
| Statyczne „spójność potwierdzona" | **Potwierdzone.** Odznaka ma zaszyty tekst `100% zgodności z MasterVault`, pokazywany w sześciu miejscach niezależnie od wyniku walidacji | `ConsistencyLockBadge.tsx:20,42`; użycia: `ConsistencyGuardView.tsx` (5×), `MasterVaultEditor.tsx:175` |
| Repo ma niezacommitowane zmiany | **Nieaktualne.** Drzewo robocze jest czyste, `main` = `d8ba941`. Faza 0 audytu w tym punkcie jest już wykonana | `git status` |
| Landing sprzedaje więcej, niż produkt potrafi | **Częściowo naprawione.** Makiety na landingu są już podpisane „przykład"/„dane przykładowe" — poprzednia runda audytu UI to domknęła. Zostaje warstwa ATS i odznaki spójności | `LandingView.tsx:418,429,471,510` |
| Migracje 0005–0007 to dokumentacja, nie stan bazy | **Częściowo nieaktualne.** Powstała migracja scalająca (`20260828225511_runtime_backend_tables.sql`) plus wyłączenie gamifikacji (`20260829090000`). Nadal **nikt nie potwierdził, że są zaaplikowane w projekcie Supabase** — to zadanie dnia 07.09 | `supabase/migrations/`, `NOTATKI.md` (wpis po PR #101) |
| Brak regulaminu | **Potwierdzone.** Są: polityka prywatności, podprocesorzy, rejestr czynności. **Regulaminu usługi cyfrowej nie ma nigdzie w repo** | `docs/` (brak pliku), `grep -rl "regulamin"` → tylko `SETUP.md`, `polityka-prywatnosci.md` |

### Co z tego wynika dla planu

1. **Faza 3 audytu (backend) kosztuje ~1,5 dnia, nie 5.** Skrypt jest napisany.
   Prawdziwa praca to sekrety, migracje i domena — nie kod.
2. **Faza 4 (płatność) jest pilniejsza, niż wygląda.** Nie chodzi o
   „ujednolicenie katalogu" — chodzi o to, że **dziś nikt nie ma jak zapłacić**,
   nawet gdyby chciał i gdyby backend stał.
3. **Kolejność faz z audytu wymaga jednej zmiany** — patrz sekcja 3.

---

## 2. Założenia kalendarza

| Założenie | Wartość | Konsekwencja, jeśli nieprawda |
|---|---|---|
| Pracujesz sam | 1 osoba | Nie ma pracy równoległej; wszystko poniżej jest szeregowe |
| Pojemność w dni robocze | **3 h** (wieczór) | patrz sekcja 11 |
| Pojemność w sobotę | **6 h** | — |
| Pojemność w niedzielę | **3 h** albo dzień wolny (bufor) | — |
| Tygodniowo | **~24 h** | Do bramki GO/NO-GO: ~68 h dostępnych, ~66 h zaplanowanych |
| Konto Stripe | istnieje w trybie **testowym** | Aktywacja live wymaga danych firmy — **ryzyko R1, sprawdź dziś** |
| Projekt Supabase | istnieje | Jeśli nie — dołóż 3 h w dniu 07.09 |
| Domena `cvelocity.oathcry.com` | pod Twoją kontrolą (DNS) | Jeśli nie — dzień 09.09 przesuwa się o czas dostępu do DNS |

**Definicja „dnia zamkniętego":** zadania odhaczone, `npm run lint` i
`npm test` na zielono, zmiana w PR-ze na gałęzi, jedno zdanie w dzienniku
(sekcja 9). Dzień bez commita nie jest dniem zamkniętym — jest dniem
przesuniętym.

---

## 3. Jedna zmiana wobec kolejności z audytu

Audyt układa fazy: `0 → 1 → 2 (jedna ścieżka) → 3 (backend) → 4 (płatność) → …`

**Proponuję przenieść Fazę 2 za pilotaż.** Uzasadnienie, nie preferencja:

- Faza 2 to najdroższy blok w całym audycie (5–7 dni) i jedyny, którego
  kryterium ukończenia brzmi *„nowa osoba **bez instrukcji** dojdzie do
  dokumentu w 7 minut"*. To kryterium **publicznego startu**, nie pilotażu.
- Pilotaż z audytu to **15 zaproszonych osób i rozmowa z udostępnieniem
  ekranu** (Faza 7). Te osoby dostają instrukcję od Ciebie, na żywo. Nie
  potrzebują samoobsługowego onboardingu — potrzebują działającej płatności
  i wyniku, któremu można zaufać.
- Uproszczenie ścieżki zaprojektowane **po** obejrzeniu dziesięciu prawdziwych
  sesji trafia w miejsca, w których ludzie faktycznie utykają. Zaprojektowane
  przed — trafia w miejsca, o których myślisz, że utykają. Audyt sam stawia to
  pytanie testerom („w którym miejscu prawie zrezygnowałeś?"), więc ma źródło
  danych — wystarczy poczekać na dane.
- Ryzyko tej zamiany jest ograniczone i policzalne: 15 osób × jedna rozmowa.
  Ryzyko odwrotne — 7 dni pracy nad UI, zanim ktokolwiek zapłacił — to dokładnie
  ten błąd, przed którym ostrzega zdanie otwierające audyt.

**Co z tego zostaje przed bramką:** wszystko, co dotyczy uczciwości, płatności,
prawa i danych. Wycinane są wyłącznie prace nad wygodą przepływu.

Kolejność w tym kalendarzu: `0 → 1 (uczciwość + jedna cena) → 3 (backend) →
4 (płatność) → 5 (prawo) → 6 (analityka) → BRAMKA → 7 (płatna beta) →
2 (jedna ścieżka) → start publiczny`.

---

## 4. Kamienie milowe

| # | Kamień | Data | Warunek zaliczenia (jedno zdanie) |
|---|---|---|---|
| **M0** | Stan zabezpieczony | **nd 30.08** | Nikt nie może kliknąć „kup", jest tag `pre-productization-audit`, decyzje produktowe są zapisane |
| **M1** | Uczciwy produkt, jedna cena | **nd 06.09** | Każde zdanie z liczbą lub gwarancją ma mechanizm w kodzie; katalog ceny to jeden klucz w trzech miejscach |
| **M2** | Pieniądze przechodzą | **nd 13.09** | Prawdziwa karta płaci 49 zł, webhook aktywuje karnet raz, zwrot działa |
| **M3** | Gotowość do sprzedaży | **pt 18.09** | Bramka GO/NO-GO z audytu §10 przechodzi w całości |
| **M4** | Pilotaż rozstrzygnięty | **nd 04.10** | ≥5 płatności albo świadoma decyzja o zmianie segmentu/oferty |
| **M5** | Start publiczny | po M4 | Faza 2 audytu wykonana na podstawie nagranych sesji |

Bufory: **nd 06.09**, **nd 20.09**, **cały nd 13.09 po smoke teście**.
Bufor jest częścią planu, nie zapasem na „może się przyda".

---

## 5. Tydzień 0 — zabezpieczenie stanu (29–30.08)

### Sobota 29.08 — Dzień 0 · decyzje właściciela · 3 h

Nic tu nie jest kodem. To jedyne rzeczy, których nie może za Ciebie zrobić
żaden agent, i wszystko dalej się o nie opiera.

- [ ] **(30 min) Sprawdź status konta Stripe** — czy jest aktywowane do
      płatności live, czy tylko testowe. Jeśli brak firmy/JDG albo weryfikacja
      nie ruszyła: **to jest ryzyko numer jeden całego planu** (R1, sekcja 10),
      uruchom je dzisiaj, bo weryfikacja bywa liczona w dniach, nie godzinach.
- [ ] **(30 min) Zapisz zdanie pozycjonujące i segment** w `docs/o-projekcie.md`.
      Propozycja z audytu §3 jest gotowa do przyjęcia albo odrzucenia — nie do
      przepisywania od zera.
- [ ] **(30 min) Zatwierdź model płatny:** Free + Karnet 30 dni / 49 zł.
      Jedna cena, jeden `lookup_key`: **`karnet_30d`**. Brak planu rocznego,
      brak płatnych szablonów, brak lifetime.
- [ ] **(60 min) Wyłącz wszystkie płatne CTA, które dziś nie działają.**
      Konkretnie: `PricingView.tsx` (Pro miesięczny, Pro roczny, szablony) —
      to są przyciski, które i tak kończą się błędem serwera. Nie muszą wyglądać
      pięknie; muszą przestać obiecywać.
- [ ] **(30 min) Utwórz backlog P0** z audytu §7 — jako issues albo lista
      w `NOTATKI.md`. Jedno zadanie = jeden dzień z tego kalendarza.

> **Gotowe, gdy:** na produkcji nie istnieje ani jeden klikalny „kup".
> **Dowód:** przejście po `/pricing` na żywo i zrzut ekranu do dziennika.

### Niedziela 30.08 — Dzień 0b · higiena · 3 h

- [ ] **(30 min)** `git tag pre-productization-audit && git push --tags` —
      punkt powrotu sprzed przebudowy produktowej.
- [ ] **(45 min)** Kopia konfiguracji Supabase i Stripe **poza repo**
      (menedżer haseł / prywatny dokument). Żaden sekret nie trafia do gita —
      `.env.example` pozostaje jedynym plikiem środowiskowym w repozytorium.
- [ ] **(45 min) Rozstrzygnij konflikt hostingu.** W repo są dwie konfiguracje
      (`firebase.json` i `vercel.json`), obie frontend-only. Zostaje jedna —
      rekomendacja: **Cloud Run** (skrypt i Dockerfile już to zakładają),
      a `vercel.json` usuń, żeby nikt nie wdrożył przez pomyłkę wersji bez API.
- [ ] **(30 min)** Wyczyść środowisko demo ze śmieciowych rekordów
      („sese", „aeaea"). Konto pokazowe ma mieć dane realistyczne i **oznaczone
      jako przykładowe**.
- [ ] **(30 min)** Przeczytaj `AGENTS.md` §„Dziesięć reguł" jeszcze raz.
      Cały tydzień 1 jest egzekucją reguły 1 i reguły 3.

> **M0 zaliczony, gdy:** tag istnieje, CTA są martwe, jest jedna konfiguracja
> hostingu, demo jest czyste.

---

## 6. Tydzień 1 — uczciwy produkt i jedna cena (31.08 – 06.09)

Cel tygodnia: **każde zdanie z liczbą, gwarancją, „AI" albo „chmurą" ma
wskazany mechanizm w kodzie albo znika.** To jest warunek wstępny brania
pieniędzy — nie kwestia stylu.

### Poniedziałek 31.08 · Warstwa ATS · 3 h

- [ ] Usuń wyliczane wyniki dla nazwanych systemów (`AtsSimulatorView.tsx:29–32`).
      Nie „schowaj za disclaimerem" — usuń. Liczba `overallScore * 0.92`
      podpisana „Workday" jest wymyślonym pomiarem (reguła 1).
- [ ] „Audyt ATS i **Konsensus Rynkowy**" → „Wynik filtrów CVelocity"
      (`AtsLabView.tsx:126`, identyfikator `konsensus_cvelocity` w
      `atsSimulator.ts:925` i podpowiedź w `Sidebar.tsx:168`).
- [ ] Wprowadź język wyniku z audytu §3: *„CVelocity wykryło 12 z 18 istotnych
      pojęć z ogłoszenia (…). Wynik jest heurystyką CVelocity, nie oceną ani
      gwarancją zewnętrznego systemu ATS."*
- [ ] `grep -rn "Workday\|Taleo\|Greenhouse\|iCIMS\|eRecruiter" src/` — popraw
      **wszystkie** trafienia w jednej zmianie (reguła 4), zostawiając te,
      które są neutralną wiedzą w słowniku/promptach, a nie obietnicą wyniku.

> **Gotowe, gdy:** żaden ekran nie pokazuje procentu przypisanego do cudzego
> systemu. **Dowód:** wynik grepa w opisie PR-a.

### Wtorek 01.09 · Reszta niezweryfikowanych obietnic · 3 h

- [ ] Odznaka spójności: zaszyte `100% zgodności z MasterVault`
      (`ConsistencyLockBadge.tsx:42`) → realny wynik walidacji albo stan
      neutralny. Sprawdź wszystkie 6 użyć.
- [ ] Usuń słowo „AI" z funkcji, które są regułowe (silniki deterministyczne).
      Miejsce prawdy dla nazewnictwa: `docs/slownik-terminow.md`.
- [ ] Przejdź `docs/AUDYT-TRESCI-MARKETINGOWEJ.md` i odhacz to, co jeszcze żyje.
- [ ] Ujednolić nazwę produktu, planu, audytu i magazynu danych — jedna nazwa
      na fakt, zgodnie ze słownikiem.

> **Gotowe, gdy:** przechodzisz aplikację ekran po ekranie i przy każdej liczbie
> umiesz wskazać linię kodu, która ją policzyła.

### Środa 02.09 · Jedno źródło ceny (część 1) · 3 h

To jest naprawa martwego checkoutu — najważniejsza pojedyncza zmiana tygodnia.

- [ ] `src/lib/pricing.ts`: wytnij `PRO_MONTHLY`, `PRO_YEARLY`,
      `TEMPLATE_*`, `TEMPLATE_PACK`. Zostaje **jeden** wpis:
      `KARNET_30D` → `priceId: 'karnet_30d'`, `planId: 'karnet'`,
      `grossAmount: 4900`, `recurring: false`.
- [ ] `PricingView.tsx`: przestań sklejać `sku` w widoku (`:44`, `:58`).
      Bierz go z katalogu — dokładnie po to katalog powstał, mówi o tym komentarz
      otwierający `pricing.ts`.
- [ ] Nowa migracja Supabase: `plans` dostaje `karnet` →
      `stripe_price_id = 'karnet_30d'` (dziś jest `price_karnet_placeholder`),
      pozostałe plany `active = false`. Migracja, nie ręczny UPDATE w konsoli.

> **Gotowe, gdy:** ten sam ciąg `karnet_30d` występuje w kodzie klienta,
> w migracji i (od 10.09) w Stripe. **Dowód:** `grep -rn "karnet_30d"` daje
> trzy trafienia i zero innych identyfikatorów cen.

### Czwartek 03.09 · Jedno źródło ceny (część 2) · 3 h

- [ ] `useEntitlements` / `me.routes.ts`: karnet jako **jedyna** brama dostępu.
      Ścieżki `isPro`/szablonowe schodzą z drogi, nie zostają „na wszelki wypadek"
      (reguła 5: kod bez konsumenta nie zostaje w repo).
- [ ] `ApplicationPassGate` staje się jedyną bramą płatną w UI.
- [ ] Przejrzyj testy katalogu i uprawnień — mają opisywać nowy model, nie stary.
- [ ] Ekran cennika: Free vs Karnet, dwie kolumny, jedno CTA.

> **Gotowe, gdy:** w aplikacji istnieje dokładnie jeden produkt do kupienia.

### Piątek 04.09 · Bramka jakości + PR · 3 h

- [ ] `npm run lint` (to jest bramka CI: ESLint + `tsc --noEmit`).
- [ ] `npm test` — cała suita na zielono.
- [ ] PR na gałąź z opisem **dlaczego**, nie tylko **co** (checklista z `AGENTS.md`).
- [ ] Przegląd tygodnia: co przesunięte, co zjadło bufor.

### Sobota 05.09 · Teksty i demo · 6 h

- [ ] Przepisz hero landingu na jedną obietnicę (audyt §5, ekran 1).
- [ ] Przygotuj **dwa oznaczone scenariusze przykładowe** (np. IT support
      i customer support) — realistyczne, wyraźnie podpisane „przykład".
- [ ] Sekcja „Nie wymyślamy faktów" na landingu — to jest Twój wyróżnik,
      dziś schowany.
- [ ] Prywatność opisana konkretnie: co zostaje lokalnie, co idzie na serwer.
      Materiał źródłowy: `docs/polityka-prywatnosci.md`, `docs/podprocesorzy.md`.

### Niedziela 06.09 · **BUFOR** + przegląd M1

- [ ] Przejdź listę „Kryterium ukończenia" Fazy 1 z audytu, punkt po punkcie.
- [ ] Jeśli bufor jest wolny — **nie dokładaj funkcji.** Odpocznij albo zrób
      dzień 07.09 wcześniej.

---

## 7. Tydzień 2 — backend i pieniądze (07–13.09)

Cel tygodnia: **prawdziwa karta płaci prawdziwe 49 zł i dostaje dostęp bez
Twojej ręcznej interwencji w bazie.**

### Poniedziałek 07.09 · Supabase · 3 h

- [ ] Zaaplikuj wszystkie migracje z `supabase/migrations/` do projektu
      produkcyjnego. Potwierdź, że `plans`, `profiles`, `user_quotas`,
      `activate_application_pass` i `template_entitlements` istnieją naprawdę —
      `NOTATKI.md` ostrzega, że część migracji była dotąd tylko dokumentacją.
- [ ] `npm run test:rls` — RLS na tabelach decydujących o pieniądzach.
- [ ] Sprawdź `20260829090000_disable_gamification_api.sql` — gamifikacja
      zeszła z drogi w #107, baza ma to odzwierciedlać.

> **Gotowe, gdy:** `select * from plans where active` zwraca **jeden** wiersz:
> `karnet` / `karnet_30d`.

### Wtorek 08.09 · Cloud Run · 3 h

- [ ] Sekrety do Google Secret Manager: `gemini-api-key`,
      `supabase-service-role`, `stripe-secret`, `stripe-webhook-secret`
      (nazwy narzucone przez `scripts/deploy-cloudrun.sh:85`).
- [ ] `./scripts/deploy-cloudrun.sh <PROJECT_ID>` — skrypt sam odpali lint,
      testy i skan pakietu klienckiego pod kątem wycieku kluczy.
- [ ] `BACKEND_MODE=cloud`, `TRUST_PROXY=true`, `APP_URL` — bez tego
      `config.ts:89` nie wystartuje w trybie chmurowym i dobrze robi.

> **Gotowe, gdy:** `curl https://<cloud-run-url>/api/health` zwraca **JSON**
> i kod 200. To jest pierwszy z warunków GO z audytu §10.

### Środa 09.09 · Domena, CORS, monitoring · 3 h

- [ ] Przepnij `cvelocity.oathcry.com` z Firebase Hosting na Cloud Run
      (mapowanie domeny). Uwaga na TTL DNS — zaplanuj to **rano**, nie wieczorem.
- [ ] CORS wyłącznie dla domeny produkcyjnej.
- [ ] Monitoring dostępności `/api/health` + alert na maila (uptime check).
      Awaria API ma być widoczna dla Ciebie, zanim zgłosi ją klient.
- [ ] Sentry: potwierdź, że błędy z produkcji faktycznie dolatują.

> **Gotowe, gdy:** `curl https://cvelocity.oathcry.com/api/health` zwraca JSON —
> ten sam adres, który w audycie zwracał HTML.

### Czwartek 10.09 · Stripe Test · 3 h

- [ ] Produkt „Karnet CVelocity" + cena **49 zł jednorazowo**,
      `lookup_key = karnet_30d` (**najpierw w trybie testowym**).
- [ ] Ten sam klucz w tabeli `plans` — sprawdź, że migracja z 02.09 go wstawiła.
- [ ] Checkout w trybie `payment` (nie `subscription`) — to zakup jednorazowy.
- [ ] Pierwsza płatność testową kartą, od kliknięcia do powrotu.

### Piątek 11.09 · Webhook i ekran sukcesu · 3 h

- [ ] Webhook aktywuje karnet **dokładnie raz** — idempotencja jest wymagana,
      Stripe potrafi dostarczyć zdarzenie dwa razy.
- [ ] `activate_application_pass` przedłuża od końca bieżącego karnetu, nie od
      „teraz" (tak już jest w migracji — potwierdź testem).
- [ ] Ekran sukcesu z **jawną datą wygaśnięcia** karnetu.
- [ ] Procedura zwrotu + adres kontaktowy do reklamacji.

### Sobota 12.09 · Sześć scenariuszy płatności · 6 h

Każdy scenariusz kończy się wpisem „przeszło / nie przeszło" w dzienniku:

- [ ] 1. Płatność udana → karnet aktywny natychmiast po powrocie.
- [ ] 2. Anulowanie w kasie → brak uprawnienia, brak śladu.
- [ ] 3. **Podwójny webhook** → jedno przedłużenie, nie dwa.
- [ ] 4. **Brak webhooka** (opóźnienie) → co widzi użytkownik? Ma zobaczyć
      „przetwarzamy", nie „nie masz dostępu".
- [ ] 5. Zwrot → dostęp rozliczony wg jawnej polityki.
- [ ] 6. Wygaśnięcie po 30 dniach → powrót do Free bez utraty danych.

> **Gotowe, gdy:** wszystkie sześć mają odpowiedź w dzienniku. Scenariusz 3 i 4
> są tymi, które psują się w produkcji i kosztują zwroty.

### Niedziela 13.09 · Przełączenie na Live · 3 h

- [ ] Stripe → tryb live. Ten sam `lookup_key`, więc katalog się nie rozjeżdża
      (to był powód użycia `lookup_key` zamiast `price_1Abc...`).
- [ ] **Smoke test prawdziwą kartą:** kup karnet za własne 49 zł, sprawdź dostęp,
      zrób zwrot. To jedyny test, który sprawdza całą drogę pieniędzy.
- [ ] **M2 zaliczony.**

---

## 8. Tydzień 3 — prawo, pomiar, bramka (14–20.09)

### Poniedziałek 14.09 · Regulamin · 3 h

Jedyny dokument, którego w repo **nie ma w ogóle**.

- [ ] Regulamin usługi cyfrowej: dane przedsiębiorcy, kontakt, zakres usługi,
      cena, czas dostępu (30 dni), reklamacje.
- [ ] Zasady odstąpienia i rozpoczęcia świadczenia usługi cyfrowej —
      źródła w audycie §12 (UOKiK).
- [ ] CTA przy płatności jednoznacznie oznaczające **obowiązek zapłaty**.
- [ ] Dane firmy i wsparcia w stopce.

> **Uwaga:** audyt mówi wprost, że nie zastępuje opinii prawnika. Ten dzień
> przygotowuje materiał **do** konsultacji, nie zamiast niej. Jeśli konsultacja
> ma się odbyć — umów ją w tygodniu 1, żeby termin nie zablokował bramki.

### Wtorek 15.09 · Dane użytkownika · 3 h

- [ ] Działający eksport wszystkich danych.
- [ ] Działające usunięcie konta i danych — z iteracją po rejestrze kluczy
      w `src/lib/storage.ts` (klucz spoza rejestru przeżyje „usuń moje dane";
      to się już raz zdarzyło).
- [ ] Potwierdzenie zakupu i warunków na trwałym nośniku (e-mail).
- [ ] Lista podprocesorów zgodna z realnym stanem: hosting, Supabase, Stripe,
      Sentry, dostawca AI (`docs/podprocesorzy.md`).

### Środa 16.09 · Analityka lejka · 3 h

Jedenaście zdarzeń z audytu §6, każde z anonimowym identyfikatorem, typem planu,
czasem i wersją aplikacji. **Zero treści CV, zero treści ogłoszenia, zero PII.**

- [ ] `landing_view`, `start_clicked`
- [ ] `cv_import_started`, `cv_import_completed`
- [ ] `facts_confirmed`, `job_pasted`, `analysis_completed`
- [ ] `suggestion_accepted`, `export_completed`
- [ ] `checkout_started`, `checkout_completed`, `returned_day_7`

> **Gotowe, gdy:** umiesz policzyć konwersję każdego etapu, a z tabeli zdarzeń
> **nie da się odtworzyć czyjegoś CV**. Sprawdź to, patrząc na surowe wiersze.

### Czwartek 17.09 · Pięć przejść na sucho · 3 h

- [ ] Pięć osób (znajomi, nie segment docelowy) przechodzi przepływ bez Twojej
      pomocy: wejście → import → analiza → eksport.
- [ ] Zapisuj **miejsca zatrzymania**, nie opinie.
- [ ] Napraw wyłącznie to, co blokuje. Reszta idzie do backlogu na Fazę 2.
- [ ] Sprawdź przepływ na telefonie — nie tylko na laptopie.

### Piątek 18.09 · **BRAMKA GO / NO-GO** · 3 h

Lista z audytu §10, bez skrótów. Jeden punkt na „nie" = NO-GO.

**GO — wszystkie muszą być na tak:**

- [ ] API live zwraca właściwe odpowiedzi, nie SPA fallback
- [ ] wszystkie testy przechodzą
- [ ] test płatności i webhooka przeszedł
- [ ] cena i zakres identyczne w landingu, w checkout i w bazie
- [ ] brak niezweryfikowanych gwarancji i procentów
- [ ] regulamin i prywatność dostępne **przed** zakupem
- [ ] użytkownik może pobrać i usunąć dane
- [ ] support ma działający adres i deklarowany czas odpowiedzi
- [ ] pięć osób bez pomocy skończyło główny przepływ
- [ ] monitoring błędów działa

**NO-GO — którykolwiek na tak zatrzymuje sprzedaż:**

- checkout istnieje tylko w UI · backend nie jest wdrożony · po płatności
  uprawnienie wymaga ręcznej zmiany w bazie · wynik opisany jako gwarancja
  przejścia ATS · użytkownik nie wie, co trafia do chmury lub AI · brak
  procedury zwrotu, reklamacji albo usunięcia danych · landing sprzedaje
  więcej, niż produkt potrafi wykonać

> **NO-GO nie jest porażką dnia — jest jego wynikiem.** Przy NO-GO: nazwij
> brakujący punkt, wyceń go w godzinach, przesuń beta o tyle dni. Nie zapraszaj
> testerów „w międzyczasie".

### Sobota 19.09 · Zaproszenia · 6 h

- [ ] Lista **15 osób** z segmentu: IT support, customer support, operations,
      junior/mid IT — aktywnie aplikujących.
- [ ] Wyślij zaproszenie (treść gotowa w audycie §9, dzień 2).
- [ ] Pierwszym 10: karnet za **29 zł** w zamian za 20 minut rozmowy zwrotnej.
- [ ] **Nie rozdawaj darmowych dostępów.** Darmowy tester nie potwierdza ceny —
      a potwierdzenie ceny jest jedynym celem tego pilotażu.
- [ ] Przygotuj kalendarz rozmów i zgodę na obserwację ekranu.

### Niedziela 20.09 · **BUFOR**

---

## 9. Tydzień 4–5 — płatna beta (21.09 – 04.10)

Tryb pracy zmienia się z „buduję" na „patrzę i notuję". Największe ryzyko tych
dwóch tygodni to **dopisywanie funkcji zamiast słuchania**.

**Rytm dnia (60–90 min):**
1. Przegląd zdarzeń z lejka i błędów z Sentry (15 min).
2. Rozmowy z testerami — 1–2 dziennie, po 20 minut (40 min).
3. Zapis **problemów, nie sugestii funkcji** (15 min).
4. Naprawy wyłącznie blokujące. Reszta → backlog Fazy 2.

**Pięć pytań po każdej sesji** (audyt §7):
1. Co chciałeś osiągnąć? 2. W którym miejscu prawie zrezygnowałeś?
3. Któremu wynikowi nie zaufałeś i dlaczego? 4. Za co konkretnie zapłaciłeś?
5. Czego nie potrzebowałeś?

**Dashboard tygodniowy** — wypełniany w piątek 26.09 i 03.10:

| Metryka | Cel pilotażowy | 26.09 | 03.10 |
|---|---:|---|---|
| Unikalni odwiedzający | informacyjnie | | |
| Start produktu / landing | >20% | | |
| Ukończony import / start | >70% | | |
| Ukończona analiza / import | >60% | | |
| Eksport / analiza | >40% | | |
| Checkout / analiza | >8% | | |
| Płatność / checkout | >50% | | |
| Zwroty | <10% | | |
| Zgłoszenia blokujące / 10 sesji | <2 | | |

**Niedziela 04.10 — M4, rozstrzygnięcie:**

| Wynik | Decyzja |
|---|---|
| ≥5 płatności, ≥60% kończy analizę, ≥40% eksportuje | Wchodzisz w Fazę 2 (jedna ścieżka) i szykujesz start publiczny |
| Płatności są, ale ludzie utykają | Faza 2 najpierw, sprzedaż wstrzymana do poprawki |
| <5 płatności | **Nie dodajesz funkcji.** Zmieniasz segment, obietnicę albo cenę — dokładnie w tej kolejności |

---

## 10. Rejestr ryzyk

| # | Ryzyko | Prawdopodobieństwo | Skutek | Plan awaryjny |
|---|---|---|---|---|
| **R1** | Konto Stripe nie jest aktywowane do płatności live (brak JDG, trwająca weryfikacja) | **średnie** | Blokuje M2 i całą betę — nic innego nie pomaga | Sprawdź **29.08**. Jeśli weryfikacja trwa: cały tydzień 2 robisz w Stripe Test, a live włączasz, gdy przyjdzie zgoda. Kolejność dni się nie zmienia |
| **R2** | Migracje Supabase nie były realnie zaaplikowane | **wysokie** (`NOTATKI.md` to sygnalizuje) | Trasy padają dopiero w chmurze, przy pierwszej płatności | Dzień 07.09 zaczyna się od `select` na `plans` i `activate_application_pass`, nie od kodu |
| **R3** | DNS/domena — przepięcie trwa dłużej niż wieczór | średnie | Przesuwa 09.09 | Przepnij rano, obniż TTL dzień wcześniej; Cloud Run działa pod własnym URL-em w międzyczasie |
| **R4** | Regulamin wymaga konsultacji prawnej z terminem | średnie | Przesuwa bramkę 18.09 | Umów konsultację w tygodniu 1, nie w trzecim |
| **R5** | Mniej niż 5 płatności w pilotażu | **wysokie** — to jest hipoteza do obalenia | Nie ma potwierdzenia ceny | To nie jest awaria, to wynik testu. Ścieżka w sekcji 9, tabela decyzji |
| **R6** | Koszty Gemini / Cloud Run rosną niekontrolowanie | niskie przy 15 osobach | Nieprzewidziany rachunek | `--max-instances 3` i `--min-instances 0` są już w skrypcie; ustaw budżet z alertem w GCP |
| **R7** | Zjedzenie buforów w tygodniu 1 | **wysokie** | Kaskada na M2 i M3 | Tnij z listy „wolno wyciąć" poniżej. Bramki i zakres prawny nie podlegają cięciu |
| **R8** | Wyciek klucza publikowalnego Stripe z eksportu Lovable (`NOTATKI.md`) | niskie | Klucz testowy poza kontrolą wersji | Przy przełączaniu na live użyj świeżych kluczy — rotacja jest i tak darmowa |

### Co wolno wyciąć pod presją czasu

Wolno: drugi scenariusz przykładowy · przepisanie hero landingu ·
ujednolicenie nazewnictwa · wykresy w Pipeline · mobilne dopieszczenie ·
wideo 45 s.

**Nie wolno:** żadnego punktu z bramki GO/NO-GO · żadnego z sześciu scenariuszy
płatności · regulaminu i polityki prywatności · usuwania danych ·
usunięcia niezweryfikowanych liczb.

---

## 11. Jak przeskalować ten kalendarz

| Twoja realna pojemność | Co zrobić | Bramka GO/NO-GO |
|---|---|---|
| **8 h dziennie** (pełny etat na projekcie) | Łącz po dwa dni w jeden, zachowując kolejność | ~05.09 |
| **3 h dziennie** (założenie bazowe) | Kalendarz bez zmian | **18.09** |
| **1,5 h dziennie** | Podwój każdy dzień; tygodnie 1–3 stają się sześcioma | ~09.10 |
| **Weekendy tylko** | Jeden dzień z kalendarza = jeden weekend | ~15.11 |

**Zasada nadrzędna:** przy poślizgu przesuwasz **datę**, nie **zakres bramki**.
Wdrożenie z pominiętym punktem GO nie jest wdrożeniem wcześniejszym — jest
wdrożeniem, które wróci jako zwrot, reklamacja albo utrata zaufania.

---

## 12. Rytm i dziennik

**Codziennie (15 min na start, 15 min na koniec):**
- start: przeczytaj „cel dnia" z tego pliku, otwórz jeden branch;
- koniec: `npm run lint && npm test`, commit, jedno zdanie do dziennika.

**Format dziennika** (dopisuj na końcu tego pliku albo w `NOTATKI.md`):

```
## 2026-09-02
Zrobione: katalog ceny → jeden wpis `karnet_30d`, migracja plans.
Nie zrobione: ekran cennika (przeniesione na 03.09).
Zaskoczenie: PricingView sklejał sku w widoku — checkout nie działał od tygodni.
Bufor: nienaruszony.
```

Trzy linijki dziennie po trzech tygodniach są jedynym wiarygodnym źródłem
odpowiedzi na pytanie „czemu to trwało tyle, ile trwało" — i najlepszym
materiałem do wyceny następnego etapu.

**Co piątek (30 min):** przegląd tygodnia — kamień milowy zagrożony czy nie,
bufor zjedzony w ilu procentach, co przenosisz.

---

## 13. Czego w tym kalendarzu nie ma — świadomie

Za audytem §11, do czasu 20 pierwszych płatności **nie robimy**: nowego
dashboardu · kolejnych „silników ATS" · punktów, rang i rabatów · kolejnych
wariantów cen · automatycznego aplikowania do ofert · marketplace szablonów ·
wielojęzyczności · aplikacji mobilnej · masowej reklamy.

Każda z tych rzeczy jest dobrym pomysłem **po** potwierdzeniu, że pięć obcych
osób płaci za rozwiązanie problemu. Przed — jest sposobem na uniknięcie
sprawdzenia tego.

---

*Dokument wykonawczy do audytu z 29.08.2026. Stan repozytorium zweryfikowany
na commicie `d8ba941`. Odwołania do plików i linii są dowodem — jeśli po zmianie
przestają się zgadzać, popraw je razem ze zmianą.*
