# Stan konsolidacji repozytorium — 12 września 2026

## Jedna gałąź kandydująca

Gałąź `codex/public-prebeta-release` jest lokalnym kandydatem do jednej
spójnej wersji. Powstała z aktualnego `origin/main` (`6c1bdb8`) i zawiera:

1. naprawę izolacji historii Pipeline między profilami (`54bb38b`),
2. pełny stos silników audytu (`bcd499c`): D08 → D09 → D20 → D10 → D11 →
   kontrakt semantyczny ATS.

Scalenie stosu było automatyczne, bez konfliktów. Przed zapisem przeszło:

- `npm run lint`: 0 błędów, 180 zastanych ostrzeżeń;
- `npm test`: 116 plików, 1072 testy zielone;
- `npm run build`: klient i serwer zbudowane poprawnie.

Migracja `supabase/migrations/20260911115000_audit_adaptive_learning.sql`
jest wyłącznie w kodzie kandydata. Nie została zastosowana na zdalnej bazie.

## Zabezpieczenie przed konsolidacją

Przed scaleniem powstał lokalny backup:

`C:\Users\Adrian\Desktop\Projekty\cvelocity-backups\konsolidacja-2026-09-12_153456`

Zawiera kompletny bundle referencji Git, patch zmian z głównego worktree'a,
kopie plików nieśledzonych oraz plik SHA-256. Bundle przeszedł weryfikację
Git, a 19 z 19 plików nieśledzonych zostało skopiowanych do backupu.

## Co jest zachowane osobno

Poniższe źródła nadal istnieją. Nie zostały usunięte ani nadpisane przez
konsolidację, ponieważ ich zakres wymaga osobnego przeglądu po aktualizacji do
tej samej bazy kodu.

| Źródło | Zakres | Decyzja |
| --- | --- | --- |
| `codex/beta-przygotowanie` / PR #124 | wcześniejszy pakiet Public Pre-Beta | zachować; jest 125 commitów za aktualnym `main`, a zdalny PR ma konflikt |
| `feat/doradca-ollama-asysta` | lokalna asysta Ollamy | zachować; osobna ocena funkcji i integracji |
| `feat/ollama-provider` / PR #120 | provider Ollamy | zachować; zdalny PR ma konflikt |
| `feat/form-ux-autocomplete-datepickers` / PR #121 | UX Vaultu i formularzy | zachować; zdalny PR ma konflikt |
| `feat/bledy-klienta` | poprawki błędów klienta | zachować; utraciła gałąź śledzoną na zdalnym repo, więc jest szczególnie ważna do ręcznego portu |
| główny worktree `cvelocity` | niezacommitowane lokalne zmiany i dokumentacja | pozostawić nietknięty; ma osobny patch i kopię w backupie |

## Co można zamknąć dopiero po publikacji kandydata

PR-y #115–#119 oraz #122 są technicznie jednym zależnym stosem, którego wynik
jest już w `bcd499c`. Nie zamykamy ich teraz: najpierw trzeba wypchnąć
sprawdzony kandydat i utworzyć jeden PR do `main`. Dopiero po jego scaleniu
stare PR-y można zamknąć z odnośnikiem do zastępującego PR-a.

Otwarte Issues wymagają osobnego przeglądu dowodów w kodzie. Nie zostały
automatycznie zamknięte, aby nie uznać zadania za zrobione wyłącznie po tytule.

## Następna bezpieczna kolejność

1. Ręcznie sprawdzić kluczowe przepływy silników w działającej aplikacji.
2. Wypchnąć `codex/public-prebeta-release` i otworzyć jeden PR do `main`.
3. Po przeglądzie i scaleniu portować zachowane gałęzie pojedynczo, z testami
   po każdej funkcji.
4. Dopiero na końcu uporządkować stare PR-y, gałęzie i Issues na GitHubie.
5. Wdrożenie chmurowe wykonać osobno po konfiguracji backendu, migracji oraz
   kontroli Supabase i Google Cloud.
