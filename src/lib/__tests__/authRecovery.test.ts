import { describe, expect, it } from 'vitest';
import { passwordRecoveryRedirectError, stripAuthErrorParams } from '../authRecovery';

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

describe('stripAuthErrorParams', () => {
  it('usuwa techniczne błędy i zachowuje parametry aplikacji', () => {
    expect(
      stripAuthErrorParams(
        'https://cvelocity.oathcry.com/?checkout=success&error=access_denied#error_code=otp_expired&tab=profil'
      )
    ).toBe('/?checkout=success#tab=profil');
  });
});
