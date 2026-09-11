import type { MonthIndex } from './contracts';

export function toMonthIndex(year: number, month1to12: number): MonthIndex {
  if (!Number.isInteger(year)) throw new Error('year musi być liczbą całkowitą');
  if (!Number.isInteger(month1to12) || month1to12 < 1 || month1to12 > 12) {
    throw new Error('month1to12 musi należeć do 1..12');
  }
  return year * 12 + (month1to12 - 1);
}

export function fromMonthIndex(index: MonthIndex): { year: number; month: number } {
  if (!Number.isInteger(index)) throw new Error('MonthIndex musi być liczbą całkowitą');
  const year = Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12 + 1;
  return { year, month };
}

export function monthDistance(from: MonthIndex, to: MonthIndex): number {
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    throw new Error('MonthIndex musi być liczbą całkowitą');
  }
  return to - from;
}
