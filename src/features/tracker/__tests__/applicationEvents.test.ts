import { describe, expect, it } from 'vitest';
import type { ApplicationEvent } from '../../../types';
import { normalizeApplicationInterviews, projectInterviewAt, shouldCancelInterviewOnRejection, upsertInterviewEvent } from '../../../lib/applicationInterview';
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

  it('priorytetyzuje rozmowy nadal zaplanowane, a potem ostatnią odbytą', () => {
    const now = Date.parse('2026-10-20T12:00:00.000Z');
    const yesterday = { ...event, id: 'yesterday', kind: 'interview' as const, scheduledAt: '2026-10-19T10:00:00.000Z' };
    const tomorrow = { ...event, id: 'tomorrow', kind: 'interview' as const, scheduledAt: '2026-10-21T10:00:00.000Z' };
    const nextWeek = { ...event, id: 'next-week', kind: 'interview' as const, scheduledAt: '2026-10-27T10:00:00.000Z' };

    expect(projectInterviewAt([yesterday, nextWeek, tomorrow], now)).toBe(yesterday.scheduledAt);
    expect(projectInterviewAt([
      { ...yesterday, state: 'completed' }, tomorrow,
    ], now)).toBe(tomorrow.scheduledAt);
    expect(projectInterviewAt([
      { ...yesterday, state: 'completed' }, { ...tomorrow, state: 'cancelled' },
    ], now)).toBe(yesterday.scheduledAt);
  });

  it('przełożenie aktualizuje termin osi, a odwołanie zachowuje event i wybiera poprzednią rozmowę', () => {
    const now = Date.parse('2026-10-20T12:00:00.000Z');
    const yesterday = { ...event, id: 'yesterday', kind: 'interview' as const, scheduledAt: '2026-10-19T10:00:00.000Z' };
    const tomorrow = { ...event, id: 'tomorrow', kind: 'interview' as const, scheduledAt: '2026-10-21T10:00:00.000Z' };
    const app = { id: 'app-1', company: 'Firma', position: 'Rola', salary: '', date: '2026-10-20', status: 'Rozmowa' as const,
      events: [{ ...yesterday, state: 'completed' as const }, tomorrow] };

    const rescheduled = upsertInterviewEvent(app, '2026-10-22T10:00:00.000Z', 'UTC', now);
    expect(rescheduled.events).toEqual([{ ...yesterday, state: 'completed' },
      { ...tomorrow, scheduledAt: '2026-10-22T10:00:00.000Z', timeZone: 'UTC' }]);
    expect(rescheduled.interviewAt).toBe('2026-10-22T10:00:00.000Z');

    const cancelled = upsertInterviewEvent(app, undefined, 'UTC', now);
    expect(cancelled.events?.[1]).toMatchObject({ id: 'tomorrow', state: 'cancelled' });
    expect(cancelled.interviewAt).toBe(yesterday.scheduledAt);
  });

  it('zachowuje stan nierozstrzygniętej rozmowy przy zmianie terminu', () => {
    const now = Date.parse('2026-10-20T12:00:00.000Z');
    const pending = { ...event, id: 'pending-interview', kind: 'interview' as const, state: 'pending' as const,
      scheduledAt: '2026-10-21T10:00:00.000Z' };
    const app = { id: 'app-1', company: 'Firma', position: 'Rola', salary: '', date: '2026-10-20', status: 'Rozmowa' as const, events: [pending] };

    const rescheduled = upsertInterviewEvent(app, '2026-10-22T10:00:00.000Z', 'UTC', now);
    expect(rescheduled.events).toEqual([{ ...pending, scheduledAt: '2026-10-22T10:00:00.000Z', timeZone: 'UTC' }]);
  });

  it('nie odtwarza usuniętego terminu z projekcji legacy przy zapisie rekordu', () => {
    const normalized = normalizeApplicationInterviews({
      id: 'app-cleared', company: 'Firma', position: 'Rola', salary: '', date: '2026-10-20',
      status: 'Rozmowa', interviewAt: '2026-10-22T10:00:00.000Z', events: [],
    });

    expect(normalized.events).toEqual([]);
    expect(normalized.interviewAt).toBeUndefined();
  });

  it('traktuje rozmowę bez godziny jako aktywną przez cały bieżący dzień', () => {
    const today = { ...event, kind: 'interview' as const, scheduledAt: '2026-10-20' };
    const tomorrow = { ...today, scheduledAt: '2026-10-21' };
    const yesterday = { ...today, scheduledAt: '2026-10-19' };
    const now = Date.parse('2026-10-20T12:00:00.000Z');

    expect(shouldCancelInterviewOnRejection(today, now)).toBe(true);
    expect(shouldCancelInterviewOnRejection(tomorrow, now)).toBe(true);
    expect(shouldCancelInterviewOnRejection(yesterday, now)).toBe(false);
  });

  it('konwertuje lokalny termin do ISO i pokazuje go w zapisanej strefie', () => {
    const iso = localDateTimeToIso('2026-10-21T10:00');
    expect(iso).toBeTruthy();
    expect(isoToLocalDateTime(iso!)).toBe('2026-10-21T10:00');
    expect(formatApplicationEventDate(event, 'UTC')).toContain('21 paź');
  });
});
