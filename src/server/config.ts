import { z } from 'zod';
import { PAYMENTS_ENABLED, BETA_PURCHASES_ENABLED } from '../lib/beta';

/**
 * Server configuration, validated once at boot.
 *
 * Failing here is deliberate: missing AI configuration must not surface as a 500
 * on the first user request, with the raw error text echoed to the browser.
 * Crashing on startup makes the misconfiguration obvious to the operator instead.
 */
const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  AI_PROVIDER: z.enum(['azure_openai', 'ollama']).default('ollama'),
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().min(1).optional(),
  AZURE_OPENAI_API_VERSION: z.string().min(1).default('2024-10-21'),

  // Domyślnie tylko proces lokalny. Adres urządzenia w LAN operator podaje
  // jawnie w środowisku; nie może być ukrytym zachowaniem wdrożenia chmurowego.
  OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().min(1).default('qwen-chat:latest'),

  /**
   * `local`  — bez bazy i bez kont; dane zostają w przeglądarce. Tryb pracy nad
   *            frontendem i dotychczasowe zachowanie aplikacji.
   * `cloud`  — konta, trwałe dane i limity liczone po stronie serwera.
   *
   * Wybór jest jawny, bo pomyłka w każdą stronę jest kosztowna: `cloud` bez
   * kluczy Supabase to serwer, który wstaje i odrzuca każde żądanie
   * uwierzytelnione; `local` na produkcji to trasy płatności, które przyjmują
   * żądania i nie mają gdzie zapisać wyniku.
   */
  BACKEND_MODE: z.enum(['local', 'cloud']).default('local'),

  SUPABASE_URL: z.string().url().optional(),
  /** ⚠️ Omija całe RLS. Nigdy z prefiksem VITE_, nigdy w repozytorium. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  /** Adres publiczny aplikacji — potrzebny do zbudowania adresów powrotu ze Stripe'a. */
  APP_URL: z.string().url().default('http://localhost:3000'),

  /**
   * Comma-separated list of origins allowed to call the API.
   * Empty in development means "same origin only", which is what the Vite dev
   * server needs — it is never a wildcard.
   */
  ALLOWED_ORIGINS: z.string().default(''),

  /**
   * Set only when the app actually runs behind a reverse proxy. Enabling it
   * without one lets a client spoof its address via X-Forwarded-For and slip
   * past the rate limiter; leaving it off behind a proxy collapses every user
   * into one bucket. Both directions are wrong, so it has to be explicit.
   */
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type ServerConfig = z.infer<typeof configSchema> & {
  allowedOrigins: string[];
  /** `true`, gdy da się rozmawiać z bazą — czyli gdy trasy kont mają sens. */
  backendEnabled: boolean;
  /** `true`, gdy sprzedaż jest świadomie włączona i komplet kluczy Stripe'a jest na miejscu. */
  paymentsEnabled: boolean;
};

let cached: ServerConfig | null = null;

