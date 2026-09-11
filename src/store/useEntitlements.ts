import { useCallback, useEffect, useState } from 'react';
import { StorageKeys, onAppStorageWiped, readJson, writeJson } from '../lib/storage';
import { clientEnv } from '../lib/clientEnv';
import { ApiError, api } from '../lib/apiClient';
import { IS_BETA } from '../lib/betaConfig';

/**
 * Uprawnienia i pozostałe limity — **wyłącznie na potrzeby interfejsu**.
 *
 * To jest podpowiedź dla ekranu, a nie kontrola dostępu. Wartości leżą
 * w `localStorage`, więc użytkownik może je sobie przestawić z konsoli
 * przeglądarki i zobaczyć etykietę „Pro". Nic z tego nie wynika: realne
 * uprawnienie sprawdza serwer przy każdym wywołaniu, w `src/server/quota.ts`,
 * na podstawie tabel `subscriptions` i `user_quotas`, których użytkownik nie
 * może zapisać (polityki RLS w `supabase/migrations/0001_init.sql`).
 *
 * Ten podział jest celowy. Licznik w interfejsie musi odpowiadać natychmiast,
 * bez czekania na sieć; decyzja o wydaniu cudzych pieniędzy na wywołanie modelu
 * musi zapaść po stronie serwera. Poprzednia wersja miała wyłącznie tę pierwszą
 * połowę i nazywała ją kontrolą dostępu.
 */

export type SubscriptionStatus = 'free' | 'trialing' | 'active' | 'cancelled' | 'past_due';

export interface Subscription {
  status: SubscriptionStatus;
  sku?: string;
  currentPeriodEnd?: string;
}

export interface Usage {
  /** Pozostałe importy pliku w tym miesiącu. */
  importUses: number;
  /** Pozostałe **dzisiejsze** wywołania AI — dobowa rezerwa to to, co serwer faktycznie egzekwuje. */
  aiUses: number;
  monthKey: string;
  /** Klucz doby licznika AI; zmiana znaczy „północy za nami, serwer już odliczył od nowa”. */
  dayKey: string;
}

export interface EntitlementsState {
  subscription: Subscription;
  usage: Usage;
  /** Karnet Aplikacyjny aktywny (`profiles.plan_expires_at` w przyszłości). */
  hasActivePass: boolean;
  /** `server` znaczy: te liczby przyszły z `/api/me` i są prawdziwe. */
  source: 'local' | 'server';
}

// Te same liczby, które trzyma plan `free` w bazie (`plans.import_quota`,
// `FREE_DAILY_AI_USES` po stronie serwera). Podpowiedź startowa nie może być
// hojniejsza niż realny limit — rozjazd 10 kontra 1 obiecał w interfejsie
// dziewięć importów, których nigdy nie było.
const FREE_IMPORTS = 1;
const FREE_AI_USES = 5;

/**
 * Jedno źródło prawdy o darmowym limicie dla tekstów interfejsu (cennik,
 * parser, ekran startowy). Wcześniej każda z tych kopii trzymała własną liczbę
 * i rozjechała się z realnym limitem egzekwowanym tutaj.
 */
export const FREE_MONTHLY_IMPORTS = FREE_IMPORTS;
export const FREE_DAILY_AI_USES = FREE_AI_USES;

const getMonthKey = () => new Date().toISOString().slice(0, 7);
const getDayKey = () => new Date().toISOString().slice(0, 10);

function freshState(): EntitlementsState {
  return {
    subscription: { status: 'free' },
    usage: {
      importUses: FREE_IMPORTS,
      aiUses: FREE_AI_USES,
      monthKey: getMonthKey(),
      dayKey: getDayKey(),
    },
    // W bezpłatnej wersji beta podstawowy przepływ testera jest odblokowany bez płatnego karnetu.
    hasActivePass: IS_BETA,
    source: 'local',
  };
}

function loadInitialState(): EntitlementsState {
  const saved = readJson<Partial<EntitlementsState> | null>(StorageKeys.entitlementsCache, null);
  if (!saved || typeof saved !== 'object' || !saved.usage || !saved.subscription || !saved.subscription.status) {
    return freshState();
  }

  // Serwer zeruje miesiąc po `date_trunc('month', now())`, a dobę po dacie UTC.
  // Tutaj te same klucze pilnują tylko tego, żeby podpowiedź nie pokazywała
  // zużytych sztuk do czasu pierwszej odpowiedzi z API po zmianie doby.
  let usage = saved.usage;
  if (!usage.monthKey || usage.monthKey !== getMonthKey()) {
    usage = { ...usage, importUses: FREE_IMPORTS, monthKey: getMonthKey() };
  }
  if (!usage.dayKey || usage.dayKey !== getDayKey()) {
    // Plan opłacony nie ma dobowego sufitu — serwer zwraca wtedy MAX_SAFE_INTEGER.
    const paid = isProStatus(saved.subscription?.status);
    usage = {
      ...usage,
      aiUses: paid ? Number.MAX_SAFE_INTEGER : FREE_AI_USES,
      dayKey: getDayKey(),
    };
  }

  // W bezpłatnej wersji beta podstawowy przepływ testera pozostaje aktywny.
  return {
    subscription: saved.subscription || { status: 'free' },
    usage,
    hasActivePass: true,
    source: saved.source === 'server' ? 'server' : 'local',
  };
}

