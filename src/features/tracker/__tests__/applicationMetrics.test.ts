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

  it('nie zakłada, że status Odrzucona zawsze oznacza odpowiedź pracodawcy', () => {
    expect(calculateApplicationProgress(['Odrzucona'])).toEqual({
      percent: null,
      eligibleCount: 0,
      progressedCount: 0,
    });
  });
});
