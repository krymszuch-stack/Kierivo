/**
 * Rejestr dostawców logowania OAuth — jedyne miejsce, które wie, jakich
 * dostawców aplikacja w ogóle prowadzi.
 *
 * Tu trafiło to, co dotąd żyło wprost w `AuthContext` (id i queryParams
 * Google) oraz w treści przycisków AuthModal: dzięki temu dodanie kolejnego
 * dostawcy to jeden wpis, a nie szukanie trzech miejsc (reguła 3).
 *
 * Identyfikatory są nazwami dostawców **Supabase Auth** i muszą się zgadzać
 * z jego konfiguracją — w szczególności LinkedIn istnieje wyłącznie jako
 * `linkedin_oidc` (produkt „Sign In with LinkedIn using OpenID Connect");
 * legacy dostawca `linkedin` został usunięty z Supabase 04.01.2024 i jego
 * użycie kończy się błędem „unsupported provider".
 */

export type OAuthProviderId = 'google' | 'azure' | 'linkedin_oidc';

export interface OAuthProviderMeta {
  id: OAuthProviderId;
  /** Nazwa dostawcy, gdy trzeba o nim mówić samodzielnie (np. baner błędu). */
  label: string;
  /** Fraza dopełniaczowa po „Kontynuuj”: „Kontynuuj z Google". */
  continueWith: string;
  /** Fraza po „Zarejestruj się”: „Zarejestruj się przez Microsoft". */
  registerVia: string;
  /**
   * Parametry doklejane do adresu authorize dostawcy. `prompt=select_account`
   * wymusza wybór konta, żeby powrót zawsze dotyczył konta, które użytkownik
   * świadomie wskazał — a nie siedzącej w przeglądarce sesji dostawcy.
   */
  queryParams: Record<string, string>;
}

export const OAUTH_PROVIDERS: readonly OAuthProviderMeta[] = [
  {
    id: 'google',
    label: 'Google',
    continueWith: 'z Google',
    registerVia: 'przez Google',
    queryParams: { access_type: 'offline', prompt: 'select_account' },
  },
  {
    id: 'azure',
    label: 'Microsoft',
    continueWith: 'z Microsoftem',
    registerVia: 'przez Microsoft',
    queryParams: { prompt: 'select_account' },
  },
  {
    id: 'linkedin_oidc',
    label: 'LinkedIn',
    continueWith: 'z LinkedIn',
    registerVia: 'przez LinkedIn',
    // LinkedIn OIDC zna wyłącznie prompt none/login/consent — `select_account`
    // (rozszerzenie Google/Azure) mógłby poskutkować odrzuceniem żądania,
    // więc LinkedIn dostaje pustą mapę i naturalny wybór konta po swojej stronie.
    queryParams: {},
  },
];

/** Bezpieczne pobranie metadanych — nieznane id nie może dobić do Supabase. */
export function oauthProviderById(id: OAuthProviderId): OAuthProviderMeta | undefined {
  return OAUTH_PROVIDERS.find((provider) => provider.id === id);
}
