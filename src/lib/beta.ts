export const FREE_BETA_ACTIVE = true as const;
export const FREE_BETA_PRICE_PLN = 0 as const;

export const FREE_BETA_LABEL = 'Bezpłatna beta' as const;

/**
 * Zakupy są świadomie wyłączone w becie. Zmiana modelu komercyjnego wymaga
 * osobnej decyzji produktowej i zmiany tej flagi razem z cennikiem, checkoutem
 * oraz testami odbiorowymi. Nie sterujemy tym sekretną zmienną środowiskową,
 * żeby przypadkowo skonfigurowany Stripe nie uruchomił sprzedaży.
 */
export const BETA_PURCHASES_ENABLED = false as const;
