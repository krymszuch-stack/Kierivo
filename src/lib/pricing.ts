/**
 * Katalog płatny — **jedyne** miejsce w kodzie, w którym żyją identyfikatory
 * cen i to, co dany zakup odblokowuje.
 *
 * Powód wprost z reguły 3: identyfikatory były wcześniej sklejane w widoku
 * (`price_cvelocity_template_${nazwa.toLowerCase()}`), więc zmiana nazwy
 * szablonu po cichu tworzyła cenę, której nie ma ani w Stripe, ani w tabeli
 * `plans`. Klient wysyła stąd wyłącznie klucz; cena i tak jest weryfikowana
 * po stronie serwera w `billing.routes.ts` na podstawie tabeli `plans`.
 *
 * Identyfikatory są celowo czytelne (`pro_monthly`, a nie `price_1Abc...`) —
 * są to `lookup_key` w Stripe, więc te same wartości działają w środowisku
 * testowym i produkcyjnym.
 */

/** Identyfikator szablonu CV, którego dotyczy zakup jednorazowy. */
export type PremiumTemplateId = 'executive' | 'creative';

export interface CatalogEntry {
  /** `lookup_key` ceny w Stripe. Klucz wyszukiwania w tabeli `plans`. */
  priceId: string;
  /** Identyfikator planu w tabeli `plans`. */
  planId: string;
  title: string;
  /** Cena brutto w groszach — do wyświetlenia, nie do rozliczenia. */
  grossAmount: number;
  recurring: boolean;
  /** Szablony, które ten zakup odblokowuje dożywotnio na koncie. */
  templates: readonly PremiumTemplateId[];
  trialDays?: number;
}

export const PRO_MONTHLY: CatalogEntry = {
  priceId: 'pro_monthly',
  planId: 'pro',
  title: 'Kierivo Pro (miesięcznie)',
  grossAmount: 4900,
  recurring: true,
  // Pro zawiera wszystkie szablony premium — decyzja właściciela produktu.
  templates: ['executive', 'creative'],
  trialDays: 30,
};

export const PRO_YEARLY: CatalogEntry = {
  priceId: 'pro_yearly',
  planId: 'pro_rok',
  title: 'Kierivo Pro (rocznie)',
  grossAmount: 46800,
  recurring: true,
  templates: ['executive', 'creative'],
};

export const TEMPLATE_EXECUTIVE: CatalogEntry = {
  priceId: 'template_executive_onetime',
  planId: 'szablon_executive',
  title: 'Szablon Executive A4',
  grossAmount: 1900,
  recurring: false,
  templates: ['executive'],
};

export const TEMPLATE_CREATIVE: CatalogEntry = {
  priceId: 'template_creative_onetime',
  planId: 'szablon_creative',
  title: 'Szablon Creative A4',
  grossAmount: 1900,
  recurring: false,
  templates: ['creative'],
};

export const TEMPLATE_PACK: CatalogEntry = {
  priceId: 'template_pack_5_onetime',
  planId: 'pakiet_szablonow',
  title: 'Pakiet szablonów premium',
  grossAmount: 7900,
  recurring: false,
  templates: ['executive', 'creative'],
};

export const CATALOG: readonly CatalogEntry[] = [
  PRO_MONTHLY,
  PRO_YEARLY,
  TEMPLATE_EXECUTIVE,
  TEMPLATE_CREATIVE,
  TEMPLATE_PACK,
];

/** Wpis katalogu dla danej ceny albo `null`, gdy klucz jest nieznany. */
export function catalogEntryForPrice(priceId: string): CatalogEntry | null {
  return CATALOG.find((entry) => entry.priceId === priceId) ?? null;
}

/** Szablony odblokowane jednorazowym zakupem danej ceny. */
export function templatesUnlockedByPrice(priceId: string): readonly PremiumTemplateId[] {
  return catalogEntryForPrice(priceId)?.templates ?? [];
}

/** Wyświetlana cena brutto w złotych, np. „49 zł”. */
export function formatGross(amountInMinorUnits: number): string {
  const zloty = amountInMinorUnits / 100;
  return Number.isInteger(zloty) ? `${zloty} zł` : `${zloty.toFixed(2).replace('.', ',')} zł`;
}

/** `lookup_key` ceny dla identyfikatora planu z tabeli `plans`. */
export function priceIdForPlan(planId: string | null): string | null {
  if (!planId) return null;
  return CATALOG.find((entry) => entry.planId === planId)?.priceId ?? null;
}
