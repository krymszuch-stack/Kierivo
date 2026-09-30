import { describe, expect, it } from 'vitest';
import { calculateApplicationProgress } from '../applicationMetrics';

describe('Wskaźnik przejścia do rozmowy/oferty', () => {
  it('nie zamienia samych szkiców w wynik 0%', () => {
    expect(calculateApplicationProgress(['Do wysłania'])).toEqual({
      percent: null,
      eligibleCount: 0,
      progressedCount: 0,
    });
  });

  it('liczy brak przejścia tylko po rzeczywistym wysłaniu', () => {
    expect(calculateApplicationProgress(['Wysłana'])).toEqual({
      percent: 0,
      eligibleCount: 1,
      progressedCount: 0,
    });
  });

  it('liczy rozmowy i oferty wśród wysłanych oraz aktywnych, bez szkiców', () => {
    expect(calculateApplicationProgress(['Do wysłania', 'Wysłana', 'Rozmowa', 'Oferta'])).toEqual({
      percent: 67,
      eligibleCount: 3,
      progressedCount: 2,
    });
  });

  it('uwzględnia status Odrzucona w mianowniku, dając 0% przejść zamiast fałszywego 100%', () => {
    expect(calculateApplicationProgress(['Odrzucona'])).toEqual({
      percent: 0,
      eligibleCount: 1,
      progressedCount: 0,
    });
  });

  it('poprawnie liczy wskaźnik przy 1 rozmowie i 1 odrzuceniu (50%)', () => {
    expect(calculateApplicationProgress(['Rozmowa', 'Odrzucona'])).toEqual({
      percent: 50,
      eligibleCount: 2,
      progressedCount: 1,
    });
  });
});
