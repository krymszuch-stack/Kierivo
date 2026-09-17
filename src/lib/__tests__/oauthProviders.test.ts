import { describe, expect, it } from 'vitest';
import { OAUTH_PROVIDERS, oauthProviderById, type OAuthProviderId } from '../oauthProviders';

/**
 * Rejestr dostawców to jedno źródło prawdy dla AuthModal i AuthContext.
 * Ten test pilnuje przede wszystkim identyfikatorów **Supabase** — historyczne
 * id `linkedin` już nie istnieje (usunięte z Supabase 04.01.2024) i jego
 * przypadkowe przywrócenie musiałoby się skończyć błędem „unsupported
 * provider" u każdego, kto kliknie przycisk.
 */
describe('rejestr dostawców OAuth', () => {
  it('prowadzi dokładnie trzech dostawców: Google, Microsoft (azure), LinkedIn (linkedin_oidc)', () => {
    expect(OAUTH_PROVIDERS.map((p) => p.id)).toEqual(['google', 'azure', 'linkedin_oidc']);
  });

  it('nie zawiera wycofanego identyfikatora legacy `linkedin`', () => {
    const ids: string[] = OAUTH_PROVIDERS.map((p) => p.id);
    expect(ids).not.toContain('linkedin');
  });

  it('każdy dostawca ma komplet fraz UI — przyciski nie mogą wyjść z pustą etykietą', () => {
    for (const provider of OAUTH_PROVIDERS) {
      expect(provider.label.length).toBeGreaterThan(0);
      expect(provider.continueWith.length).toBeGreaterThan(0);
      expect(provider.registerVia.length).toBeGreaterThan(0);
    }
  });

  it('Google zachowuje swoje queryParams z czasu, gdy działał jako jedyny', () => {
    const google = oauthProviderById('google');
    expect(google?.queryParams).toEqual({ access_type: 'offline', prompt: 'select_account' });
  });

  it('azure wymusza wybór konta, LinkedIn dostaje pustą mapę ( OIDC nie zna select_account)', () => {
    expect(oauthProviderById('azure')?.queryParams).toEqual({ prompt: 'select_account' });
    expect(oauthProviderById('linkedin_oidc')?.queryParams).toEqual({});
  });

  it('pobieranie po nieznanych id zwraca undefined zamiast wybuchać', () => {
    expect(oauthProviderById('linkedin' as OAuthProviderId)).toBeUndefined();
    expect(oauthProviderById('apple' as OAuthProviderId)).toBeUndefined();
  });
});
