# AGENTS.md — wytyczne pracy nad CVelocity

Plik dla **każdego** agenta pracującego nad tym repozytorium: Jules (Google),
Claude Code i dowolnego innego. Opisuje realia projektu, reguły wyprowadzone
z jego historii oraz to, co wolno delegować, a czego nie.

Każda reguła powstała po tym, jak jej brak kosztował realny błąd, i wskazuje
miejsce w kodzie, gdzie ten błąd jest opisany. Odwołanie jest istotne — pozwala
sprawdzić, że reguła nie została wymyślona.

Wizję produktu opisują `docs/SYSTEM_ARCHITECTURE_GUIDANCE.md` i `README.md`, model
zagrożeń `SECURITY.md`. Tutaj jest wyłącznie to, jak pisać kod, żeby pasował.

Bieżące obserwacje właściciela repo — rzeczy zauważone, ale jeszcze nie
naprawione — są w [`NOTATKI.md`](./docs/NOTATKI.md). Przejrzyj je przed zmianą
w obszarze, którego dotyczą; to kanał na spostrzeżenia, nie na reguły.

Incydenty, z których wyprowadzono reguły poniżej, są opisane w archiwum
[`docs/historia/`](./docs/historia/). Dokumenty pochodzą sprzed przebudowy
projektu i nie opisują stanu bieżącego — służą wyłącznie do sprawdzenia,
skąd wzięła się dana reguła.

Ten plik jest kontraktem dla obu agentów: Claude Code trafia tu przez
`CLAUDE.md`, Antigravity czyta go natywnie. Antigravity dostaje dodatkowo reguły
per-obszar w [`.agents/rules/`](./.agents/rules/) — one nie powtarzają treści
stąd, tylko wskazują właściwą sekcję i dokładają pułapkę specyficzną dla danego
katalogu. **Limit Antigravity to 12 000 znaków na plik reguł**, więc ten plik
i katalog `.agents/` pilnuje `scripts/sprawdz-limity-regul.mjs` w CI.

## Dwa pakiety, dwie konfiguracje

| | katalog główny | `labs/semantic-work-graph/` |
| --- | --- | --- |
| co to jest | aplikacja (React + Express) | silnik semantyczny i graf wiedzy |
| baza | Supabase/Postgres (`BACKEND_MODE=cloud`) albo localStorage (`local`) | SQLite przez `better-sqlite3` |
| testy | `npm test` (Vitest, Node) | `npm test` (własny `vitest.config.ts`) |

**Pakiet `labs/semantic-work-graph` jest wykluczony z konfiguracji katalogu głównego**
— w `tsconfig.json`, `eslint.config.js` i `vite.config.ts`. Ma własny `tsconfig`,
własne zależności i własnego Vitest. Uruchamiając cokolwiek dla tego pakietu,
rób to z jego katalogu.

**Workflow CI (`.github/workflows/ci.yml`) obejmuje wyłącznie katalog główny.**
Testy `labs/semantic-work-graph` nie uruchamiają się na GitHubie. Jeśli zmieniasz ten
pakiet, uruchom jego testy lokalnie — nikt inny tego za ciebie nie zrobi.

## Komendy

```bash
# katalog główny
npm run dev            # serwer deweloperski (tsx server.ts)
npm run lint           # eslint . && tsc --noEmit  — to jest bramka CI
npm test               # vitest run
npm run build          # klient (vite) + serwer (esbuild)

# labs/semantic-work-graph/
npm test               # vitest run
npm run seed:import    # graf profesji z pliku seed
npm run seed:lexicon   # PoliMorf + ESCO (pełny przebieg: kilkadziesiąt minut)
npm run seed:lexicon -- --esco-no-alt   # same nazwy bazowe, ok. minuty
npm run cli -- search "piecyk gazowy"
```

`npm run lint` to jednocześnie sprawdzenie typów. Uruchom je przed każdym
commitem — CI robi dokładnie to samo.

## Konwencje, które łatwo złamać nieświadomie

