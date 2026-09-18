import { clientEnv } from './clientEnv';

export const DEFAULT_PRODUCTION_APP_URL = 'https://kierivo.com/';
const LEGACY_DOMAIN_DISALLOWED = 'cvelocity.oathcry.com';

function sanitizeRedirectUrl(urlCandidate: string): string | null {
  try {
    const parsed = new URL(urlCandidate);
    // Nigdy nie zezwalaj na powrót do starej domeny
    if (parsed.hostname.toLowerCase() === LEGACY_DOMAIN_DISALLOWED) {
      return null;
    }
    const pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
    return `${parsed.origin}${pathname}`;
  } catch {
    return null;
  }
}

export interface ResolveAuthRedirectOptions {
  envAppUrl?: string | null;
  origin?: string | null;
}

/**
 * Wyznacza adres powrotu po udanym uwierzytelnieniu (OAuth / link resetu hasła).
 *
 * Priorytety:
 * 1. Jawny PUBLIC_APP_URL / VITE_PUBLIC_APP_URL ze zmiennych środowiskowych.
 * 2. Aktualny origin przeglądarki (window.location.origin).
 * 3. Domyślny adres produkcyjny (https://kierivo.com/).
 *
 * Gwarancje:
 * - Zawsze kończy się slashem `/`.
 * - Zdezaktualizowana domena cvelocity.oathcry.com jest bezwzględnie blokowana.
 */
export function resolveAuthRedirectUrl(options?: ResolveAuthRedirectOptions): string {
  // 1. Jawna konfiguracja środowiskowa (PUBLIC_APP_URL / VITE_PUBLIC_APP_URL)
  const envUrl = options?.envAppUrl ?? clientEnv.publicAppUrl;
  if (envUrl) {
    const sanitized = sanitizeRedirectUrl(envUrl);
    if (sanitized) return sanitized;
  }

  // 2. Aktualny origin przeglądarki
  const currentOrigin =
    options?.origin !== undefined
      ? options.origin
      : typeof window !== 'undefined'
        ? window.location?.origin
        : null;

  if (currentOrigin) {
    const sanitized = sanitizeRedirectUrl(currentOrigin);
    if (sanitized) return sanitized;
  }

  // 3. Bezpieczny domyślny adres produkcyjny
  return DEFAULT_PRODUCTION_APP_URL;
}

/**
 * Podstawowa funkcja zwracająca docelowy redirectTo dla supabase.auth.signInWithOAuth
 * oraz supabase.auth.resetPasswordForEmail.
 */
export function getAuthRedirectUrl(): string {
  return resolveAuthRedirectUrl();
}
