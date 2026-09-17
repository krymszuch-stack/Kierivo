import { defineConfig } from 'vitest/config';

/**
 * Lokalna konfiguracja Vitest dla pakietu `semantic-work-graph`.
 *
 * Bez tego pliku Vitest wspina się do katalogu nadrzędnego i ładuje `vite.config.ts`
 * aplikacji frontendowej (razem z pluginami Reacta/Tailwinda, których ten pakiet
 * nie instaluje) — uruchomienie `npm test` kończyło się wtedy błędem
 * `Cannot find package '@tailwindcss/vite'`.
 */
export default defineConfig({
  test: {
    root: __dirname,
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    // Baza SQLite jest zasobem współdzielonym między plikami testowymi
    // (ten sam plik `.db` + tryb WAL), więc pliki uruchamiamy sekwencyjnie w procesach fork.
    fileParallelism: false,
    isolate: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
