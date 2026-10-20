import { describe, expect, it } from 'vitest';
import type { ApplicationEvent } from '../../../types';
import {
  formatApplicationEventDate,
  isoToLocalDateTime,
  localDateTimeToIso,
  removeApplicationEvent,
  upsertApplicationEvent,
} from '../applicationEvents';

const event: ApplicationEvent = {
  id: 'event-1',
  kind: 'response_due',
  scheduledAt: '2026-10-21T08:00:00.000Z',
  timeZone: 'Europe/Warsaw',
  state: 'pending',
  source: 'extension',
  sourceEventId: 'offer-1:response-due',
};

describe('zdarzenia procesu aplikacji', () => {
  it('aktualizuje powtórzony identyfikator źródłowy bez tworzenia duplikatu', () => {
    const incoming = { ...event, id: 'event-retry', state: 'confirmed' as const };

    expect(upsertApplicationEvent([event], incoming)).toEqual([{ ...incoming, id: event.id }]);
  });

  it('nie łączy identyfikatorów z różnych źródeł', () => {
    const incoming = { ...event, id: 'event-page', source: 'page' as const };

    expect(upsertApplicationEvent([event], incoming)).toHaveLength(2);
  });

  it('usuwa wyłącznie wybrane zdarzenie', () => {
    const other = { ...event, id: 'event-2', sourceEventId: undefined };

    expect(removeApplicationEvent([event, other], event.id)).toEqual([other]);
  });

  it('konwertuje lokalny termin do ISO i pokazuje go w zapisanej strefie', () => {
    const iso = localDateTimeToIso('2026-10-21T10:00');
    expect(iso).toBeTruthy();
    expect(isoToLocalDateTime(iso!)).toBe('2026-10-21T10:00');
    expect(formatApplicationEventDate(event, 'UTC')).toContain('21 paź');
  });
});