**Testy biegną w Node, nie w przeglądarce.** Brak `jsdom`, brak
`@testing-library`. Interfejsy przeglądarki podstawia się ręcznymi atrapami —
wzorzec w `src/lib/__tests__/localProfile.test.ts:14`. Logikę wymagającą DOM-u
wydziel do zwykłego modułu i przetestuj tam; w komponencie zostaw cienkie
spięcie (przykład: `src/lib/deferredWriter.ts` i `src/hooks/useDeferredPersist.ts`).
Dokładanie `jsdom` to zmiana konfiguracji testów całego projektu — nie rób tego
mimochodem.

**Komentarze wyjaśniają „dlaczego", nie „co".** Ten kod jest gęsto opatrzony
komentarzami tłumaczącymi, dlaczego coś wygląda tak, a nie inaczej — zwykle
dlatego, że poprzednie podejście zawiodło. Zachowuj je i pisz w tym stylu.
Komentarz powtarzający treść linijki jest szumem; komentarz ratujący następną
osobę przed powtórzeniem błędu jest najcenniejszą rzeczą w pliku.

**Język: polski.** Komentarze, komunikaty błędów, opisy testów i treść PR-ów.

**`src/lib/storage.ts` jest jedynym rejestrem tego, co aplikacja zapisuje
w przeglądarce.** Nowy klucz dopisujesz tam, nie obok. Usuwanie danych iteruje
po rejestrze, więc klucz spoza niego przetrwa „usuń moje dane" — to się już raz
zdarzyło ze stanem subskrypcji (`storage.ts:4`).

**Serwer odpowiada spójnym kształtem** `{ success, error, requestId }`
ustalonym w `src/server/middleware/errorHandler.ts`. Klient rozmawia z API
wyłącznie przez `src/lib/apiClient.ts` — nie wpisuj `fetch` do komponentu.

**`user_id` bierze się z tokenu, nigdy z ciała żądania.** Klient `service_role`
omija RLS, więc pole z żądania pozwoliłoby nadpisać cudze dane
(`src/server/routes/vault.routes.ts:36`).

## Dziesięć reguł

Każda ma za sobą konkretny błąd w historii tego repozytorium.

**1. Zero wymyślonych danych.** Nie wstawiaj przykładowych rekordów do stanu
startowego, wartości domyślnych do sparsowanych struktur ani stałych udających
pomiar. Brak danych to pusty stan albo `null`. Czego nie da się zmierzyć, ten
endpoint zwraca `501`, nie liczbę.
> Tracker wstawiał cztery wymyślone aplikacje z nazwami firm i notatkami
> z rozmów, których nikt nie odbył (`ApplicationTracker.tsx:29`). Trasa statystyk
> zwracała zmyślone stałe jako zużycie tokenów (`stats.routes.ts:10`). Osobny
> commit nazywa się „fałszywe 100% ATS".

**2. Nie buduj interfejsu dla zabezpieczenia, którego nie ma.** Ekran, który nie
weryfikuje, ma o tym napisać wprost. Kontrola dostępu po stronie klienta jest
podpowiedzią dla interfejsu, nigdy egzekucją.
> Ekran logowania przepuszczał dowolne hasło, dowolne sześć znaków „potwierdzało"
> 2FA, a przycisk Google wstawiał zaszytego `google-user-1` (`AuthModal.tsx:13`).
> Uprawnienia egzekwowane wyłącznie w przeglądarce nazywano kontrolą dostępu
> (`useEntitlements.ts:18`).

**3. Jedno źródło prawdy na fakt.** Zanim dopiszesz warunek, wyrażenie regularne
albo klucz — sprawdź `grep`em, czy ten sam fakt nie jest już zakodowany gdzie
indziej. Jeśli jest, wydziel go zamiast kopiować.
> Klucze schowka leżały w ośmiu plikach w trzech konwencjach (`storage.ts:4`).
> Klasyfikacja narzędzia była powielona dwoma **różnymi** wyrażeniami
> regularnymi i tworzyła relacje do nieistniejących węzłów grafu
> (`labs/semantic-work-graph/src/seed/SeedImporter.ts`).

**4. Poprawiaj klasę, nie wystąpienie.** Po znalezieniu błędu przeszukaj repo pod
kątem tego samego wzorca i wymień wszystkie trafienia w jednej zmianie.
> Commit `551d064` nazywa się „audit round 2 — **remaining** py-0.2 in Tabs,
> ApplicationTracker, AchievementEditor, InterviewCheatSheetView". Runda pierwsza
> poprawiła część wystąpień, nie problem.

