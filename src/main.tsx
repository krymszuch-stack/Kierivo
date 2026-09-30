import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { migrateLegacyKeys } from './lib/storage.ts';
import { preloadIdbMirror } from './lib/idbFallback.ts';
import { mountAfterStorageRestore } from './lib/storageBootstrap.ts';
import { migrateAllStorageAtStartup } from './lib/dataMigration.ts';
import { reportClientEnvIssues } from './lib/clientEnv.ts';
import { getSupabaseBrowserClient } from './lib/supabaseClient.ts';
import { initializeErrorMonitoring } from './lib/errorMonitoring.ts';
import { installGlobalErrorReporting } from './lib/errorReporter.ts';
import { AppErrorBoundary } from './components/ui/AppErrorBoundary.tsx';
import './index.css';

// Najpierw odtwórz kopię IndexedDB: profil i Vault są czytane synchronicznie
// przez inicjalizatory Reacta, więc render wcześniej mógłby pokazać pusty stan.
void mountAfterStorageRestore(
  preloadIdbMirror(),
  () => {
    // Migracje muszą działać na odtworzonym magazynie, przed pierwszym renderem.
    migrateLegacyKeys();
    migrateAllStorageAtStartup();

    // Niekompletna konfiguracja ma się ujawnić przy starcie, a nie w połowie
    // ścieżki użytkownika. Tylko ostrzeżenie i tylko w trybie deweloperskim.
    reportClientEnvIssues();
    initializeErrorMonitoring();
    installGlobalErrorReporting();

    // Podnosi klienta Supabase, gdy konfiguracja jest kompletna.
    getSupabaseBrowserClient();
  },
  () => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </StrictMode>,
    );
  },
);
