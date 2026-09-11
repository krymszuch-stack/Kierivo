/**
 * Konfiguracja próbki — jedyne miejsce, w którym czytamy `process.env`.
 *
 * Powód jest ten sam co w `src/server/config.ts` aplikacji: rozsypane po kodzie
 * `process.env.X ?? 'jakaś-wartość'` sprawia, że brak zmiennej ujawnia się
 * dopiero w środku żądania, jako błąd 500 bez wskazówki, czego brakuje.
 * Tutaj każda brakująca wartość ma nazwę, powód i miejsce, z którego się ją
 * bierze.
 *
 * Świadomie **nie** ma tu wartości zastępczych dla sekretów. Klucz Stripe'a
 * z wartością domyślną to najkrótsza droga do próbki, która „działa" lokalnie
 * i wybucha przy pierwszym prawdziwym żądaniu.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KATALOG_PROBKI = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Minimalny czytnik `.env`.
 *
 * Próbka nie ciągnie `dotenv` jako zależności, żeby lista pakietów mówiła
 * wyłącznie o Stripie i Expressie. Obsługujemy dokładnie to, czego wymaga
 * `.env.example`: `KLUCZ=wartość`, komentarze od `#`, puste linie.
 * Wartości już obecne w `process.env` mają pierwszeństwo — tak zachowuje się
 * `dotenv` i tak działa przekazanie zmiennej w linii poleceń.
 */
function wczytajPlikEnv(): void {
  let tresc: string;
  try {
    tresc = readFileSync(resolve(KATALOG_PROBKI, '.env'), 'utf8');
  } catch {
    // Brak `.env` nie jest błędem: zmienne mogą przyjść ze środowiska.
    // Jeśli faktycznie ich brakuje, powie o tym `wymagana()` niżej.
    return;
  }

  for (const linia of tresc.split('\n')) {
    const przycieta = linia.trim();
    if (!przycieta || przycieta.startsWith('#')) continue;

    const znakRownosci = przycieta.indexOf('=');
    if (znakRownosci === -1) continue;

    const klucz = przycieta.slice(0, znakRownosci).trim();
    const wartosc = przycieta.slice(znakRownosci + 1).trim().replace(/^["']|["']$/g, '');

    if (process.env[klucz] === undefined) process.env[klucz] = wartosc;
  }
}

wczytajPlikEnv();

/** Błąd konfiguracji — łapany przy starcie, nie w środku żądania. */
export class BladKonfiguracji extends Error {
  constructor(komunikat: string) {
    super(komunikat);
    this.name = 'BladKonfiguracji';
  }
}

/**
 * Zwraca wymaganą zmienną albo rzuca błędem, który mówi **co** uzupełnić
 * i **gdzie** to znaleźć. Wartość z `.env.example` (`sk_test_UZUPELNIJ`)
 * traktujemy jak brak — inaczej próbka wystartowałaby z placeholderem
 * i padła dopiero przy pierwszym wywołaniu API.
 */
function wymagana(nazwa: string, skad: string): string {
  const wartosc = process.env[nazwa]?.trim();

  if (!wartosc || wartosc.endsWith('UZUPELNIJ')) {
    throw new BladKonfiguracji(
      `Brakuje zmiennej ${nazwa}.\n` +
        `  Skąd ją wziąć: ${skad}\n` +
        `  Gdzie wpisać:  samples/stripe-connect/.env (wzór w .env.example)`
    );
  }

  return wartosc;
}

/** Zwraca zmienną opcjonalną albo `null`, gdy jej nie ma lub jest placeholderem. */
function opcjonalna(nazwa: string): string | null {
  const wartosc = process.env[nazwa]?.trim();
  if (!wartosc || wartosc.endsWith('UZUPELNIJ')) return null;
  return wartosc;
}

/** Liczba z zakresu albo błąd konfiguracji. Bez cichego `?? wartość domyślna`. */
function liczbaZZakresu(nazwa: string, domyslna: number, min: number, max: number): number {
  const surowa = process.env[nazwa]?.trim();
  if (!surowa) return domyslna;

  const liczba = Number(surowa);
  if (!Number.isFinite(liczba) || liczba < min || liczba > max) {
    throw new BladKonfiguracji(
      `Zmienna ${nazwa} ma wartość "${surowa}", a musi być liczbą z zakresu ${min}–${max}.`
    );
  }

  return liczba;
}

export interface KonfiguracjaProbki {
  /** Klucz tajny platformy. Wymagany — bez niego nie ma o czym rozmawiać. */
  stripeSecretKey: string;
  /**
   * Sekret podpisu webhooka. `null` oznacza, że trasa `/webhooks/stripe`
   * odpowiada 501 zamiast udawać, że weryfikuje podpis. Reszta próbki działa.
   */
  stripeWebhookSecret: string | null;
  port: number;
  /** Adres, pod który Stripe odsyła użytkownika po onboardingu i po zapłacie. */
  baseUrl: string;
  platformFeePercent: number;
  connectedAccountCountry: string;
  defaultCurrency: string;
}

let zbuforowana: KonfiguracjaProbki | null = null;

export function wczytajKonfiguracje(): KonfiguracjaProbki {
  if (zbuforowana) return zbuforowana;

  zbuforowana = {
    stripeSecretKey: wymagana(
      'STRIPE_SECRET_KEY',
      'Dashboard Stripe → Developers → API keys → "Secret key" (tryb testowy, `sk_test_...`)'
    ),
    stripeWebhookSecret: opcjonalna('STRIPE_WEBHOOK_SECRET'),
    port: liczbaZZakresu('PORT', 4242, 1, 65535),
    baseUrl: (process.env.SAMPLE_BASE_URL?.trim() || 'http://localhost:4242').replace(/\/$/, ''),
    platformFeePercent: liczbaZZakresu('PLATFORM_FEE_PERCENT', 10, 0, 100),
    connectedAccountCountry: (process.env.CONNECTED_ACCOUNT_COUNTRY?.trim() || 'us').toLowerCase(),
    defaultCurrency: (process.env.DEFAULT_CURRENCY?.trim() || 'usd').toLowerCase(),
  };

  return zbuforowana;
}