**5. Nie dodawaj kodu bez konsumenta.** Endpoint, opcja czy eksport bez wywołania
nie wchodzi do repozytorium — albo podłącz go w tej samej zmianie, albo go nie
pisz.
> `PUT /api/vault`, `GET /api/vault`, `/api/applications` i `/api/stats` mają
> zero wywołań z klienta. Importer leksykonu przyjmował opcje, których CLI nie
> wystawiało, a komunikat odsyłał do nieistniejącego przełącznika.

**6. Zmierz, zanim zoptymalizujesz — i zmierz naprawdę.** Podaj liczbę przed
i po. Pomiar ma przepuszczać dane przez prawdziwy mechanizm, nie przez wzór
szacujący wynik. Optymalizacja bez pomiaru trafia w to, co wygląda na wolne.
> Wzorzec: `src/lib/__tests__/vaultPersistence.bench.test.ts`. Bez progów
> czasowych — testy wydajności z twardym limitem sypią się na współdzielonym CI
> z przyczyn niezwiązanych ze zmianą i uczą zespół ignorowania czerwonego builda.

**7. Sprawdź założenie w kodzie, zanim je zrealizujesz.** Jeśli zadanie mówi
„autosave co kilkanaście sekund obciąża bazę" — prześledź ścieżkę zapisu, zanim
zaczniesz optymalizować bazę.
> Zadanie P2 opisywało narzut zapisu do Postgresa. Vault nigdy do Postgresa nie
> trafiał; pełna serializacja szła do localStorage przy każdym wpisanym znaku.
> Zrealizowanie zadania dosłownie zoptymalizowałoby martwą ścieżkę.

**8. Domena to prace fizyczne, nie tylko IT.** Reguły dopasowania testuj na
monterze, spawaczu i magazynierze, zanim uznasz je za gotowe.
> Audyt kryteriów zerojedynkowych sprawdzał dokładnie dwa warunki — prawo jazdy B
> i angielski C1 — podczas gdy monter odpada na SEP-ie, UDT i F-Gazie
> (`knockouts.ts:8`).

**9. Odłożenie zapisu wymaga gwarancji dosłania.** Każde opóźnienie utrwalania
tworzy okno, w którym dane są tylko w pamięci. Domknij je przy ukryciu karty
(`visibilitychange`), zamknięciu strony (`pagehide` — Safari i iOS nie wywołują
`beforeunload`) i odmontowaniu komponentu.
> Wzorzec i testy: `src/lib/deferredWriter.ts`.

**10. Sprawdź, jak daleko odjechał `main`, zanim zaczniesz.** Gałąź kilkadziesiąt
commitów w tyle nie da się już zmergować — da się ją tylko przepisać. Przed pracą
uruchom `scripts/sprawdz-swiezosc.sh`; powyżej progu rebase'uj albo zacznij od
`origin/main`. Skończoną pracę scalaj od razu, a nie „jak będzie gotowa".
> Silnik Ściągi na Rozmowę przeleżał na gałęzi sprzed przebudowy katalogów, aż
> `main` odjechał o 94 commity. Merge dokładałby drugi komplet plików obok
> istniejących, więc PR #87 musiał portować logikę ręcznie. W tym samym czasie
> `main` pokazywał użytkownikom atrapę tej funkcji z fabrykowanymi danymi.

## Co wolno delegować agentowi autonomicznemu

Zielona i czerwona lista zadań, zasady zadań cyklicznych i reguły antykolizyjne:
[`docs/agents/delegowanie.md`](./docs/agents/delegowanie.md). Gotowe briefy:
[`docs/zadania-dla-agenta.md`](./docs/zadania-dla-agenta.md).

## Zanim zgłosisz zmianę

- [ ] `npm run lint` bez błędów (to bramka CI)
- [ ] `npm test` na zielono; jeśli tknąłeś `labs/semantic-work-graph`, jego testy też
- [ ] żadnych wymyślonych danych, żadnych nowych ścieżek bez konsumenta
- [ ] przy zmianie wydajnościowej — liczba przed i po w opisie PR-a
- [ ] opis PR-a mówi, **dlaczego** tak, nie tylko **co** się zmieniło; jeśli
      odszedłeś od treści zadania, uzasadnij to dowodem z kodu
