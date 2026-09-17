import { authErrorMessage, oauthErrorMessage } from './authErrors';

const RECOVERY_ERROR_PATTERN = /otp_expired|token has expired|invalid.*token|email link.*invalid|email link.*expired/i;
const AUTH_ERROR_KEYS = ['error', 'error_code', 'error_description'] as const;

function paramsFromHash(hash: string): URLSearchParams {
  return new URLSearchParams(hash.replace(/^#/, ''));
}

/**
 * Czyta wyłącznie błędy charakterystyczne dla linku jednorazowego.
 * Nie przechwytujemy tu np. błędu OAuth Google, bo powinien zostać obsłużony
 * przez ekran logowania, a nie udawać nieudany reset hasła.
 */
export function passwordRecoveryRedirectError(search: string, hash: string): string | null {
  const searchParams = new URLSearchParams(search);
  const hashParams = paramsFromHash(hash);

  const code = hashParams.get('error_code') ?? searchParams.get('error_code') ?? undefined;
  const description =
    hashParams.get('error_description') ??
    searchParams.get('error_description') ??
    hashParams.get('error') ??
    searchParams.get('error') ??
    undefined;

  const combined = `${code ?? ''} ${description ?? ''}`.trim();
  if (!combined || !RECOVERY_ERROR_PATTERN.test(combined)) return null;

  return authErrorMessage({ code, message: description });
}

/**
 * Błędy powrotu OAuth — wszystko, co zostało w adresie po tym, jak
 * `passwordRecoveryRedirectError` stwierdziło, że to NIE jest wygasły link
 * jednorazowy. Bez tej granicy komunikat „link wygasł" pokazałby się też
 * komuś, kto po prostu anulował okno Google.
 */
export function oauthRedirectError(search: string, hash: string): string | null {
  const searchParams = new URLSearchParams(search);
  const hashParams = paramsFromHash(hash);

  const code = hashParams.get('error_code') ?? searchParams.get('error_code') ?? null;
  const errorKey = hashParams.get('error') ?? searchParams.get('error') ?? null;
  const description = hashParams.get('error_description') ?? searchParams.get('error_description') ?? null;

  // Bez parametrów błędu nie ma o czym mówić — zwyczajny powrót z sesją.
  if (!code && !errorKey && !description) return null;

  const combined = `${code ?? ''} ${errorKey ?? ''} ${description ?? ''}`.trim();
  // Wygasły link recovery obsługuje osobny ekran — tu go nie dotykamy.
  if (RECOVERY_ERROR_PATTERN.test(combined)) return null;

  // Kod i klucz `error` idą razem: wracają różnymi parami (np. `error_code=401`
  // + `error=access_denied`), a wzorce mapowania dopasowują się po obu.
  const codeCombined = [code, errorKey].filter(Boolean).join(' ');
  return oauthErrorMessage(codeCombined || null, description);
}

/**
 * Usuwa techniczne parametry błędu z paska adresu bez ruszania innych parametrów
 * aplikacji. Dzięki temu odświeżenie strony nie pokazuje w kółko starego błędu.
 */
export function stripAuthErrorParams(href: string): string {
  const url = new URL(href);
  for (const key of AUTH_ERROR_KEYS) url.searchParams.delete(key);

  const hashParams = paramsFromHash(url.hash);
  for (const key of AUTH_ERROR_KEYS) hashParams.delete(key);

  const nextHash = hashParams.toString();
  url.hash = nextHash ? `#${nextHash}` : '';
  return `${url.pathname}${url.search}${url.hash}`;
}
