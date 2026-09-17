import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { migrateLegacyKeys } from './lib/storage.ts';
import { migrateAllStorageAtStartup } from './lib/dataMigration.ts';
import { reportClientEnvIssues } from './lib/clientEnv.ts';
import { getSupabaseBrowserClient } from './lib/supabaseClient.ts';
import { initializeErrorMonitoring } from './lib/errorMonitoring.ts';
import { installGlobalErrorReporting } from './lib/errorReporter.ts';
import { AppErrorBoundary } from './components/ui/AppErrorBoundary.tsx';
import './index.css';

// Musi pójść przed pierwszym renderem: komponenty czytają swój stan
// z localStorage w leniwych inicjalizatorach `useState`, więc przeniesienie
// kluczy po zamontowaniu drzewa przyszłoby o jeden render za późno i
// użytkownik zobaczyłby pusty profil, zanim dane wróciłyby na swoje miejsce.
migrateLegacyKeys();
migrateAllStorageAtStartup();

// Niekompletna konfiguracja ma się ujawnić przy starcie, a nie w połowie
// ścieżki użytkownika. Tylko ostrzeżenie i tylko w trybie deweloperskim —
// praca bez backendu jest wspieranym sposobem pracy nad frontendem.
reportClientEnvIssues();
initializeErrorMonitoring();
// Globalne łapyacze wyjątków i obietnic oraz cykl flushowania zgłoszeń
// błędów do /api/errors. Przed pierwszym renderem — wyjątek w renderze ma już
// dokąd polecieć.
installGlobalErrorReporting();

// Podnosi klienta Supabase, gdy konfiguracja jest kompletna, i podpina dostawcę
// tokenu do `apiClient`. Bez konfiguracji zwraca null i nic się nie dzieje.
getSupabaseBrowserClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
