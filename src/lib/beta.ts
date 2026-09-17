/**
 * Główny feature flag sterujący płatnościami, checkoutem i subskrypcjami w całej aplikacji.
 *
 * Gdy PAYMENTS_ENABLED = false:
 *  - Płatności, checkout i komercyjne subskrypcje są globalnie zablokowane.
 *  - Serwer odrzuca próby utworzenia sesji checkoutu (501).
 *  - Interfejs ukrywa niedostępne plany komercyjne i prezentuje neutralny komunikat
 *    o fazie Public Pre-Beta (bezpłatny dostęp testowy 0 zł).
 *
 * Zmiana modelu komercyjnego wymaga osobnej decyzji produktowej i jawnego przestawienia
 * tej flagi. Nie sterujemy tym zmienną środowiskową, żeby przypadkowo skonfigurowany
 * Stripe nie uruchomił sprzedaży bez decyzji zespołu.
 */
export const PAYMENTS_ENABLED = false as const;

/** Alias wsteczny dla zachowania kompatybilności z dotychczasowymi modułami i testami. */
export const BETA_PURCHASES_ENABLED = PAYMENTS_ENABLED;

export const FREE_BETA_ACTIVE = (!PAYMENTS_ENABLED) as true;
export const FREE_BETA_PRICE_PLN = 0 as const;

export const FREE_BETA_LABEL = 'Bezpłatna beta' as const;

/**
 * Publiczne oznaczenie wydania. Kod nie sugeruje procentu ukończenia produktu;
 * pozwala natomiast jednoznacznie rozpoznać wersję pokazywaną testerom i na
 * materiałach zewnętrznych.
 */
export const PUBLIC_PREBETA_LABEL = 'Public Pre-Beta' as const;
export const PUBLIC_PREBETA_CODE = 'PB-2026.09' as const;
export const PUBLIC_PREBETA_MESSAGE = 'Otwarte testy · premiera wkrótce' as const;

