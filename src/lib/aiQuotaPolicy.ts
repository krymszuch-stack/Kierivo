/** Wspolna polityka dobowa uzywana przez serwer, schowek UI i komunikaty. */
export const FREE_DAILY_AI_USES = 25;
export const AI_QUOTA_RESET_TIME = '00:00 UTC';

/** Klucz dnia licznika zgodny z ISO i domyslna strefa UTC w Supabase. */
export function getAiQuotaDayKeyUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
