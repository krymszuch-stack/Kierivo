import { describe, expect, it } from 'vitest';
import type { ApplicationEvent } from '../../../types';
import { projectInterviewAt, upsertInterviewEvent } from '../../../lib/applicationInterview';
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

  it('zachowuje user_declared przy edycji zdarzenia z Huntera', () => {
    const declared: ApplicationEvent = {
      ...event,
      id: 'receipt-1',
      kind: 'application_sent',
      verificationStatus: 'user_declared',
    };
    const edited = { ...declared, note: 'Potwierdzenie zapisane' };
    delete (edited as Partial<ApplicationEvent>).verificationStatus;

    expect(upsertApplicationEvent([declared], edited as ApplicationEvent)[0].verificationStatus)
      .toBe('user_declared');
  });

  it('nie łączy identyfikatorów z różnych źródeł', () => {
    const incoming = { ...event, id: 'event-page', source: 'page' as const };

    expect(upsertApplicationEvent([event], incoming)).toHaveLength(2);
  });

  it('usuwa wyłącznie wybrane zdarzenie', () => {
    const other = { ...event, id: 'event-2', sourceEventId: undefined };

    expect(removeApplicationEvent([event, other], event.id)).toEqual([other]);
  });

  it('wybiera najbliższą przyszłą rozmowę, a bez przyszłych — ostatnią przeszłą', () => {
    const now = Date.parse('2026-10-20T12:00:00.000Z');
    const yesterday = { ...event, id: 'yesterday', kind: 'interview' as const, scheduledAt: '2026-10-19T10:00:00.000Z' };
    const tomorrow = { ...event, id: 'tomorrow', kind: 'interview' as const, scheduledAt: '2026-10-21T10:00:00.000Z' };
    const nextWeek = { ...event, id: 'next-week', kind: 'interview' as const, scheduledAt: '2026-10-27T10:00:00.000Z' };

    expect(projectInterviewAt([yesterday, nextWeek, tomorrow], now)).toBe(tomorrow.scheduledAt);
    expect(projectInterviewAt([{ ...yesterday, state: 'confirmed' }, { ...tomorrow, state: 'cancelled' }], now))
      .toBe(yesterday.scheduledAt);
  });

  it('przełożenie aktualizuje termin osi, a odwołanie zachowuje event i wybiera poprzednią rozmowę', () => {
    const now = Date.parse('2026-10-20T12:00:00.000Z');
    const yesterday = { ...event, id: 'yesterday', kind: 'interview' as const, scheduledAt: '2026-10-19T10:00:00.000Z' };
    const tomorrow = { ...event, id: 'tomorrow', kind: 'interview' as const, scheduledAt: '2026-10-21T10:00:00.000Z' };
    const app = { id: 'app-1', company: 'Firma', position: 'Rola', salary: '', date: '2026-10-20', status: 'Rozmowa' as const, events: [yesterday, tomorrow] };

    const rescheduled = upsertInterviewEvent(app, '2026-10-22T10:00:00.000Z', 'UTC', now);
    expect(rescheduled.events).toEqual([yesterday, { ...tomorrow, scheduledAt: '2026-10-22T10:00:00.000Z', timeZone: 'UTC', state: 'confirmed' }]);
    expect(rescheduled.interviewAt).toBe('2026-10-22T10:00:00.000Z');

    const cancelled = upsertInterviewEvent(app, undefined, 'UTC', now);
    expect(cancelled.events?.[1]).toMatchObject({ id: 'tomorrow', state: 'cancelled' });
    expect(cancelled.interviewAt).toBe(yesterday.scheduledAt);
  });

  it('konwertuje lokalny termin do ISO i pokazuje go w zapisanej strefie', () => {
    const iso = localDateTimeToIso('2026-10-21T10:00');
    expect(iso).toBeTruthy();
    expect(isoToLocalDateTime(iso!)).toBe('2026-10-21T10:00');
    expect(formatApplicationEventDate(event, 'UTC')).toContain('21 paź');
  });
});
