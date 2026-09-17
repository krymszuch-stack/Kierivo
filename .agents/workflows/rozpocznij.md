---
description: Kontrola przed rozpoczęciem pracy — świeżość gałęzi, kolizje z innymi gałęziami, otwarte uwagi.
---

# /rozpocznij

Uruchom przed napisaniem pierwszej linijki kodu w nowym zadaniu.

## Krok 1 — kontrola

```bash
scripts/sprawdz-swiezosc.sh
```

Jeśli wiesz już, czego dotknie zadanie, podaj obszary — wtedy skrypt wypisze
gałęzie ruszające te same ścieżki:

```bash
scripts/sprawdz-swiezosc.sh src/server src/lib
```

Skrypt jest jedyną implementacją tej kontroli; skill `start` po stronie Claude
Code woła dokładnie ten sam plik. Nie licz commitów ręcznie.

## Krok 2 — decyzja

- **kod 0** → pracuj.
- **kod 1** → gałąź jest za daleko za `main`. Albo `git merge origin/main`
  (gdy gałąź ma własną pracę), albo `git checkout -B <nazwa> origin/main`
  (gdy zaczynasz od zera). Nie przepisuj historii cudzej gałęzi.
- **wypisane gałęzie w tym samym obszarze** → sprawdź, czy nie dublujesz cudzej
  pracy. Reguła: jeden plik = jeden otwarty PR.

## Krok 3 — kontekst

Przeczytaj **@../../AGENTS.md** (kontrakt, dziesięć reguł) oraz sekcję „🆕 Nowe"
w **@../../docs/NOTATKI.md**. Reguły dopasowane do katalogu, w którym pracujesz,
włączą się same — patrz `.agents/rules/`.

## Krok 4 — bramka na wyjściu

```bash
npm run lint && npm test && npm run build
```

`lint` obejmuje `tsc --noEmit`. Zmiany w `semantic-work-graph/` testuj osobno,
z katalogu tego pakietu — CI go nie obejmuje.
