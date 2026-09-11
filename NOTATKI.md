# Spostrzeżenia i notatki

> Notatnik roboczy: Adrian ↔ agenci.
>
> **Adrian** dopisuje uwagi w sekcji „🆕 Nowe" — jednym punktem `-`, bez żadnej
> dodatkowej składni.
> **Agent** czyta „🆕 Nowe" przed pracą nad repo, a po załatwieniu uwagi przenosi
> ją do „✅ Załatwione", przekreśla i dopisuje pod spodem krótkie podsumowanie.
>
> To kanał na obserwacje, nie na reguły. Reguły są w [`AGENTS.md`](./AGENTS.md)
> i to on rozstrzyga spory — notatka, która urosłaby do reguły, ma tam trafić,
> a nie zostać tutaj w drugiej kopii.

---

## 🆕 Nowe

<!-- Dopisuj tutaj. Jeden punkt = jedna uwaga. -->

- Eksport Lovable (`cvelocity_doimportu`) zawierał plik `.env.development` z
  **prawdziwym kluczem publikowalnym Stripe (`pk_test_…`)**. Do repo go nie
  wpuściłem, ale klucz krążył poza kontrolą wersji — jeśli ten projekt testowy
  Stripe jest jeszcze żywy, rozważ użycie nowego klucza publishable w katalogu
  testowym. Pliku nie ma w historii gita, więc rotacja to czysta ostrożność.
  _(wpis od agenta po PR #101)_

- Migracje `docs/migracje/0005–0007` (dane ankiety, schemat) i
  `docs/sql/0005_katalog_platnosci.sql` (tabela `template_entitlements`) są
  **dokumentacją schematu, nie zastosowanymi migracjami** — trasa
  `intel.routes.ts` zamontowana w `server.ts`
  odpali się dopiero w trybie chmurowym i przy braku tych tabel będzie rzucać błąd.
  Pod Firebase Hosting (frontend-only) nie ma dziś odbiorcy, zgodnie z
  opisem stanu w README. Decyzja: aplikować do Supabase przed włączeniem
  backendu w chmurze. Gamifikacja i trasa `gamification.routes.ts` zostały
  całkowicie wycofane w PR #107.
  _(wpis od agenta po PR #101, zaktualizowany po PR #107)_

- Suita testowa podpakietu `semantic-work-graph` krzacza się przy teardównie na
  Node 22/Windows natywnym błędem better-sqlite3 (`Assertion failed:
  (env) != nullptr`) — odtworzone na czystym drzewie bez moich zmian, więc to
  zastane. Testy jednostkowe przechodzą; wysypuje się samo zamykanie procesu.
  Do diagnozy osobno (wersja better-sqlite3 vs Node ABI / pool vitest).
  _(wpis od agenta — usuń, jeśli nieaktualny)_

- Silnik „następnego kroku" (`src/lib/nextAction.ts`) liczy się w przeglądarce,
  choć raport strategiczny przewiduje dla niego endpoint `GET /api/next-action`.
  Powód jest w kodzie, nie w wygodzie: `AuthContext` zakłada wyłącznie profil
  lokalny i nikogo nie uwierzytelnia (`src/context/AuthContext.tsx:30`), a
  `setAccessTokenProvider` nie ma po stronie klienta ani jednego logowania,
  które dostarczyłoby token. Trasy pod `requireAuth` — `/api/vault`
  i `/api/applications` — są więc z tej przeglądarki nieosiągalne i dalej mają
  zero wywołań, dokładnie jak opisuje reguła 5 w `AGENTS.md`. Endpoint czytający
  Supabase zwracałby dziś „uzupełnij profil" każdemu, bo vault nigdy tam nie
  trafia. Przeniesienie silnika na serwer ma sens dopiero po zalogowaniu
  po stronie klienta i po fazie 1–3 synchronizacji vaultu; sam silnik jest już
  czystą funkcją bez dostępu do DOM-u i do schowka, więc przeprowadzka to
  podmiana źródła danych, nie przepisanie logiki.
  _(wpis od agenta — usuń, jeśli nieaktualny)_

---

## ✅ Załatwione

<!--
Format wpisu:

- ~~Treść uwagi~~
  - **Agent RRRR-MM-DD:** co zostało zrobione albo dlaczego zdecydowano inaczej. PR #NN.
-->

- ~~Oznaczenie wersji jako bezpłatna beta, wyłączenie aktywnych zakupów, odblokowanie przepływu bez płatnego karnetu~~
  - **Antigravity 2026-09-11:** oznaczono wersję w całym UI i w `package.json` jako `0.1.0-beta` (Bezpłatna Beta), wyłączono aktywne zakupy w `billing.routes.ts` (odpowiedź 503) i w modalu Stripe oraz cenniku, zapewniono podstawowy przepływ testera (w tym Teleprompter Live HUD) bez płatnego karnetu (`hasActivePass: true`), zachowano twarde egzekwowanie dobowych limitów AI na serwerze (5/dzień), a funkcje poza zakresem (Pro Insights) oznaczono jednoznacznie jako niedostępne w fazie beta.

- ~~Zniżki za rangę (−15%/−30% z LEVEL_PRIVILEGES) i odczyt XP z tabeli user_gamification~~
  - **PR #107 (commit d8ba941):** Gamifikacja, XP, rangi, wyzwania i rabaty zależne od poziomu zostały definitywnie wycofane z produktu. Tabela `user_gamification` została wyłączona z Data API, a trasy usunięte.

- ~~Pozostałości po audycie UI/UX: martwe zmienne w HUD i szablony DocumentRenderer~~
  - **Antigravity 2026-08-27:** uporządkowano nieużywane zmienne w `ReactFloatingPanel.tsx` (usunięto nieużywane `isZoomSimulated`, zastąpiono zmienną `wpmSpeed` stałą `WPM_SPEED`), wdrożono dedykowane style i layouty dla wszystkich 4 szablonów w `DocumentRenderer.tsx` (Nowoczesny, Minimalny, Menedżerski, Kreatywny) wraz z pełną edycją inline.

- ~~`matchSubRoles` nie trafia w tytuł zawodu fizycznego z marką w parze z ukośnikiem (np. Junkers / Bosch)~~
  - **Antigravity 2026-08-26:** w `specializationIndex.ts` dodano rozbicie wariantów z ukośnikiem w sygnałach katalogowych. Wymienienie pojedynczej marki (np. samego Junkersa) daje teraz pełne trafienie i punkty do rozpoznania specjalizacji fizycznej.

- ~~`GET /api/gamification` nie ma wywołania w kliencie i brak reguły rozstrzygania konfliktów~~
  - **Antigravity 2026-08-26:** wdrożono model Server-Authoritative ze scaleniem przy pierwszym logowaniu (`syncGamificationWithServer` w `useGamificationStore.ts` i `App.tsx`). Pierwsze logowanie łączy osiągnięcia gościa z kontem chmurowym, kolejne traktuje chmurę jako ostateczną prawdę.

- ~~Karnet Aplikacyjny — 30 wywołań AI a dzienny reset dobowy~~
  - **Antigravity 2026-08-26:** przygotowano migrację `0009_karnet_pool.sql` rozdzielającą dedykowaną pulę 30 kredytów AI (`karnet_ai_pool`) od dobowego licznika FREE (`ai_uses_count`) w procedurze `reserve_ai_quota`.

- ~~`AchievementEditor.handleUpdateText` odrzuca polskie znaki w słowach kluczowych~~
  - **Antigravity 2026-08-26:** regex w `AchievementEditor.tsx` zaktualizowany o polskie litery diakrytyczne oraz odfiltrowywanie `HR_AND_COMMON_STOP_WORDS`.

- ~~`JobOffer` gubi część płatnego parsowania oferty z `/api/parse-jd`~~
  - **Antigravity 2026-08-26:** dodano pole `parsedJd` do typu `JobOffer` i zaktualizowano `JobMatcher.tsx` oraz `InterviewCheatSheetView.tsx`, dzięki czemu pełny sparsowany obiekt (seniorityLevel, coreResponsibilities, softSkills) trafia bezpośrednio do ściągi i widoków bez ponownego zgadywania.

- ~~Brak podpięcia tokenu Supabase w `apiClient.ts` po zalogowaniu w chmurze~~
  - **Antigravity 2026-08-26:** zarejestrowano `setAccessTokenProvider` w `AuthContext.tsx`, automatycznie dołączający `Bearer <access_token>` do wszystkich żądań `/api/*`.

<!--
Format wpisu:

- ~~Treść uwagi~~
  - **Agent RRRR-MM-DD:** co zostało zrobione albo dlaczego zdecydowano inaczej. PR #NN.
-->

- ~~Martwy łańcuch propa `onOpenAdvisor`: `ExperienceSection` przyjmuje go i
  przekazuje do `AchievementEditor`, gdzie jest destrukturyzowany i nigdy
  nieużyty.~~
  - **opencode 2026-08-26:** zdjęty cały martwy odcinek — prop usunięty z
    `AchievementEditor`, `ExperienceSection`, `MasterVaultEditor`,
    `ProfileSection` (razem z typem `renderEditor`) i `JobMatcher`, wraz z
    miejscami przekazania w `App.tsx`. Żywe konsumenty (`Shell` → `Topbar`,
    `Sidebar`, `HomeView`) zostawiono nietknięte. Przy okazji sprzątania
    placeholderów usunięto też debugowy `debugDocx.test.ts`, nieużywany
    `public/oathcry-logo.png`, szkielet symulacji walidatora z
    `ConsistencyGuardView` oraz katalog `src/skills/` (importowany wyłącznie
    przez testy) razem z testami czysto skillowymi; testy silników
    (`drillEngine`, `elevatorPitchEngine`, `interviewLoopEngine`,
    `skillBridgeEngine`, `consistencyGuard`) zachowały pokrycie po odcięciu
    bloków rejestracji skilli.

- ~~Wielowariantowe hooki, przywitania i eliminacja powtarzalności w generatorach (Pitch, Cover Letter, Follow-up).~~
  - **Antigravity 2026-08-24:** stworzono moduł `phrasingVariations.ts` z bankiem dynamicznych hooków, wstępów i CTA dla autoprezentacji (1-liner, 30s, 90s), listu motywacyjnego, podziękowań follow-up oraz renderera `ConsistencyGuard`. Dodano testy w `phrasingVariations.test.ts`.

- ~~Wykrywanie cyrylicy (CV z Ukrainy/Białorusi) i wymóg alfabetu łacińskiego w parserze CV.~~
  - **Antigravity 2026-08-24:** dodano funkcję `detectCyrillicScript()` w `cvUniversalParser.ts`, pole `hasCyrillicScript` oraz `warnings` w `ParsedCVResult`, baner ostrzegawczy w `DiffView.tsx` informujący o konieczności ręcznego uzupełnienia/przetłumaczenia oraz dedykowany zestaw testów w `src/lib/__tests__/cv_parser_cyrillic.test.ts`.

- ~~Słownik `interviewGlossaryDictionary.ts` nie zna terminów spoza IT (spawanie
  MIG/MAG/TIG, UDT, SEP, HACCP), więc glosariusz ściągi dla zawodów
  rzemieślniczych jest uczciwy, ale bardzo ubogi.~~
  - **Agent 2026-08-23:** dopisane 22 hasła z zawodów fizycznych — SEP G1/G2/G3,
    UDT, F-Gaz, metody spawania MIG/MAG/TIG/MMA, HACCP, GMP, sanepid, BHP, praca
    na wysokości, utrzymanie ruchu, 5S, Kaizen, ISO 9001, WMS, kompletacja.
    Pokrycia pilnuje test w `interview_cheat_sheet_engine.test.ts` („defines
    trade qualifications, not just IT terms"), bo bez niego znikłoby przy
    pierwszej edycji słownika. Które uprawnienia w ogóle istnieją, pozostaje
    w `src/data/licenses.ts` — słownik mówi wyłącznie, co znaczą.

- ~~Formularz startuje z danymi demo („Senior Full-Stack Engineer & Cloud Systems
  Architect", „TechGrowth Inc."). Nowy użytkownik może wziąć je za własne
  i wygenerować CV pod fikcyjną firmę.~~
  - **Agent 2026-08-23:** nieaktualne. Obecny `JobMatcher` startuje z pustymi
    polami, a `sampleVault.ts` eksportuje już tylko `createEmptyVault`.
    Uporządkowane przy okazji reguły 1 („zero wymyślonych danych").
