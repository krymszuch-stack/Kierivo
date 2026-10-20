import { describe, expect, it } from 'vitest';
import { isJobApplication, parseApplications } from '../applicationRecordSchema';

const valid = {
  id: 'application-1',
  company: 'Firma',
  position: 'Support Engineer',
  salary: '',
  date: '2026-10-02',
  status: 'Wysłana',
};

describe('kontrakt zapisanej aplikacji Pipeline', () => {
  it('odczytuje nowy wynik i zachowuje wcześniejszy znacznik jako historię', () => {
    expect(isJobApplication({ ...valid, atsScore: 41, atsScoreProvenance: 'canonical-v2' })).toBe(true);
    expect(isJobApplication({ ...valid, atsScore: 41, atsScoreProvenance: 'canonical-v1' })).toBe(true);
  });

  it('przyjmuje kompletny rekord i pustą wartość wynagrodzenia', () => {
    expect(isJobApplication(valid)).toBe(true);
  });

  it('zachowuje zdarzenia i terminy przypomnienia w rekordzie aplikacji', () => {
    expect(isJobApplication({
      ...valid,
      events: [{
        id: 'event-1',
        kind: 'response_due',
        scheduledAt: '2026-10-21T10:00:00.000Z',
        timeZone: 'Europe/Warsaw',
        state: 'pending',
        source: 'user',
        verificationStatus: 'user_declared',
        evidenceUrl: 'https://example.test/rekrutacja',
        note: 'Rekruter zapowiedział odpowiedź.',
        reminderAt: '2026-10-22T08:00:00.000Z',
      }],
    })).toBe(true);
  });

  it('dopuszcza timestamp z offsetem bez zgadywania IANA strefy wpisania', () => {
    expect(isJobApplication({
      ...valid,
      events: [{
        id: 'legacy-interview', kind: 'interview', scheduledAt: '2026-10-21T10:00:00.000Z',
        state: 'confirmed', source: 'user',
      }],
    })).toBe(true);
  });

  it('pozwala oznaczyć jako odbytą tylko rozmowę', () => {
    expect(isJobApplication({
      ...valid,
      events: [{ id: 'interview-1', kind: 'interview', scheduledAt: '2026-10-19T10:00:00.000Z', state: 'completed', source: 'user' }],
    })).toBe(true);
    expect(isJobApplication({
      ...valid,
      events: [{ id: 'email-1', kind: 'email', scheduledAt: '2026-10-19T10:00:00.000Z', state: 'completed', source: 'user' }],
    })).toBe(false);
  });

  it.each([
    ['nieznany rodzaj', [{ id: 'event-1', kind: 'rejection_guess', scheduledAt: '2026-10-21', state: 'unknown', source: 'user' }]],
    ['wadliwą strefę czasową', [{ id: 'event-1', kind: 'interview', scheduledAt: '2026-10-21T10:00:00.000Z', timeZone: 'Mars/Olympus', state: 'confirmed', source: 'user' }]],
    ['timestamp bez jawnego offsetu i strefy', [{ id: 'event-1', kind: 'interview', scheduledAt: '2026-10-21T10:00', state: 'confirmed', source: 'user' }]],
    ['niemożliwy dzień w timestampie', [{ id: 'event-1', kind: 'interview', scheduledAt: '2026-02-30T10:15:00.000Z', timeZone: 'Europe/Warsaw', state: 'confirmed', source: 'user' }]],
    ['nieprawidłowe przypomnienie', [{ id: 'event-1', kind: 'follow_up', scheduledAt: '2026-10-21', reminderAt: 'wkrótce', state: 'pending', source: 'user' }]],
    ['niemożliwy dzień przypomnienia', [{ id: 'event-1', kind: 'follow_up', scheduledAt: '2026-10-21', reminderAt: '2026-02-30T10:15:00.000Z', state: 'pending', source: 'user' }]],
  ])('odrzuca zdarzenie z %s, zachowując cały rekord w materiale do odzyskania', (_label, events) => {
    const malformed = { ...valid, events };
    expect(isJobApplication(malformed)).toBe(false);
    expect(parseApplications([malformed])).toEqual({ applications: [], rejected: [malformed] });
  });

  it.each([
    ['status spoza słownika', { ...valid, status: 'Oczekuje na cuda' }],
    ['datę spoza kalendarza', { ...valid, date: '2026-02-31' }],
    ['id o nieprawidłowym typie', { ...valid, id: 42 }],
    ['wynik ATS poza zakresem', { ...valid, atsScore: 140 }],
    ['listę słów kluczowych o złym kształcie', { ...valid, missingKeywords: null }],
    ['migawkę z opisem oferty o złym typie', {
      ...valid,
      documentSnapshot: {
        schemaVersion: 1,
        createdAt: '2026-10-02T12:00:00.000Z',
        tailoredResume: {},
        vaultSnapshot: {},
        jobOfferSnapshot: { title: 'Rola', company: 'Firma', description: 42 },
      },
    }],
  ])('odrzuca %s', (_label, record) => {
    expect(isJobApplication(record)).toBe(false);
  });

  it('oddziela wadliwe rekordy, nie mieszając ich ze statystykami', () => {
    const malformed = { ...valid, status: 'Prawie oferta' };
    const result = parseApplications([valid, null, malformed]);
    expect(result.applications).toEqual([valid]);
    expect(result.rejected).toEqual([null, malformed]);
  });

  it('zachowuje błędny korzeń jako materiał do odzyskania', () => {
    const malformedRoot = { unexpected: 'data' };
    expect(parseApplications(malformedRoot)).toEqual({ applications: [], rejected: [malformedRoot] });
  });
});
