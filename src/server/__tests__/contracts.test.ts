import { describe, it, expect } from 'vitest';
import {
  applicationInputSchema,
  applicationPatchSchema,
  checkoutSessionSchema,
  fetchJdUrlSchema,
  parseJdSchema,
  vaultPayloadSchema,
} from '../../types/contracts';

/**
 * Kontrakty żądań są jedyną walidacją wejścia po stronie serwera — trasy same
 * już niczego nie sprawdzają. Te testy pilnują granic, na których wcześniej
 * stały ręczne `if`-y.
 */
describe('Kontrakt: pobranie ogłoszenia z adresu', () => {
  it('przycina białe znaki wokół adresu', () => {
    const result = fetchJdUrlSchema.parse({ url: '  https://example.com/oferta  ' });
    expect(result.url).toBe('https://example.com/oferta');
  });

  it('odrzuca pusty adres', () => {
    expect(fetchJdUrlSchema.safeParse({ url: '   ' }).success).toBe(false);
  });

  it('odrzuca adres dłuższy niż 2048 znaków', () => {
    // Dłuższy adres to prawie zawsze próba przemycenia ładunku, a nie oferta.
    const tooLong = `https://example.com/${'a'.repeat(2100)}`;
    expect(fetchJdUrlSchema.safeParse({ url: tooLong }).success).toBe(false);
  });
});

describe('Kontrakt: analiza treści ogłoszenia', () => {
  it('odrzuca treść złożoną z samych białych znaków', () => {
    // Wysłanie tego do modelu kosztowałoby wywołanie i nie dało nic w zamian.
    expect(parseJdSchema.safeParse({ rawJdText: '\n\t   ' }).success).toBe(false);
  });

  it('przyjmuje zwykłą treść ogłoszenia', () => {
    expect(parseJdSchema.safeParse({ rawJdText: 'Szukamy technika serwisu.' }).success).toBe(true);
  });
});

describe('Kontrakt: zapis vaultu', () => {
  const minimalVault = {
    version: '1',
    updatedAt: '2026-08-22T10:00:00.000Z',
    personalInfo: { fullName: 'Jan Kowalski' },
  };

  it('przyjmuje minimalny poprawny kształt', () => {
    expect(vaultPayloadSchema.safeParse({ vault: minimalVault, expectedUpdatedAt: null }).success).toBe(true);
  });

  it('zachowuje pola nieopisane w schemacie', () => {
    // `passthrough` jest celowy: MasterVault zmienia się razem z interfejsem,
    // a obcinanie nieznanych pól znaczyłoby, że starszy serwer po cichu gubi
    // dane zapisane przez nowszy front.
    const parsed = vaultPayloadSchema.parse({
      expectedUpdatedAt: '2026-08-22T10:00:00.000Z',
      vault: { ...minimalVault, sekcjaZPrzyszlosci: [{ cos: 'nowego' }] },
    });
    expect(parsed.vault).toHaveProperty('sekcjaZPrzyszlosci');
  });

  it('odrzuca vault bez wymaganych pól szkieletowych', () => {
    expect(vaultPayloadSchema.safeParse({ expectedUpdatedAt: null, vault: { version: '1' } }).success).toBe(false);
  });

  it('wymaga jawnej rewizji bazowej, aby nie dopuścić bezwarunkowego zapisu', () => {
    expect(vaultPayloadSchema.safeParse({ vault: minimalVault }).success).toBe(false);
    expect(vaultPayloadSchema.safeParse({ expectedUpdatedAt: 'nie-data', vault: minimalVault }).success).toBe(false);
  });
});

describe('Kontrakt: historia aplikacji', () => {
  it('ustawia domyślny status, gdy nie podano', () => {
    const parsed = applicationInputSchema.parse({ company: 'Firma', position: 'Stanowisko' });
    expect(parsed.status).toBe('Wysłana');
  });

  it('odrzuca status spoza listy', () => {
    const result = applicationInputSchema.safeParse({
      company: 'Firma',
      position: 'Stanowisko',
      status: 'Cokolwiek',
    });
    expect(result.success).toBe(false);
  });

  it('wymaga nazwy firmy i stanowiska', () => {
    expect(applicationInputSchema.safeParse({ company: '  ', position: 'X' }).success).toBe(false);
  });

  it('przyjmuje tylko bezpieczne linki http(s)', () => {
    expect(applicationInputSchema.safeParse({
      company: 'Firma', position: 'Stanowisko', jobUrl: 'https://example.com/jobs/1',
    }).success).toBe(true);
    expect(applicationInputSchema.safeParse({
      company: 'Firma', position: 'Stanowisko', jobUrl: 'javascript:alert(1)',
    }).success).toBe(false);
  });

  it('przyjmuje tylko bezpieczne linki http(s)', () => {
    expect(applicationInputSchema.safeParse({
      company: 'Firma', position: 'Stanowisko', jobUrl: 'https://example.com/jobs/1',
    }).success).toBe(true);
    expect(applicationInputSchema.safeParse({
      company: 'Firma', position: 'Stanowisko', jobUrl: 'javascript:alert(1)',
    }).success).toBe(false);
  });

  it('dopuszcza aktualizację częściową', () => {
    // PATCH nie wymaga kompletu pól, inaczej zmiana samego statusu zmuszałaby
    // klienta do odesłania całego wiersza.
    expect(applicationPatchSchema.safeParse({ status: 'Oferta' }).success).toBe(true);
  });
});

describe('Kontrakt: sesja płatności', () => {
  it('wymaga identyfikatora ceny', () => {
    expect(checkoutSessionSchema.safeParse({ priceId: '' }).success).toBe(false);
  });

  it('przyjmuje identyfikator ceny Stripe', () => {
    expect(checkoutSessionSchema.safeParse({ priceId: 'price_123' }).success).toBe(true);
  });
});
