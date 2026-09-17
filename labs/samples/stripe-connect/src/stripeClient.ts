/**
 * Jeden `StripeClient` na cały proces.
 *
 * Wszystkie wywołania Stripe'a w tej próbce idą przez `stripe()` — nigdzie nie
 * tworzymy drugiej instancji. To ta sama zasada, co w `src/server/stripeClient.ts`
 * aplikacji, i ma ten sam powód: klient trzyma konfigurację (klucz, wersję API,
 * ponawianie, telemetrię), więc druga instancja to druga, cicho rozjeżdżająca
 * się konfiguracja.
 *
 * **Wersji API nie ustawiamy.** SDK w wersji 22.6.0 przypina wersję, pod którą
 * został wygenerowany (włącznie z podglądową `2026-08-26.dahlia` dla API V2).
 * Wpisanie jej ręcznie oznaczałoby, że przy aktualizacji pakietu typy i kod
 * mówią co innego niż nagłówek żądania.
 *
 * Klient jest tworzony leniwie: dzięki temu błąd konfiguracji pojawia się przy
 * pierwszym użyciu z pełnym komunikatem z `config.ts`, a nie jako wyjątek
 * w trakcie ładowania modułu, gdy nie ma jeszcze gdzie go pokazać.
 */

import Stripe from 'stripe';
import { wczytajKonfiguracje } from './config';

let zbuforowany: Stripe | null = null;

export function stripe(): Stripe {
  if (zbuforowany) return zbuforowany;

  const konfiguracja = wczytajKonfiguracje();

  zbuforowany = new Stripe(konfiguracja.stripeSecretKey, {
    // Widoczne w logach Dashboardu przy każdym żądaniu. Przy diagnozie od razu
    // wiadomo, że ruch pochodzi z próbki, a nie z produkcyjnego CVelocity.
    appInfo: {
      name: 'CVelocity — próbka Stripe Connect',
      version: '0.0.0',
    },
  });

  return zbuforowany;
}
