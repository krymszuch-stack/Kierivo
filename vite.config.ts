import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    envPrefix: ['VITE_', 'PUBLIC_'],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Frontend i bundel serwera muszą leżeć osobno. Wcześniej oba lądowały
      // płasko w `dist/`, przez co `express.static` wystawiał publicznie
      // `server.cjs` razem z jego source mapą.
      outDir: 'dist/client',
      emptyOutDir: true,
    },
    test: {
      exclude: ['**/node_modules/**', '**/dist/**', 'labs/**'],
    },
    server: {
      port: 3000,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
