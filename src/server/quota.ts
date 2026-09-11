import { FREE_BETA_ACTIVE } from '../lib/beta';
import { getSupabase } from './supabase';

/**
 * Limity liczone po stronie serwera.
 *
 * To jest miejsce, w którym zapada decyzja o wydaniu pieniędzy właściciela
 * projektu na wywołanie modelu. Licznik w przeglądarce (`useEntitlements`) jest
 * wyłącznie podpowiedzią dla interfejsu — leży w `localStorage` i użytkownik
 * może go sobie przestawić z konsoli. Tutaj źródłem prawdy są tabele
 * `subscriptions` i `usage_counters`, do których nie ma prawa zapisu.
 */

export type QuotaKind = 'ai' | 'import';

/**
 * Dzienny sufit wywołań AI. Jedyna definicja w kodzie — czyta ją zarówno
 * egzekucja (`executeAiOperation`), jak i podgląd pozostałych sztuk
 * (`getEntitlements`). Rozdzielenie tych dwóch wartości sprawiłoby, że
 * interfejs pokazywałby inny limit niż ten, który faktycznie odsyła żądanie.
 */
export const FREE_DAILY_AI_USES = 5;
export const PRO_DAILY_AI_USES = 100;

export class QuotaExceededError extends Error {
  readonly status = 402;
  /** `errorHandler` przepuszcza treść do klienta tylko przy `expose === true`. */
  readonly expose = true;

  constructor(kind: QuotaKind) {
    super(
      kind === 'ai'
        ? 'Wyczerpane dzisiejsze wywołania AI. Limit odnowi się o północy.'
        : 'Wyczerpano darmowe importy pliku w tym miesiącu.'
    );
    this.name = 'QuotaExceededError';
  }
}

/**
 * Pobiera jedną jednostkę limitu albo rzuca `QuotaExceededError`.
 *
 * Sprawdzenie i pobranie dzieje się w jednym poleceniu SQL (`consume_quota`),
 * więc dwie równolegle otwarte karty nie mogą obie zużyć ostatniego kredytu.
 * Rozbicie tego na "odczytaj ile zostało" i "odejmij jeden" po stronie
 * aplikacji dawałoby dokładnie taki wyścig.
 */
export async function consumeQuota(userId: string, kind: QuotaKind): Promise<void> {
  const { data, error } = await getSupabase().rpc('consume_quota', {
    p_user: userId,
    p_kind: kind,
  });

  if (error) {
    throw new Error(`Nie udało się sprawdzić limitu (${kind}): ${error.message}`);
  }

  if (data !== true) {
    throw new QuotaExceededError(kind);
  }
}

export interface RemainingQuota {
  /** Pozostałe **dzisiejsze** wywołania AI — tyle, ile realnie egzekwuje rezerwacja. */
  aiUses: number;
  /** Pozostałe importy pliku w tym miesiącu (liczone w interfejsie, patrz niżej). */
  importUses: number;
  monthKey: string;
  /** Klucz doby dla licznika AI — klient resetuje podpowiedź razem z serwerem. */
  dayKey: string;
}

export interface Entitlements {
  subscription: {
    status: 'free' | 'trialing' | 'active' | 'cancelled' | 'past_due';
    sku?: string;
    currentPeriodEnd?: string;
  };
  usage: RemainingQuota;
}

const monthKey = () => new Date().toISOString().slice(0, 7);
const dayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Czy konto ma opłacony plan cykliczny.
 *
 * Ta informacja pozostaje w bazie jako historia rozliczeń, ale w bezpłatnej
 * becie nie daje wyższego limitu ani dostępu do funkcji poza zakresem.
 */
