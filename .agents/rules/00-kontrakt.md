---
trigger: always_on
description: Kontrakt pracy nad CVelocity — obowiązuje w każdym zadaniu.
---

# Kontrakt

Reguły tego repozytorium są w **@../../AGENTS.md**. Ten plik ich nie powtarza —
dwie kopie rozjechałyby się po pierwszej zmianie, co jest dokładnie tym błędem,
przed którym ostrzega reguła 3.

Przed pracą przeczytaj **@../../docs/NOTATKI.md** — sekcja „🆕 Nowe" zawiera bieżące
obserwacje właściciela repo, w tym rzeczy zauważone, ale jeszcze nienaprawione.

## Cztery rzeczy, o które łatwo się potknąć w pierwszej godzinie

1. **Język polski.** Komentarze, komunikaty błędów, opisy testów i treść PR-ów.
2. **Zero wymyślonych danych.** Brak danych to pusty stan albo `null` — nigdy
   przykładowy rekord ani stała udająca pomiar. To reguła 1 i najczęściej łamana.
3. **Bramka przed zgłoszeniem zmiany:** `npm run lint` → `npm test` →
   `npm run build`. `lint` obejmuje też `tsc --noEmit`.
4. **Sprawdź świeżość gałęzi, zanim zaczniesz:** `scripts/sprawdz-swiezosc.sh`
   albo workflow `/rozpocznij`. Gałąź kilkadziesiąt commitów w tyle da się już
   tylko przepisać, nie zmergować — reguła 10.

## Podział na obszary

Reguły dopasowane do katalogu włączają się same przy otwarciu pliku:
`10-frontend`, `20-backend`, `30-dane`, `40-semantic-work-graph`.
