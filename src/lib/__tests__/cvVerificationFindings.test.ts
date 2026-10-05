import { describe, expect, it } from 'vitest';
import { hasNoReportedChronologyAnomalies, recommendationsForOffer } from '../cvVerificationFindings';

describe('spójność uwag weryfikatora CV', () => {
  it.each([
    [true, [], true],
    [false, [], false],
    [true, ['Koniec pracy poprzedza początek.'], false],
    [false, ['Daty wymagają sprawdzenia.'], false],
  ] as const)('flaga %s i anomalie %j dają brak wskazanych problemów: %s', (chronologyValid, timelineAnomalies, expected) => {
    expect(hasNoReportedChronologyAnomalies({ chronologyValid, timelineAnomalies })).toBe(expected);
  });

  const recommendations = [
    { category: 'ATS', title: 'Porównaj wymagania' },
    { category: 'RECRUITER', title: 'Doprecyzuj opis' },
    { category: 'LOGIC', title: 'Sprawdź daty' },
    { category: 'COMPLIANCE', title: 'Sprawdź treść profilu' },
  ];

  it('z ofertą zachowuje wszystkie kategorie i ich kolejność', () => {
    expect(recommendationsForOffer(recommendations, true)).toEqual(recommendations);
  });

  it('bez oferty wycofuje tylko zalecenia dopasowania i nie mutuje oryginału', () => {
    expect(recommendationsForOffer(recommendations, false)).toEqual(recommendations.slice(1));
    expect(recommendations).toHaveLength(4);
  });

  it('pusta lista pozostaje pusta', () => {
    expect(recommendationsForOffer([], false)).toEqual([]);
  });
});
