import { describe, expect, it } from 'vitest';
import { calculateCurrentApplicationStageShare } from '../applicationMetrics';

describe('Aktualny udzial aplikacji na etapach rozmowy i oferty', () => {
  it('nie pokazuje 0% dla samych szkicow bez wyslanych aplikacji', () => {
    expect(calculateCurrentApplicationStageShare(['Do wys\u0142ania'])).toEqual({
      percent: null,
      submittedCount: 0,
      currentAdvancedStageCount: 0,
    });
  });

  it('liczy biezacy etap sposrod wyslanych, aktywnych i zamknietych aplikacji', () => {
    expect(calculateCurrentApplicationStageShare([
      'Do wys\u0142ania', 'Wys\u0142ana', 'Rozmowa', 'Oferta', 'Odrzucona',
    ])).toEqual({
      percent: 50,
      submittedCount: 4,
      currentAdvancedStageCount: 2,
    });
  });

  it('pokazuje 0% biezacych rozmow/ofert, gdy zostaly tylko zamkniete aplikacje', () => {
    expect(calculateCurrentApplicationStageShare(['Odrzucona'])).toEqual({
      percent: 0,
      submittedCount: 1,
      currentAdvancedStageCount: 0,
    });
  });
});
