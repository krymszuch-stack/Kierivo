---
name: kierivo-targeted-audit
description: "Użyj przy audycie konkretnego issue Kierivo (np. ADR-152/153/154/118): selektywny odczyt kodu, test FAIL→PASS, dowody SHA i przekazanie do Linear. Nie używaj do prostych zmian tekstowych, kosmetyki ani ogólnego brainstormingu."
---

# Kierivo — audyt pojedynczego issue bez zalewania kontekstu

Obowiązują reguły repo `AGENTS.md` i kryteria bieżącego issue w Linear. Ten skill jest procedurą, nie alternatywnym kontraktem.

## 1. Sprawdź punkt startu (minimalny preflight)
- `git status --short`, `git rev-parse HEAD`, nazwa gałęzi, numer issue, istniejący PR, dotknięte moduły.
- Zajrzyj do `docs/agents/linear.md` tylko gdy aktualizujesz Linear. Dla release/deploy otwórz ADR-152 i `AUDIT_CLOSURE.md`; inne zadania nie muszą czytać pełnego release dossier.
- Nazwa screenshotu lub starego issue jest wskazówką, nie dowodem aktualnego błędu.

## 2. Odczyt selektywny
1. `git grep -n -E 'symbol1|symbol2' -- src/lib src/features scripts` — ogranicz ścieżki do obszaru sprawy.
2. Otwórz maksymalnie kilka entrypointów, istotną funkcję i odpowiadający test, później zależności wynikające z importów; nie używaj pełnego `git grep` bez ścieżek, jeśli wystarczą konkretne katalogi.
3. Pokazuj jedynie zakresy `plik:linia`, nie całe pliki, łączone stdout ani pełny diff. Jeśli zależności są większe, czytaj partiami.
4. Źródła pomocnicze i mapę plików znajdziesz w dokumentacji issue/runbook Linear; sprawdź ich aktualność na HEAD.

## 3. Reprodukcja i minimalna poprawka
- Syntetyczne wejście, EXPECTED kontra ACTUAL, severity **po reprodukcji**.
- Błąd: regresja FAIL przed zmianą, minimalny fix, PASS po zmianie; następnie sprawdzenia związane z poprawką.
- Brak reprodukcji: `NOT REPRODUCED` + lista sprawdzonych ścieżek. Nie wymyślaj poprawki.
- Nie otwieraj nowego issue, jeśli istnieje właściwe ADR. Nie zmieniaj CI, infrastruktury, danych produkcyjnych ani migracji poza zakresem.

## 4. Zbieranie dowodów bez nadmiaru
- W trakcie: odpowiedni test jednostkowy lub E2E i krótki wynik (liczba pass/fail/skipped).
- Przed PR: `npm run lint`, `npm test`, `npm run build` zgodnie z `AGENTS.md`. Testy specjalistyczne wyłącznie gdy dotyczy.
- Przy niezależnych odczytach narzędziowych: grupuj wywołania, gdzie runtime umożliwia; nigdy nie wykonuj równoległych zapisów w te same pliki.
- FAIL, SKIPPED, UNKNOWN są różne. Nie zastępuj ich zielonym PASS.

## 5. Koniec sesji — przekazanie do następnego Codexa
W Linear dopisz zwięzłą notatkę:
```text
Issue / branch / base SHA / HEAD SHA / PR:
Root cause / reproduced?:
Changed files:
Testy: komenda -> PASS/FAIL/SKIPPED/UNKNOWN
Pozostałe ograniczenia/ryzyka:
NEXT: dokładnie jeden kolejny ruch
```
Nie wklejaj całych logów ani danych wrażliwych. Po spełnieniu DoD zamknij issue; po znalezieniu blokera S0/S1 podepnij ADR-152, bez samowolnego merge/deploy.
