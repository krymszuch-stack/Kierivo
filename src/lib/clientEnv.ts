/**
 * Zmienne środowiskowe widoczne w przeglądarce, zwalidowane w jednym miejscu.
 *
 * Powód powstania tego pliku: `StripeCheckoutModal` czytał
 * `VITE_STRIPE_PUB_KEY`, a `.env.example` opisywał `VITE_STRIPE_PUBLISHABLE_KEY`.
 * Nazwy się nie zgadzały, więc klucz nigdy się nie wczytywał, a modal po cichu
 * wpadał w tryb demo — bez żadnego komunikatu, na produkcji tak samo jak
 * lokalnie. Literówka w nazwie zmiennej nie powinna objawiać się jako „płatności
 * działają inaczej niż myślisz".
 *
 * ⚠️ Wszystko z prefiksem `VITE_` jest wbudowywane w pakiet przeglądarki
 * w trakcie `npm run build` i jest **publiczne**. `SUPABASE_SERVICE_ROLE_KEY`
 * ani `STRIPE_SECRET_KEY` nie mogą tu trafić nigdy — pierwszy omija całe RLS,
 * drugi pozwala obciążać cudze karty.
 */

interface ClientEnv {
  /**
   * Adres API. Pusty w konfiguracji domyślnej i to jest poprawne: front i API
   * są serwowane z jednego kontenera, więc ścieżki względne trafiają tam, gdzie
   * trzeba. Zmienna istnieje na wypadek rozdzielenia hostingu.
   */
  apiUrl: string;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  stripePublishableKey: string | null;
  /** Publiczny DSN klienta Sentry; brak wartości wyłącza monitoring. */
  sentryDsn: string | null;
  /** Publiczny adres aplikacji używany do przekierowań OAuth i linków weryfikacyjnych. */
  publicAppUrl: string | null;
  /** `true`, gdy front ma z czym rozmawiać: adres i klucz publiczny Supabase. */
  backendConfigured: boolean;
}

function read(name: string): string | null {
  const envMap = import.meta.env as Record<string, string | undefined>;
  const raw = envMap[name] ?? (typeof process !== 'undefined' ? process.env?.[name] : undefined);
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

const supabaseUrl = read('VITE_SUPABASE_URL');
const supabaseAnonKey = read('VITE_SUPABASE_ANON_KEY');

export const clientEnv: ClientEnv = {
  apiUrl: read('VITE_API_URL') ?? '',
  supabaseUrl,
  supabaseAnonKey,
  stripePublishableKey: read('VITE_STRIPE_PUBLISHABLE_KEY'),
  sentryDsn: read('VITE_SENTRY_DSN'),
  publicAppUrl: read('VITE_PUBLIC_APP_URL') ?? read('PUBLIC_APP_URL'),
  backendConfigured: Boolean(supabaseUrl && supabaseAnonKey),
};

/**
 * Zgłasza niekompletną konfigurację od razu przy starcie, zamiast pozwolić jej
 * ujawnić się jako dziwne zachowanie w połowie ścieżki użytkownika.
 *
 * Świadomie tylko ostrzeżenie, nie wyjątek: tryb bez backendu (`BACKEND_MODE=local`)
 * jest wspieranym sposobem pracy nad frontendem i nie ma powodu, żeby psuł
 * uruchomienie. Odpowiednik serwerowy — `loadConfig()` — zatrzymuje proces,
 * bo tam brak klucza oznacza już realną awarię.
 */
export function reportClientEnvIssues(): void {
  if (!import.meta.env.DEV) return;

  const problems: string[] = [];

  if (supabaseUrl && !supabaseAnonKey) {
    problems.push('VITE_SUPABASE_URL jest ustawione, ale brakuje VITE_SUPABASE_ANON_KEY.');
  }
  if (!supabaseUrl && supabaseAnonKey) {
    problems.push('VITE_SUPABASE_ANON_KEY jest ustawione, ale brakuje VITE_SUPABASE_URL.');
  }

  const suspiciousKeys = [
    ['VITE', 'SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_'),
    ['VITE', 'STRIPE', 'SECRET', 'KEY'].join('_'),
  ];
  for (const suspicious of suspiciousKeys) {
    if (read(suspicious)) {
      problems.push(
        `${suspicious} jest ustawione. Ten sekret trafia do pakietu przeglądarki i musi zostać natychmiast unieważniony u dostawcy.`
      );
    }
  }

  if (problems.length > 0) {
    console.warn('[konfiguracja klienta]\n' + problems.map((p) => `  - ${p}`).join('\n'));
  }
}
