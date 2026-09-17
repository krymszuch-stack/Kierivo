import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['src/server/__tests__/pdf.routes.setup.ts'],
  },
});