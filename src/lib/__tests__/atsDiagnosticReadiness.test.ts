import { describe, expect, it } from 'vitest';
import { hasAtsDiagnosticContent } from '../atsDiagnosticReadiness';

describe('gotowosc diagnostyki struktury tekstu CV', () => {
  it('nie traktuje pustych wartosci ani symboli jako tresci CV', () => {
    expect(hasAtsDiagnosticContent(['', '  ', '---', '***'])).toBe(false);
  });

  it('rozpoznaje tresc kandydata, w tym nazwy zawierajace cyfry', () => {
    expect(hasAtsDiagnosticContent(['', 'SEP G1'])).toBe(true);
  });
});
