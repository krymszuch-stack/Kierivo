import { describe, it, expect, afterEach } from 'vitest';
import {
  resolveAuthRedirectUrl,
  getAuthRedirectUrl,
  DEFAULT_PRODUCTION_APP_URL,
} from '../authRedirect';

describe('resolveAuthRedirectUrl', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    // Przywracamy stan globalnego obiektu window po każdym teście
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).window;
    }
  });

  it('dla originu https://kierivo.com oczekuje https://kierivo.com/', () => {
    const redirect = resolveAuthRedirectUrl({
      origin: 'https://kierivo.com',
      envAppUrl: null,
    });
    expect(redirect).toBe('https://kierivo.com/');
  });

  it('dla originu https://kierivo.com/ z końcowym slashem zachowuje poprawny format', () => {
    const redirect = resolveAuthRedirectUrl({
      origin: 'https://kierivo.com/',
      envAppUrl: null,
    });
    expect(redirect).toBe('https://kierivo.com/');
  });

  it('dla jawnego PUBLIC_APP_URL=https://kierivo.com zwraca https://kierivo.com/ i ma priorytet nad originem', () => {
    const redirect = resolveAuthRedirectUrl({
      envAppUrl: 'https://kierivo.com',
      origin: 'https://inny-adres.example.com',
    });
    expect(redirect).toBe('https://kierivo.com/');
  });

  it('dla lokalnego środowiska deweloperskiego zwraca adres z portem i slashem', () => {
    const redirect = resolveAuthRedirectUrl({
      origin: 'http://localhost:3000',
      envAppUrl: null,
    });
    expect(redirect).toBe('http://localhost:3000/');
  });

  it('dla braku originu i braku zmiennej env bezpiecznie wraca do produkcyjnego https://kierivo.com/', () => {
    const redirect = resolveAuthRedirectUrl({
      origin: null,
      envAppUrl: null,
    });
    expect(redirect).toBe(DEFAULT_PRODUCTION_APP_URL);
    expect(redirect).toBe('https://kierivo.com/');
  });

  describe('test regresyjny: cvelocity.oathcry.com nie pojawia się w redirectach', () => {
    const STARA_DOMENA = 'cvelocity.oathcry.com';

    it('odrzuca stary origin https://cvelocity.oathcry.com i stosuje bezpieczny fallback https://kierivo.com/', () => {
      const redirect = resolveAuthRedirectUrl({
        origin: `https://${STARA_DOMENA}`,
        envAppUrl: null,
      });

      expect(redirect).not.toContain(STARA_DOMENA);
      expect(redirect).toBe('https://kierivo.com/');
    });

    it('odrzuca starą domenę podaną omyłkowo w PUBLIC_APP_URL i nie wpuszcza jej do redirectu', () => {
      const redirect = resolveAuthRedirectUrl({
        origin: 'https://kierivo.com',
        envAppUrl: `https://${STARA_DOMENA}`,
      });

      expect(redirect).not.toContain(STARA_DOMENA);
      expect(redirect).toBe('https://kierivo.com/');
    });

    it('w żadnym wariancie produkcyjnym cvelocity.oathcry.com nie jest zwracane', () => {
      const warianty = [
        resolveAuthRedirectUrl(),
        resolveAuthRedirectUrl({ origin: 'https://kierivo.com' }),
        resolveAuthRedirectUrl({ envAppUrl: 'https://kierivo.com' }),
        resolveAuthRedirectUrl({ origin: `https://${STARA_DOMENA}` }),
        resolveAuthRedirectUrl({ envAppUrl: `https://${STARA_DOMENA}`, origin: `https://${STARA_DOMENA}` }),
      ];

      for (const wariant of warianty) {
        expect(wariant).not.toContain(STARA_DOMENA);
      }
    });
  });

  describe('getAuthRedirectUrl z atrapą window', () => {
    it('czyta window.location.origin, gdy funkcja wywoływana jest bez parametrów', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window = {
        location: {
          origin: 'https://kierivo.com',
        },
      };

      expect(getAuthRedirectUrl()).toBe('https://kierivo.com/');
    });
  });
});
