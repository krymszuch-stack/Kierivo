/**
 * Magazyn sprzedawców — mapowanie „użytkownik w mojej aplikacji" → „konto
 * połączone w Stripie".
 *
 * **Co tu trzymamy, a czego nie**
 *
 * Trzymamy wyłącznie to, czego Stripe nie wie: kim jest u nas sprzedawca
 * i które konto do niego należy. Tego nie da się odtworzyć z API — konto
 * połączone nie zna naszych identyfikatorów.
 *
 * **Nie** trzymamy statusu onboardingu ani uprawnień konta. Te pobieramy
 * przy każdym wyświetleniu z `v2.core.accounts.retrieve` — patrz
 * `routes/accounts.routes.ts`. Zapisany status rozjeżdża się z prawdą
 * w momencie, w którym Stripe zmieni wymagania, a użytkownik zobaczy wtedy
 * „gotowe" przy koncie, które od wczoraj nie może przyjmować wypłat.
 *
 * **Dlaczego plik JSON, a nie baza**
 *
 * Próbka ma działać po `npm install` i `npm run dev`, bez stawiania Postgresa.
 * W prawdziwej aplikacji to jest jedna kolumna `stripe_account_id` przy
 * użytkowniku — CVelocity ma do tego Supabase i tabelę `profiles`.
 * Kształt interfejsu poniżej jest celowo taki, żeby podmiana implementacji
 * na zapytania do bazy nie ruszała żadnej trasy.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KATALOG_DANYCH = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.dane');
const PLIK = resolve(KATALOG_DANYCH, 'sprzedawcy.json');

export interface Sprzedawca {
  /** Identyfikator po naszej stronie. W prawdziwej aplikacji: id użytkownika. */
  id: string;
  displayName: string;
  contactEmail: string;
  /** Identyfikator konta połączonego (`acct_...`). */
  stripeAccountId: string;
  /** Kiedy konto powstało po naszej stronie — do posortowania listy. */
  createdAt: string;
}

/**
 * Czyta cały plik przy każdym wywołaniu.
 *
 * Przy kilkunastu rekordach próbki to jest tańsze niż utrzymywanie bufora
 * spójnego z dyskiem, a przy okazji odporne na `tsx watch`, który przeładowuje
 * moduł i wyzerowałby stan trzymany w pamięci.
 */
function wczytaj(): Sprzedawca[] {
  try {
    const surowe = readFileSync(PLIK, 'utf8');
    const dane: unknown = JSON.parse(surowe);
    return Array.isArray(dane) ? (dane as Sprzedawca[]) : [];
  } catch {
    // Brak pliku = brak sprzedawców. Pusta lista, nie dane przykładowe:
    // wymyślone rekordy startowe to reguła 1 z AGENTS.md i najkrótsza droga do
    // demonstracji, w której nie wiadomo, co jest prawdziwe.
    return [];
  }
}

function zapisz(sprzedawcy: Sprzedawca[]): void {
  mkdirSync(KATALOG_DANYCH, { recursive: true });
  writeFileSync(PLIK, JSON.stringify(sprzedawcy, null, 2), 'utf8');
}

/** Wszyscy sprzedawcy, od najnowszego. */
export function wszyscySprzedawcy(): Sprzedawca[] {
  return wczytaj().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function znajdzSprzedawce(stripeAccountId: string): Sprzedawca | null {
  return wczytaj().find((s) => s.stripeAccountId === stripeAccountId) ?? null;
}

/**
 * Dopisuje sprzedawcę. Konto połączone jest już wtedy utworzone w Stripie —
 * zapis lokalny jest ostatnim krokiem, żeby nie powstał wpis wskazujący na
 * konto, którego tworzenie się nie powiodło.
 */
export function dodajSprzedawce(dane: Omit<Sprzedawca, 'id' | 'createdAt'>): Sprzedawca {
  const sprzedawcy = wczytaj();

  const sprzedawca: Sprzedawca = {
    ...dane,
    id: `user_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  };

  sprzedawcy.push(sprzedawca);
  zapisz(sprzedawcy);

  return sprzedawca;
}