let globalState: EntitlementsState = loadInitialState();
const listeners = new Set<() => void>();

function setState(updater: (prev: EntitlementsState) => EntitlementsState): void {
  globalState = updater(globalState);
  writeJson(StorageKeys.entitlementsCache, globalState);
  listeners.forEach((notify) => notify());
}

// Po „usuń moje dane" licznik wraca do stanu wyjściowego w pamięci, ale bez
// natychmiastowego zapisu — klucz właśnie zniknął ze schowka, a odtworzenie go
// tuż po wymazaniu byłoby pisaniem danej osobowej w tej samej operacji, która
// miała ją usunąć. Zapis wróci dopiero przy realnej akcji użytkownika.
export function resetEntitlementsForTesting(): void {
  globalState = freshState();
  listeners.forEach((notify) => notify());
}

onAppStorageWiped(() => {
  resetEntitlementsForTesting();
});

export function isProStatus(status?: SubscriptionStatus | string | null): boolean {
  return status === 'active' || status === 'trialing';
}

/** Kształt odpowiedzi `GET /api/me` w części dotyczącej uprawnień. */
interface MeResponse {
  subscription: Subscription;
  usage: Usage;
  hasActivePass?: boolean;
}

function consumeLocal(kind: 'ai' | 'import'): boolean {
  if (isProStatus(globalState?.subscription?.status)) return true;

  const field = kind === 'ai' ? 'aiUses' : 'importUses';
  if (!globalState?.usage || typeof globalState.usage[field] !== 'number' || globalState.usage[field] <= 0) return false;

  setState((prev) => ({ ...prev, usage: { ...prev.usage, [field]: prev.usage[field] - 1 } }));
  return true;
}

/**
 * Wersje dla modułów bez Reacta (silniki w `src/lib/`, które same wysyłają
 * żądania AI). Ta sama logika co w hooku — dwie implementacje jednego
 * licznika rozjechałyby się przy pierwszej zmianie (reguła 3).
 */
export function consumeAiLocally(): boolean {
  return consumeLocal('ai');
}

export function useEntitlements() {
  const [state, setLocalState] = useState<EntitlementsState>(globalState);

  useEffect(() => {
    const listener = () => setLocalState(globalState);
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  /**
   * Pobiera prawdziwy stan z serwera. Wywoływane po zalogowaniu i po powrocie
   * z bramki płatności — status subskrypcji potwierdza webhook Stripe'a, a nie
   * to, że użytkownik wrócił pod adres z `?checkout=success`.
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (!clientEnv.backendConfigured) return;

    try {
      const me = await api.get<MeResponse>('/api/me');
      if (me && me.subscription) {
        setState(() => ({
          subscription: me.subscription,
          usage: me.usage || {
            importUses: FREE_IMPORTS,
            aiUses: FREE_AI_USES,
            monthKey: getMonthKey(),
            dayKey: getDayKey(),
          },
          hasActivePass: me.hasActivePass ?? true,
          source: 'server',
        }));
      }
    } catch (err) {
      // Niezalogowany użytkownik dostaje 401 i to jest normalny stan, nie awaria.
      if (err instanceof ApiError && err.isUnauthorized) {
        setState(() => freshState());
        return;
      }
      // Przy każdym innym błędzie zostajemy przy ostatnich znanych liczbach:
      // pokazanie „0 pozostałych" z powodu chwilowego problemu z siecią byłoby
      // gorsze niż lekko nieaktualny licznik.
    }
  }, []);

  const isPro = isProStatus(state?.subscription?.status);

  /**
   * Zmniejsza licznik pokazywany w interfejsie i mówi, czy warto w ogóle
   * wysyłać żądanie. `false` znaczy „pokaż cennik”, nie „odmów dostępu” —
   * odmawia serwer.
   */
  const consumeAi = useCallback(() => consumeLocal('ai'), []);
  const consumeImport = useCallback(() => consumeLocal('import'), []);

  /**
   * Odblokowanie na potrzeby pracy nad interfejsem, bez przechodzenia przez
   * bramkę płatności. Świadomie nie istnieje w buildzie produkcyjnym: wcześniej
   * przycisk „Symuluj natychmiastowe odblokowanie" pokazywał się każdemu, kto
   * wszedł na cennik bez skonfigurowanego klucza Stripe'a.
   */
  const grantDemoPro = useCallback(() => {
    if (!import.meta.env.DEV) return;
    setState((prev) => ({ ...prev, subscription: { status: 'active' }, source: 'local' }));
  }, []);

  return {
    subscription: state?.subscription || { status: 'free' },
    usage: state?.usage || {
      importUses: FREE_IMPORTS,
      aiUses: FREE_AI_USES,
      monthKey: getMonthKey(),
      dayKey: getDayKey(),
    },
    source: state?.source || 'local',
    isPro,
    // W bezpłatnej wersji beta podstawowy przepływ testera nie wymaga płatnego karnetu.
    hasActivePass: IS_BETA || state?.hasActivePass === true,
    refresh,
    consumeAi,
    consumeImport,
    grantDemoPro,
  };
}
