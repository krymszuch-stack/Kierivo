import { describe, expect, it } from 'vitest';
import { getAnalysisMonth, getCalculationTimeFreshness, nextAnalysisMonthDelay, parseAnalysisTimestamp } from '../analysisPeriod';

const now = new Date(2026, 9, 15, 12);
const current = { calculatedAt: new Date(2026, 9, 1, 12).toISOString(), calculationMonth: '2026-10' };

describe('miesiąc rzeczywistego obliczenia', () => {
  it('korzysta z lokalnego miesiąca tak samo jak silnik stażu', () => {
    expect(getAnalysisMonth(new Date(2026, 9, 1, 0))).toBe('2026-10');
    expect(getAnalysisMonth(new Date(NaN))).toBeNull();
  });

  it('ta sama jednostka obliczeń pozostaje aktualna, poprzednia jest historyczna', () => {
    expect(getCalculationTimeFreshness(current, now)).toBe('current');
    expect(getCalculationTimeFreshness({ calculatedAt: new Date(2026, 8, 30, 12).toISOString(), calculationMonth: '2026-09' }, now)).toBe('stale');
  });

  it.each([
    {},
    { ...current, calculatedAt: undefined },
    { ...current, calculationMonth: undefined },
    { ...current, calculatedAt: '2026-02-30T12:00:00.000Z' },
    { ...current, calculatedAt: '03/04/2020' },
    { ...current, calculationMonth: '2026-13' },
    { ...current, calculationMonth: '2026-9' },
    { ...current, calculationMonth: '2026-09' },
    { ...current, calculatedAt: new Date(2026, 9, 16, 12).toISOString() },
    { calculatedAt: new Date(2026, 10, 1, 12).toISOString(), calculationMonth: '2026-11' },
  ])('nie uznaje niepełnego, sprzecznego ani przyszłego pomiaru za aktualny: %j', (value) => {
    expect(getCalculationTimeFreshness(value, now)).toBe('unknown');
  });

  it('nie porównuje okresów do nieprawidłowego czasu bieżącego', () => {
    expect(getCalculationTimeFreshness(current, new Date(NaN))).toBe('unknown');
  });

  it('ustawia timer na granicę miesiąca i respektuje limit setTimeout', () => {
    expect(nextAnalysisMonthDelay(new Date(2026, 8, 30, 23, 59, 59))).toBe(1000);
    expect(nextAnalysisMonthDelay(new Date(2026, 11, 31, 23, 59, 59))).toBe(1000);
    expect(nextAnalysisMonthDelay(new Date(2026, 9, 1))).toBe(2_147_483_647);
    expect(nextAnalysisMonthDelay(new Date(2026, 9, 31, 23, 59, 59, 999))).toBe(1);
  });

  it('odczytuje wyłącznie jednoznaczny, rzeczywisty znacznik ISO', () => {
    expect(parseAnalysisTimestamp(current.calculatedAt)).toBe(Date.parse(current.calculatedAt));
    expect(parseAnalysisTimestamp('2026-02-30T12:00:00.000Z')).toBeNull();
    expect(parseAnalysisTimestamp(42)).toBeNull();
  });
});
