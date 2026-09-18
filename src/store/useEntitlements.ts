import { useCallback, useEffect, useState } from 'react';
import { StorageKeys, onAppStorageWiped, readJson, writeJson } from '../lib/storage';
import { clientEnv } from '../lib/clientEnv';
import { ApiError, api } from '../lib/apiClient';
import { FREE_BETA_ACTIVE } from '../lib/beta';

/**
 * Uprawnienia i pozostałe limity — **wyłącznie na potrzeby interfejsu**.
 *
 * To jest podpowiedź dla ekranu, a nie kontrola dostępu. Wartości leżą
 * w `localStorage`, więc użytkownik może je sobie przestawić z konsoli
 * przeglądarki. Nic z tego nie wynika: realne limity sprawdza serwer.
 *
 * Podczas bezpłatnej bety historyczne statusy Pro/Karnet są zachowywane jako
 * dane konta, ale nie odblokowują funkcji ani nie omijają limitów.
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
  /** Historyczny Karnet Aplikacyjny (`profiles.plan_expires_at` w przyszłości). */
  hasActivePass: boolean;
  /** `server` znaczy: te liczby przyszły z `/api/me`; `unauthenticated` znaczy: brak aktywnej sesji użytkownika. */
  source: 'local' | 'server' | 'unauthenticated';
  isAuthenticated?: boolean;
}

const FREE_IMPORTS = 1;
const FREE_AI_USES = 25;

export const FREE_MONTHLY_IMPORTS = FREE_IMPORTS;
export const FREE_DAILY_AI_USES = FREE_AI_USES;

const getMonthKey = () => new Date().toISOString().slice(0, 7);
const getDayKey = () => new Date().toISOString().slice(0, 10);

export function unauthenticatedState(): EntitlementsState {
  return {
    subscription: { status: 'free' },
    usage: {
      importUses: 0,
      aiUses: 0,
      monthKey: getMonthKey(),
      dayKey: getDayKey(),
    },
    hasActivePass: false,
    source: 'unauthenticated',
    isAuthenticated: false,
  };
}


function loadInitialState(): EntitlementsState {
  const saved = readJson<Partial<EntitlementsState> | null>(StorageKeys.entitlementsCache, null);
  if (!saved || typeof saved !== 'object' || saved.source === 'unauthenticated' || saved.isAuthenticated === false) {
    return unauthenticatedState();
  }
  if (!saved.usage || !saved.subscription || !saved.subscription.status) {
    return unauthenticatedState();
  }

  let usage = saved.usage;
  if (!usage.monthKey || usage.monthKey !== getMonthKey()) {
    usage = { ...usage, importUses: FREE_IMPORTS, monthKey: getMonthKey() };
  }
  if (!usage.dayKey || usage.dayKey !== getDayKey()) {
    const paidOutsideBeta = !FREE_BETA_ACTIVE && isProStatus(saved.subscription?.status);
    usage = {
      ...usage,
      aiUses: paidOutsideBeta ? Number.MAX_SAFE_INTEGER : FREE_AI_USES,
      dayKey: getDayKey(),
    };
  }

  return {
    subscription: saved.subscription || { status: 'free' },
    usage,
    hasActivePass: saved.hasActivePass === true,
    source: saved.source === 'server' ? 'server' : 'local',
    isAuthenticated: true,
  };
}

let globalState: EntitlementsState = loadInitialState();
const listeners = new Set<() => void>();

function setState(updater: (prev: EntitlementsState) => EntitlementsState): void {
  globalState = updater(globalState);
  writeJson(StorageKeys.entitlementsCache, globalState);
  listeners.forEach((notify) => notify());
}

/**
 * Resetuje stan limitów i uprawnień do stanu niezalogowanego.
 * Usuwa odziedziczone wartości z poprzedniej sesji.
 */
export function resetEntitlementsToUnauthenticated(): void {
  setState(() => unauthenticatedState());
}

export function getEntitlementsState(): EntitlementsState {
  return globalState;
}

/**
 * Ustawia stan uprawnień dla zalogowanego użytkownika (np. po refresh z /api/me lub w testach).
 */
export function setAuthenticatedEntitlements(
  subscription: Subscription = { status: 'free' },
  usage?: Partial<Usage>
): void {
  setState(() => ({
    subscription,
    usage: {
      importUses: usage?.importUses ?? FREE_IMPORTS,
      aiUses: usage?.aiUses ?? FREE_AI_USES,
      monthKey: usage?.monthKey ?? getMonthKey(),
      dayKey: usage?.dayKey ?? getDayKey(),
    },
    hasActivePass: false,
    source: 'server',
    isAuthenticated: true,
  }));
}

onAppStorageWiped(() => {
  globalState = unauthenticatedState();
  listeners.forEach((notify) => notify());
});

/**
 * Semantyka historycznego statusu subskrypcji. To nie znaczy, że status daje
 * dostęp w aktualnej becie — faktyczny `isPro` jest niżej bramkowany flagą bety.
 */
export function isProStatus(status?: SubscriptionStatus | string | null): boolean {
  return status === 'active' || status === 'trialing';
}

interface MeResponse {
  subscription: Subscription;
  usage: Usage;
  hasActivePass?: boolean;
}

function consumeLocal(kind: 'ai' | 'import'): boolean {
  // Niezalogowany użytkownik nie może lokalnie zużywać ani rezerwować analiz
  if (globalState.source === 'unauthenticated' || globalState.isAuthenticated === false) {
    return false;
  }

  if (!FREE_BETA_ACTIVE && isProStatus(globalState?.subscription?.status)) return true;

  const field = kind === 'ai' ? 'aiUses' : 'importUses';
  if (!globalState?.usage || typeof globalState.usage[field] !== 'number' || globalState.usage[field] <= 0) return false;

  setState((prev) => ({ ...prev, usage: { ...prev.usage, [field]: prev.usage[field] - 1 } }));
  return true;
}

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
          hasActivePass: me.hasActivePass === true,
          source: 'server',
          isAuthenticated: true,
        }));
      }
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        resetEntitlementsToUnauthenticated();
        return;
      }
    }
  }, []);

  const isPro = !FREE_BETA_ACTIVE && isProStatus(state?.subscription?.status);

  const consumeAi = useCallback(() => consumeLocal('ai'), []);
  const consumeImport = useCallback(() => consumeLocal('import'), []);

  const grantDemoPro = useCallback(() => {
    if (FREE_BETA_ACTIVE || !import.meta.env.DEV) return;
    setState((prev) => ({ ...prev, subscription: { status: 'active' }, source: 'local', isAuthenticated: true }));
  }, []);

  return {
    subscription: state?.subscription || { status: 'free' },
    usage: state?.usage || {
      importUses: 0,
      aiUses: 0,
      monthKey: getMonthKey(),
      dayKey: getDayKey(),
    },
    source: state?.source || 'unauthenticated',
    isAuthenticated: state?.isAuthenticated ?? (state?.source !== 'unauthenticated'),
    isPro,
    hasActivePass: !FREE_BETA_ACTIVE && state?.hasActivePass === true,
    refresh,
    consumeAi,
    consumeImport,
    grantDemoPro,
  };
}
