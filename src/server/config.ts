import { z } from 'zod';
import { BETA_PURCHASES_ENABLED, FREE_BETA_ACTIVE } from '../lib/beta';

/**
 * Server configuration, validated once at boot.
 *
 * Failing here is deliberate: a missing GEMINI_API_KEY used to surface as a 500
 * on the first user request, with the raw error text echoed to the browser.
 * Crashing on startup makes the misconfiguration obvious to the operator instead.
 */
const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY jest wymagany do działania funkcji AI.'),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash-lite'),

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

export function loadConfig(): ServerConfig {
  if (cached) return cached;

  const parsed = configSchema.safeParse(process.env);

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

  // Walidacja warunkowa: w trybie `cloud` klucze Supabase przestają być
  // opcjonalne. Zatrzymanie procesu tutaj jest tą samą decyzją co przy
  // GEMINI_API_KEY — brak konfiguracji ma być widoczny dla operatora przy
  // starcie, a nie ujawniać się użytkownikowi błędem przy pierwszym logowaniu.
  if (data.BACKEND_MODE === 'cloud') {
    const missing = [
      !data.SUPABASE_URL && 'SUPABASE_URL',
      !data.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new Error(
        `BACKEND_MODE=cloud wymaga zmiennych: ${missing.join(', ')}.\n` +
          'Ustaw je albo wróć na BACKEND_MODE=local (dane zostają wtedy w przeglądarce).'
      );
    }
  }

  const stripeConfigured = Boolean(data.STRIPE_SECRET_KEY && data.STRIPE_WEBHOOK_SECRET);

  // Sam klucz sekretny bez sekretu webhooka to konfiguracja, w której da się
  // przyjąć płatność i nie da się jej potwierdzić — użytkownik płaci i nie
  // dostaje dostępu. Lepiej powiedzieć to głośno przy starcie.
  if (data.STRIPE_SECRET_KEY && !data.STRIPE_WEBHOOK_SECRET) {
    console.warn(
      '[konfiguracja] STRIPE_SECRET_KEY jest ustawiony bez STRIPE_WEBHOOK_SECRET. ' +
        'Płatności pozostają wyłączone: bez weryfikacji podpisu webhooka nie ma jak potwierdzić opłacenia.'
    );
  }

  if (FREE_BETA_ACTIVE && stripeConfigured) {
    console.info(
      '[konfiguracja] Bezpłatna beta jest aktywna. Klucze Stripe mogą być skonfigurowane, ale checkout pozostaje wyłączony decyzją produktową.'
    );
  }

  cached = {
    ...data,
    allowedOrigins: data.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    backendEnabled: data.BACKEND_MODE === 'cloud',
    paymentsEnabled:
      BETA_PURCHASES_ENABLED && data.BACKEND_MODE === 'cloud' && stripeConfigured,
  };

  return cached;
}

export function isProduction(): boolean {
  return loadConfig().NODE_ENV === 'production';
}
