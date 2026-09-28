import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['src/server/__tests__/pdf.routes.setup.ts'],
    // Graf wiedzy ma własny Vitest i natywną zależność better-sqlite3.
    // Uruchamianie go z konfiguracji aplikacji łamało podział opisany w AGENTS.md.
    exclude: [...configDefaults.exclude, 'labs/**'],
  },
});
