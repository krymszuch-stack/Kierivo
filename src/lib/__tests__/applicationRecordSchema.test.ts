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