async function isPaidAccount(userId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Nie udało się sprawdzić statusu subskrypcji: ${error.message}`);
  }

  const status = data?.status ?? 'free';
  return status === 'active' || status === 'trialing';
}

/**
 * Zwraca stan uprawnień do pokazania w interfejsie: status subskrypcji oraz
 * **pozostałe** (nie zużyte) limity, bo to jest liczba, którą użytkownik chce
 * zobaczyć. W bezpłatnej becie historyczny status płatny nie omija limitów.
 */
export async function getEntitlements(userId: string): Promise<Entitlements> {
  const supabase = getSupabase();
  const currentMonth = monthKey();
  const today = dayKey();

  const [subscriptionResult, counterResult, freePlanResult, dailyQuotaResult] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('status, plan_id, current_period_end')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('usage_counters')
      .select('ai_uses, import_uses')
      .eq('user_id', userId)
      .eq('month_key', currentMonth)
      .maybeSingle(),
    supabase.from('plans').select('ai_quota, import_quota').eq('id', 'free').maybeSingle(),
    // Rejestr dobowy jest źródłem prawdy o AI: to jego czyta `reserve_ai_quota`
    // przy każdym żądaniu. Licznik miesięczny z `usage_counters` niczego nie
    // egzekwuje, więc pokazywanie „pozostałych” z niego byłoby liczbą znikąd.
    supabase
      .from('user_quotas')
      .select('ai_uses_count, daily_reset_date')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const status = (subscriptionResult.data?.status ?? 'free') as Entitlements['subscription']['status'];
  const isPaid = !FREE_BETA_ACTIVE && (status === 'active' || status === 'trialing');

  // Limity planu darmowego czytamy z bazy, a nie ze stałej w kodzie — inaczej
  // zmiana cennika wymagałaby wdrożenia nowej wersji aplikacji.
  const importQuota = freePlanResult.data?.import_quota ?? 0;

  const usedImports = counterResult.data?.import_uses ?? 0;

  // Licznik z poprzedniej doby nie znaczy „zużyte dziś” — rezerwa resetuje
  // się w `reserve_ai_quota`, tutaj czytamy tylko ten sam dzień.
  const usedTodayAi =
    dailyQuotaResult.data && dailyQuotaResult.data.daily_reset_date === today
      ? (dailyQuotaResult.data.ai_uses_count ?? 0)
      : 0;

  return {
    subscription: {
      status,
      sku: subscriptionResult.data?.plan_id ?? undefined,
      currentPeriodEnd: subscriptionResult.data?.current_period_end ?? undefined,
    },
    usage: {
      aiUses: isPaid
        ? Number.MAX_SAFE_INTEGER
        : Math.max(0, FREE_DAILY_AI_USES - usedTodayAi),
      importUses: isPaid ? Number.MAX_SAFE_INTEGER : Math.max(0, importQuota - usedImports),
      monthKey: currentMonth,
      dayKey: today,
    },
  };
}

export interface AiTaskResult<T> {
  data: T;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    model: string;
    calculatedCost?: number | null;
  };
}

/**
 * Rezerwuje atomowo 1 wywołanie AI z użyciem blokady pesymistycznej w bazie PostgreSQL (SELECT FOR UPDATE).
 */
export async function reserveAiQuota(userId: string, maxDailyUses: number): Promise<{ allowed: boolean; current_uses?: number }> {
  const { data, error } = await getSupabase().rpc('reserve_ai_quota', {
    p_user_id: userId,
    p_max_daily_uses: maxDailyUses,
  });

  if (error) {
    throw new Error(`Nie udało się zarezerwować limitu AI: ${error.message}`);
  }

  return (data as { allowed: boolean; current_uses?: number }) ?? { allowed: false };
}

/**
 * Zwrot zarezerwowanego limitu AI w przypadku awarii wykonania operacji LLM.
 */
export async function refundAiQuota(userId: string): Promise<void> {
  const { error } = await getSupabase().rpc('refund_ai_quota', {
    p_user_id: userId,
  });

  if (error) {
    console.warn(`[quota] Nie udało się zwrócić limitu AI dla użytkownika ${userId}:`, error.message);
  }
}

/**
 * Wykonuje potok wywołania AI z pre-flight rezerwacją pesymistyczną,
 * wykonaniem zadania LLM, księgowaniem tokenów i automatyczną refundacją w razie awarii.
 *
 * Poza betą limit może wynikać ze statusu subskrypcji. W bezpłatnej becie
 * wszyscy użytkownicy mają ten sam serwerowy sufit, również konta ze starym
 * statusem `active` lub `trialing`.
 */
export async function executeAiOperation<T>(
  userId: string,
  context: string,
  runAiTask: () => Promise<AiTaskResult<T>>
): Promise<T> {
  const paid = !FREE_BETA_ACTIVE && await isPaidAccount(userId);
  const maxUses = paid ? PRO_DAILY_AI_USES : FREE_DAILY_AI_USES;

  const reservation = await reserveAiQuota(userId, maxUses);
  if (!reservation.allowed) {
    throw new QuotaExceededError('ai');
  }

  try {
    const result = await runAiTask();

    if (result.usage) {
      const { recordUsage } = await import('./usageLedger');
      recordUsage({
        userId,
        context,
        model: result.usage.model,
        promptTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
      });
    }

    return result.data;
  } catch (error) {
    await refundAiQuota(userId);
    throw error;
  }
}
