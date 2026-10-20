import { describe, expect, it } from 'vitest';
import type { ApplicationEvent } from '../../../types';
import {
  formatApplicationEventDate,
  isoToLocalDateTime,
  localDateTimeToIso,
  removeApplicationEvent,
  synchronizeInterviewAt,
  synchronizeInterviewEventSchedule,
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

  it('synchronizuje termin rozmowy używany przez panel i reguły przypomnień', () => {
    const interview = { ...event, kind: 'interview' as const, scheduledAt: '2026-10-21T10:00:00.000Z' };
    const priorManualAt = '2026-10-18T10:00:00.000Z';

    expect(synchronizeInterviewAt([], [interview], priorManualAt)).toBe(interview.scheduledAt);
  });

  it('po usunięciu bieżącej rozmowy wybiera następną albo czyści osierocony termin', () => {
    const current = { ...event, id: 'current', kind: 'interview' as const, scheduledAt: '2026-10-21T10:00:00.000Z' };
    const next = { ...event, id: 'next', kind: 'interview' as const, scheduledAt: '2026-10-22T10:00:00.000Z' };

    expect(synchronizeInterviewAt([current, next], [next], current.scheduledAt)).toBe(next.scheduledAt);
    expect(synchronizeInterviewAt([current], [], current.scheduledAt)).toBeUndefined();
  });

  it('zastępuje termin całodniowy dokładnym czasem po dopisaniu godziny', () => {
    const dateOnly = { ...event, kind: 'interview' as const, scheduledAt: '2026-10-21' };
    const timed = { ...dateOnly, scheduledAt: '2026-10-21T00:00:00.000Z' };

    expect(synchronizeInterviewAt([dateOnly], [timed], dateOnly.scheduledAt)).toBe(timed.scheduledAt);
  });

  it('zachowuje ręcznie ustawiony interviewAt niezwiązany ze zdarzeniem osi', () => {
    const interview = { ...event, kind: 'interview' as const, scheduledAt: '2026-10-21T10:00:00.000Z' };
    const manualAt = '2026-10-23T10:00:00.000Z';

    expect(synchronizeInterviewAt([interview], [], manualAt)).toBe(manualAt);
  });

  it('przenosi albo usuwa termin osi zmieniony w panelu rozmowy', () => {
    const interview = { ...event, kind: 'interview' as const, scheduledAt: '2026-10-21T10:00:00.000Z' };
    const nextAt = '2026-10-22T11:30:00.000Z';

    expect(synchronizeInterviewEventSchedule([interview], interview.scheduledAt, nextAt)).toEqual([
      { ...interview, scheduledAt: nextAt },
    ]);
    expect(synchronizeInterviewEventSchedule([interview], interview.scheduledAt, undefined)).toEqual([]);
    expect(synchronizeInterviewEventSchedule([interview], '2026-10-23T10:00:00.000Z', nextAt)).toEqual([interview]);
  });

  it('konwertuje lokalny termin do ISO i pokazuje go w zapisanej strefie', () => {
    const iso = localDateTimeToIso('2026-10-21T10:00');
    expect(iso).toBeTruthy();
    expect(isoToLocalDateTime(iso!)).toBe('2026-10-21T10:00');
    expect(formatApplicationEventDate(event, 'UTC')).toContain('21 paź');
  });
});