export function validateConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  // Wykrywanie niebezpiecznych wycieków sekretów do zmiennych klienckich VITE_
  const dangerousViteKeys = [
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'VITE_STRIPE_SECRET_KEY',
    'VITE_STRIPE_WEBHOOK_SECRET',
  ];
  const leakedKeys = dangerousViteKeys.filter((k) => env[k]?.trim());
  if (leakedKeys.length > 0) {
    throw new Error(
      `Krytyczny błąd bezpieczeństwa w konfiguracji serwera:\n` +
        `Wykryto prywatny sekret z prefiksem VITE_: ${leakedKeys.join(', ')}.\n` +
        `Zmienne z prefiksem VITE_ trafiają bezpośrednio do publicznego pakietu przeglądarki. ` +
        `Usuń prefiks VITE_ i unieważnij skompromitowany klucz u dostawcy.`
    );
  }

  const parsed = configSchema.safeParse(env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Nieprawidłowa konfiguracja serwera:\n${problems}\n\n` +
        'Uzupełnij plik .env na podstawie .env.example.'
    );
  }

  const data = parsed.data;

  // Azure używa Managed Identity (w chmurze) albo świadomego `az login` lokalnie;
  // przy Ollamie żaden zewnętrzny sekret nie jest potrzebny.
  if (
    data.NODE_ENV !== 'test' &&
    data.AI_PROVIDER === 'azure_openai' &&
    (!data.AZURE_OPENAI_ENDPOINT || !data.AZURE_OPENAI_DEPLOYMENT)
  ) {
    throw new Error(
      'Krytyczny błąd konfiguracji serwera:\n' +
        '  - AI_PROVIDER=azure_openai wymaga ustawienia AZURE_OPENAI_ENDPOINT oraz AZURE_OPENAI_DEPLOYMENT.\n\n' +
        'Uzupełnij plik .env na podstawie .env.example albo wybierz lokalną Ollamę (AI_PROVIDER=ollama).'
    );
  }

  // Walidacja warunkowa: w trybie `cloud` klucze Supabase przestają być
  // opcjonalne. Zatrzymanie procesu tutaj jest twardą barierą — brak konfiguracji
  // ma natychmiast zatrzymać start serwera, zamiast ujawniać się błędem 500 użytkownikowi.
  if (data.BACKEND_MODE === 'cloud') {
    const missing = [
      !data.SUPABASE_URL && 'SUPABASE_URL',
      !data.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new Error(
        `Krytyczny błąd konfiguracji serwera:\n` +
          `BACKEND_MODE=cloud wymaga zmiennych: ${missing.join(', ')}.\n` +
          'Ustaw je w pliku .env albo zmień BACKEND_MODE=local (dane pozostaną wtedy lokalnie w przeglądarce).'
      );
    }
  }

  // Twarda walidacja spójności Stripe: klucz prywatny i sekret webhooka muszą występować w parze.
  // Posiadanie jednego bez drugiego uniemożliwia bezpieczne i spójne przetwarzanie płatności.
  const hasStripeKey = Boolean(data.STRIPE_SECRET_KEY);
  const hasStripeWebhook = Boolean(data.STRIPE_WEBHOOK_SECRET);
  if (data.NODE_ENV !== 'test' && hasStripeKey !== hasStripeWebhook) {
    const missingStripeVar = hasStripeKey ? 'STRIPE_WEBHOOK_SECRET' : 'STRIPE_SECRET_KEY';
    const presentStripeVar = hasStripeKey ? 'STRIPE_SECRET_KEY' : 'STRIPE_WEBHOOK_SECRET';
    throw new Error(
      `Krytyczny błąd konfiguracji serwera:\n` +
        `Zmienna ${presentStripeVar} jest ustawiona, ale brakuje ${missingStripeVar}.\n` +
        `Klucze Stripe muszą być skonfigurowane łącznie — bez webhooka nie da się potwierdzić opłacenia, ` +
        `a bez klucza prywatnego nie da się utworzyć sesji płatności.`
    );
  }

  // Restrykcje środowiska produkcyjnego: ochrona przed błędami operacyjnymi wdrożenia chmurowego.
  if (data.NODE_ENV === 'production') {
    const isLocalhostAppUrl =
      data.APP_URL.includes('localhost') ||
      data.APP_URL.includes('127.0.0.1') ||
      data.APP_URL.includes('0.0.0.0');

    if (isLocalhostAppUrl) {
      throw new Error(
        `Krytyczny błąd konfiguracji serwera produkcyjnego:\n` +
          `APP_URL na produkcji (NODE_ENV=production) nie może wskazywać na adres lokalny (${data.APP_URL}).\n` +
          `Ustaw publiczny adres aplikacji (np. https://app.kierivo.com) w zmiennej APP_URL.`
      );
    }

    if (data.BACKEND_MODE === 'local') {
      throw new Error(
        `Krytyczny błąd konfiguracji serwera produkcyjnego:\n` +
          `Wdrożenie produkcyjne (NODE_ENV=production) wymaga BACKEND_MODE=cloud.\n` +
          `Tryb BACKEND_MODE=local odrzuca żądania autoryzacji i nie prowadzi trwałej bazy danych.`
      );
    }
  }

  const stripeConfigured = Boolean(data.STRIPE_SECRET_KEY && data.STRIPE_WEBHOOK_SECRET);

  if (!PAYMENTS_ENABLED && stripeConfigured) {
    console.info(
      '[konfiguracja] Płatności są wyłączone (PAYMENTS_ENABLED=false). Klucze Stripe są skonfigurowane, ale checkout pozostaje wyłączony decyzją produktową w fazie Public Pre-Beta.'
    );
  }

  return {
    ...data,
    allowedOrigins: data.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    backendEnabled: data.BACKEND_MODE === 'cloud',
    paymentsEnabled:
      PAYMENTS_ENABLED && BETA_PURCHASES_ENABLED && data.BACKEND_MODE === 'cloud' && stripeConfigured,
  };
}

export function loadConfig(): ServerConfig {
  if (cached) return cached;
  cached = validateConfig(process.env);
  return cached;
}

/** Twarda walidacja konfiguracji startowej — alias dla jawnego wywołania przy rozruchu. */
export function validateStartupEnv(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return validateConfig(env);
}

export function isProduction(): boolean {
  return loadConfig().NODE_ENV === 'production';
}

/** Resetuje pamięć podręczną konfiguracji — wyłącznie na potrzeby testów jednostkowych. */
export function resetConfigCacheForTesting(): void {
  cached = null;
}
