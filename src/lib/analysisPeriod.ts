import type { AtsCalculationTime } from '../types';

/** Rewizje i pomiary pochodzą z toISOString; nie przyjmujemy niejednoznacznych dat. */
export function parseAnalysisTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? timestamp : null;
}

/** Silnik stażu rozróżnia miesiące w lokalnym kalendarzu, nie dni ani pełne doby. */
export function getAnalysisMonth(now: Date): string | null {
  if (!Number.isFinite(now.getTime())) return null;
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getCalculationTimeFreshness(time: AtsCalculationTime | null | undefined, now = new Date()): 'current' | 'stale' | 'unknown' {
  const timestamp = parseAnalysisTimestamp(time?.calculatedAt);
  const month = time?.calculationMonth;
  const currentMonth = getAnalysisMonth(now);
  if (timestamp === null || !currentMonth || timestamp > now.getTime() ||
      typeof month !== 'string' || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || month > currentMonth ||
      getAnalysisMonth(new Date(timestamp)) !== month) return 'unknown';
  return month === currentMonth ? 'current' : 'stale';
}

/** Długie miesiące przekraczają zakres setTimeout; ograniczenie zapobiega pętli 1 ms. */
export function nextAnalysisMonthDelay(now: Date): number {
  const boundary = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.max(1, Math.min(2_147_483_647, boundary.getTime() - now.getTime()));
}
