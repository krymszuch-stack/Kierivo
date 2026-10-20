import { describe, expect, it } from 'vitest';
import type { JobApplication } from '../../../types';
import {
  dateKeyInTimeZone,
  getApplicationCalendarEntries,
  getCalendarMonthDays,
  getCalendarWeekDays,
  shiftCalendarDate,
  shiftCalendarMonth,
} from '../applicationCalendar';

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: 'application-1',
    company: 'Firma testowa',
    position: 'Inżynier',
    salary: '',
    date: '2026-10-20',
    status: 'Wysłana',
    ...overrides,
  };
}

describe('application calendar', () => {
  it('buduje tydzień od poniedziałku i obejmuje cały miesiąc', () => {
    const days = getCalendarMonthDays(2026, 1);

    expect(days).toHaveLength(35);
    expect(days[0]).toEqual({ date: '2026-01-26', inCurrentMonth: false });
    expect(days[6]).toEqual({ date: '2026-02-01', inCurrentMonth: true });
    expect(days[34]).toEqual({ date: '2026-03-01', inCurrentMonth: false });
  });

  it('zachowuje 29 lutego w roku przestępnym', () => {
    const days = getCalendarMonthDays(2024, 1);

    expect(days.some((day) => day.date === '2024-02-29' && day.inCurrentMonth)).toBe(true);
    expect(days.filter((day) => day.inCurrentMonth)).toHaveLength(29);
  });

  it('buduje tydzień od poniedziałku przez zmianę miesiąca i roku', () => {
    expect(getCalendarWeekDays('2025-12-31').map((day) => day.date)).toEqual([
      '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01',
      '2026-01-02', '2026-01-03', '2026-01-04',
    ]);
  });

  it('przesuwa tydzień o siedem dni bez dryfu strefy czasowej', () => {
    expect(shiftCalendarDate('2026-10-31', 7)).toBe('2026-11-07');
    expect(shiftCalendarDate('2026-11-01', -7)).toBe('2026-10-25');
    expect(shiftCalendarDate('2026-02-30', 7)).toBeNull();
  });

  it('przesuwa miesiąc zachowując dzień lub przycinając go do końca krótszego miesiąca', () => {
    expect(shiftCalendarMonth('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftCalendarMonth('2024-01-31', 1)).toBe('2024-02-29');
    expect(shiftCalendarMonth('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('przelicza termin rozmowy na dzień w wybranej strefie, a datę aplikacji zachowuje jako dzień kalendarzowy', () => {
    const entries = getApplicationCalendarEntries([
      application({ interviewAt: '2026-10-01T00:30:00.000Z' }),
    ], 'America/Los_Angeles');

    expect(entries.map(({ kind, date }) => ({ kind, date }))).toEqual([
      { kind: 'interview', date: '2026-09-30' },
      { kind: 'application', date: '2026-10-20' },
    ]);
  });

  it('pokazuje stan zdarzenia i przypomnienie, a identyczny stary termin rozmowy widzi raz', () => {
    const entries = getApplicationCalendarEntries([
      application({
        interviewAt: '2026-10-21T08:00:00.000Z',
        events: [{
          id: 'interview-1',
          kind: 'interview',
          scheduledAt: '2026-10-21T08:00:00.000Z',
          timeZone: 'Europe/Warsaw',
          state: 'confirmed',
          source: 'user',
          evidenceUrl: 'https://example.test/invite',
          reminderAt: '2026-10-20T08:00:00.000Z',
        }],
      }),
    ], 'Europe/Warsaw');

    expect(entries).toHaveLength(3);
    expect(entries.find((entry) => entry.kind === 'interview')?.detail).toBe('Rozmowa · Potwierdzone');
    expect(entries.find((entry) => entry.kind === 'reminder')?.detail).toBe('Przypomnienie · Rozmowa');
  });

  it('nie wymyśla pozycji dla wadliwych dat i nie zmienia statusu z rekordu', () => {
    const entries = getApplicationCalendarEntries([
      application({ date: '2026-02-30', status: 'Do wysłania', interviewAt: 'nieznany termin' }),
    ], 'Europe/Warsaw');

    expect(entries).toEqual([]);
  });

  it('zwraca pustą datę strefową dla wadliwego timestampu', () => {
    expect(dateKeyInTimeZone('nieznany termin', 'Europe/Warsaw')).toBeNull();
  });
});
