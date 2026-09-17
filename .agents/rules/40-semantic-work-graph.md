---
trigger: glob
globs: labs/semantic-work-graph/**
---

# semantic-work-graph — pakiet w labs/

Kanon: **@../../AGENTS.md**, sekcja „Dwa pakiety, dwie konfiguracje".

Ten katalog (`labs/semantic-work-graph/`) jest **wykluczony z konfiguracji katalogu głównego** — w
`tsconfig.json`, `eslint.config.js` i `vite.config.ts`. Ma własny `tsconfig`,
własne zależności, własnego Vitest i bazę SQLite przez `better-sqlite3`.

Konsekwencje praktyczne:

- Komendy uruchamiaj **z tego katalogu** (`labs/semantic-work-graph`), nie z katalogu głównego.
- **`.github/workflows/ci.yml` nie obejmuje tego pakietu.** Jego testy nie
  uruchomią się na GitHubie, więc po zmianie odpal je lokalnie — nikt inny tego
  za ciebie nie zrobi i nic nie zapali się na czerwono, gdy coś zepsujesz.
- Import z katalogu głównego do tego pakietu (i odwrotnie) nie zadziała tak, jak
  wygląda — to dwa oddzielne drzewa modułów. Kod z `labs/` nie może trafiać do bundla produkcyjnego.

Z tego samego powodu pakiet jest na **czerwonej liście delegowania**
([`docs/agents/delegowanie.md`](../../docs/agents/delegowanie.md)): zmiany tutaj
są poza zasięgiem automatycznej weryfikacji, więc wymagają ręcznego sprawdzenia.

Historyczna pułapka warta zapamiętania: klasyfikacja narzędzia była tu powielona
dwoma **różnymi** wyrażeniami regularnymi i tworzyła relacje do nieistniejących
węzłów grafu (`labs/semantic-work-graph/src/seed/SeedImporter.ts`) — reguła 3 wzięła
się między innymi stąd.
