import { describe, expect, it } from 'vitest';
import { authErrorMessage, isEmailNotConfirmed, oauthErrorMessage } from '../authErrors';

describe('komunikaty błędów logowania', () => {
  it('nie zdradza, czy konto istnieje — złe hasło i nieznany adres dają to samo zdanie', () => {
    // To jest cały sens tego modułu: formularz logowania nie może służyć
    // do sprawdzania, kto korzysta z aplikacji.
    const zleHaslo = authErrorMessage({ message: 'Invalid login credentials' });
    const brakKonta = authErrorMessage({ message: 'Invalid login credentials' });
    expect(zleHaslo).toBe(brakKonta);
    expect(zleHaslo).toBe('Nieprawidłowy e-mail lub hasło.');
  });

  it('rejestracja na zajęty adres nie potwierdza, że adres jest zajęty', () => {
    const komunikat = authErrorMessage({ message: 'User already registered' });
    expect(komunikat).not.toMatch(/istnieje|zajęt|zarejestrowan/i);
    expect(komunikat).toContain('Jeśli');
  });

  it('tłumaczy niepotwierdzony e-mail na instrukcję, nie na kod błędu', () => {
    expect(authErrorMessage({ message: 'Email not confirmed' })).toContain('Potwierdź adres');
  });

  it('rozpoznaje limit prób', () => {
    expect(authErrorMessage({ message: 'For security purposes, you can only request this after 51 seconds' }))
      .toContain('Za dużo prób');
  });

  it('nieznany błąd dostaje komunikat ogólny, nigdy surowej treści od dostawcy', () => {
    const komunikat = authErrorMessage({ message: 'column "foo" does not exist in relation bar' });
    expect(komunikat).not.toContain('column');
    expect(komunikat).not.toContain('relation');
    expect(komunikat).toBe('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
  });

  it('brak błędu też daje sensowne zdanie, a nie puste miejsce', () => {
    expect(authErrorMessage(null)).toBeTruthy();
    expect(authErrorMessage(undefined)).toBeTruthy();
    expect(authErrorMessage({})).toBeTruthy();
  });

  it('czyta również pole code, nie tylko message', () => {
    expect(authErrorMessage({ code: 'otp_expired' })).toContain('Link wygasł');
  });

  it('rozpoznaje niepotwierdzony e-mail osobno, żeby dało się pokazać ponowną wysyłkę', () => {
    expect(isEmailNotConfirmed({ message: 'Email not confirmed' })).toBe(true);
    expect(isEmailNotConfirmed({ message: 'Invalid login credentials' })).toBe(false);
    expect(isEmailNotConfirmed(null)).toBe(false);
  });
});

describe('komunikaty błędów powrotu OAuth', () => {
  it('anulowanie w oknie dostawcy dostaje komunikat o akceptacji dostępu', () => {
    expect(oauthErrorMessage('access_denied', 'User cancelled the flow'))
      .toContain('anulowane');
    expect(oauthErrorMessage(null, 'Sign-in cancelled by user')).toContain('anulowane');
  });

  it('wyłączony dostawca kieruje do e-maila zamiast milczeć', () => {
    expect(oauthErrorMessage('unsupported_provider', null)).toContain('e-maila');
    expect(oauthErrorMessage(null, 'Provider is not enabled')).toContain('e-maila');
  });

  it('nigdy nie pokazuje surowego opisu od dostawcy — nieznane idzie pod komunikat ogólny', () => {
    const komunikat = oauthErrorMessage(
      'something_new',
      'LinkedIn internal error at endpoint /v2/me (trace 8823)'
    );
    expect(komunikat).toBe('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
    expect(komunikat).not.toContain('LinkedIn');
    expect(komunikat).not.toContain('/v2/me');
  });

  it('puste parametry dają komunikat ogólny, nie pusty baner', () => {
    expect(oauthErrorMessage(null, null)).toBeTruthy();
    expect(oauthErrorMessage('', '')).toBeTruthy();
  });
});
