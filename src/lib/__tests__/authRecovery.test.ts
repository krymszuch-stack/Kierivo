import { describe, expect, it } from 'vitest';
import {
  oauthRedirectError,
  passwordRecoveryRedirectError,
  stripAuthErrorParams,
} from '../authRecovery';

describe('passwordRecoveryRedirectError', () => {
  it('tłumaczy wygasły token recovery z hasha na polski komunikat', () => {
    const message = passwordRecoveryRedirectError(
      '',
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    );

    expect(message).toBe('Link wygasł. Poproś o nowy.');
  });

  it('nie przechwytuje niespokrewnionego błędu OAuth', () => {
    expect(
      passwordRecoveryRedirectError('?error=access_denied&error_description=Provider+refused', '')
    ).toBeNull();
  });
});

describe('oauthRedirectError', () => {
  it('czyta anulowanie z query po powrocie z dostawcy', () => {
    const message = oauthRedirectError('?error=access_denied&error_description=User+cancelled', '');
    expect(message).toContain('anulowane');
  });

  it('czyta błąd z hasha — tam wraca Supabase w przepływie implicit', () => {
    const message = oauthRedirectError(
      '',
      '#error=access_denied&error_code=401&error_description=Provider+refused+the+request'
    );
    expect(message).toContain('anulowane');
  });

  it('granica z recovery: wygasły link jednorazowy NIE staje się komunikatem OAuth', () => {
    expect(
      oauthRedirectError('', '#error_code=otp_expired&error_description=Email+link+has+expired')
    ).toBeNull();
  });

  it('brak parametrów błędu oznacza zwykły powrót z sesją — null, bez baneru', () => {
    expect(oauthRedirectError('?checkout=success', '#access_token=x')).toBeNull();
    expect(oauthRedirectError('', '')).toBeNull();
  });

  it('wyłączony dostawca (błąd Supabase) dostaje komunikat kierujący na e-mail', () => {
    const message = oauthRedirectError('?error=unsupported_provider', '');
    expect(message).toContain('e-maila');
  });
});

describe('stripAuthErrorParams', () => {
  it('usuwa techniczne błędy i zachowuje parametry aplikacji', () => {
    expect(
      stripAuthErrorParams(
        'https://cvelocity.oathcry.com/?checkout=success&error=access_denied#error_code=otp_expired&tab=profil'
      )
    ).toBe('/?checkout=success#tab=profil');
  });
});
