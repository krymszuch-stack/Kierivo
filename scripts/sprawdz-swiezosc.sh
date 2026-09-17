#!/usr/bin/env bash
#
# Sprawdza, czy da się jeszcze zmergować to, nad czym zaczynasz pracować.
#
# Powód istnienia tego skryptu jest konkretny: silnik Ściągi na Rozmowę
# przeleżał na gałęzi sprzed przebudowy katalogów, aż `main` odjechał o 94
# commity. Merge dokładałby wtedy drugi komplet plików obok istniejących, więc
# PR #87 musiał portować logikę ręcznie — a w tym czasie użytkownicy oglądali
# atrapę tej funkcji z fabrykowanymi danymi.
#
# Skrypt jest jedyną implementacją tej kontroli. Skill `start` (Claude Code)
# i workflow `/rozpocznij` (Antigravity) tylko go wołają — dwie kopie logiki
# rozjechałyby się po pierwszej zmianie progu (reguła 3).
#
# Użycie:
#   scripts/sprawdz-swiezosc.sh                 # sama świeżość gałęzi
#   scripts/sprawdz-swiezosc.sh src/server      # dodatkowo: kto rusza ten obszar
#
# Kod wyjścia: 0 — można pracować, 1 — gałąź wymaga odświeżenia.

set -uo pipefail

PROG_OSTRZEZENIA=${PROG_OSTRZEZENIA:-30}
GALAZ_BAZOWA=${GALAZ_BAZOWA:-main}
obszary=("$@")

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "To nie jest repozytorium git." >&2
  exit 2
fi

echo "Pobieram stan zdalny…"
if ! git fetch origin --prune --quiet 2>/dev/null; then
  echo "⚠️  Nie udało się pobrać z origin. Wynik poniżej może być nieaktualny." >&2
fi

biezaca=$(git rev-parse --abbrev-ref HEAD)
baza="origin/${GALAZ_BAZOWA}"

if ! git rev-parse --verify --quiet "$baza" >/dev/null; then
  echo "Brak gałęzi $baza — ustaw GALAZ_BAZOWA na właściwą." >&2
  exit 2
fi

w_tyle=$(git rev-list --count "HEAD..${baza}" 2>/dev/null || echo 0)
przede=$(git rev-list --count "${baza}..HEAD" 2>/dev/null || echo 0)

echo
echo "Gałąź:      $biezaca"
echo "Względem $baza:  $w_tyle commitów w tyle, $przede własnych"

# --- Czy ktoś już nie pracuje nad tym samym obszarem -------------------------
# Reguła antykolizyjna z AGENTS.md mówi: jeden plik = jeden otwarty PR. Bez tej
# kontroli dowiadujemy się o kolizji dopiero przy merge'u.
if [ ${#obszary[@]} -gt 0 ]; then
  echo
  echo "Gałęzie ruszające ${obszary[*]} poza $baza:"
  znalezione=0
  for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin \
               | grep -v "origin/HEAD$" | grep -v "^${baza}$"); do
    if [ -n "$(git diff --name-only "${baza}...${ref}" -- "${obszary[@]}" 2>/dev/null)" ]; then
      echo "  • ${ref#origin/}  (ostatni commit: $(git log -1 --format='%ad' --date=short "$ref"))"
      znalezione=1
    fi
  done
  [ "$znalezione" -eq 0 ] && echo "  (żadna — obszar wolny)"
fi

# --- Przypomnienie o notatkach ----------------------------------------------
if [ -f docs/NOTATKI.md ]; then
  nowe=$(sed -n '/^## 🆕 Nowe/,/^## ✅/p' docs/NOTATKI.md | grep -c '^- ' || true)
  if [ "$nowe" -gt 0 ]; then
    echo
    echo "📝 docs/NOTATKI.md ma $nowe otwartych uwag — przejrzyj je, zanim zaczniesz."
  fi
fi

# --- Werdykt -----------------------------------------------------------------
echo
if [ "$w_tyle" -gt "$PROG_OSTRZEZENIA" ]; then
  cat <<EOF
❌ Gałąź jest $w_tyle commitów za $baza (próg: $PROG_OSTRZEZENIA).

Tyle dystansu potrafi przenieść pliki między katalogami, a wtedy merge nie robi
konfliktu — dokłada drugi komplet plików obok istniejących. Zanim cokolwiek
napiszesz, zrób jedno z dwóch:

  git merge $baza          # gdy gałąź ma już własną pracę do zachowania
  git checkout -B <nazwa> $baza   # gdy zaczynasz od zera

EOF
  exit 1
fi

if [ "$w_tyle" -gt 0 ]; then
  echo "✅ Gałąź jest $w_tyle commitów w tyle — w normie, można pracować."
else
  echo "✅ Gałąź jest aktualna."
fi
exit 0
