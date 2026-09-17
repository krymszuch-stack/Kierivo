import { describe, it, expect } from 'vitest';
import { EXAMPLE_CV, EXAMPLE_JD, EXAMPLE_ROLE_TITLE } from '../demoScenario';
import { runQuickAtsCheck, MIN_CV_CHARS, MIN_JD_CHARS } from '../../../lib/quickAtsCheck';
import { scoreCanonicalAts } from '../../../lib/canonicalAts';

/**
 * Strażnik scenariusza demo (reguła 1 z AGENTS.md).
 *
 * Demo na stronie startowej pokazuje wynik wyliczony prawdziwym silnikiem na
 * tych danych. Ten test pilnuje dwóch rzeczy: że treści NIE przestaną być
 * oznaczone jako przykład (etykieta w treści, nie tylko w UI) oraz że silnik
 * faktycznie umie na nich policzyć pełny wynik — bo demo bez wyniku albo z
 * wynikiem „stanu pustego” przestałoby pokazywać produkt.
 */
describe('scenariusz demo — oznaczenie jako przykład', () => {
  it('CV zaczyna się etykietą PRZYKŁAD w samej treści', () => {
    expect(EXAMPLE_CV.startsWith('[PRZYKŁAD — fikcyjne CV do pokazania')).toBe(true);
  });

  it('ogłoszenie to ten sam obiekt, który klika „Wypróbuj na przykładzie” w Aplikuj', () => {
    expect(EXAMPLE_JD.startsWith('[PRZYKŁAD — fikcyjne ogłoszenie')).toBe(true);
    expect(EXAMPLE_JD).toContain('(firma przykładowa)');
  });
});

describe('scenariusz demo — silnik liczy pełny wynik', () => {
  const quick = runQuickAtsCheck(EXAMPLE_CV, EXAMPLE_JD, { jobTitle: EXAMPLE_ROLE_TITLE });
  const canonical = scoreCanonicalAts(quick.vault, EXAMPLE_JD, EXAMPLE_ROLE_TITLE);

  it('treści przekraczają minima wejściowe szybkiego sprawdzenia', () => {
    expect(EXAMPLE_CV.length).toBeGreaterThan(MIN_CV_CHARS);
    expect(EXAMPLE_JD.length).toBeGreaterThan(MIN_JD_CHARS);
  });

  it('wynik kanoniczny jest policzalny (stan SCORABLE), nie stanem pustym', () => {
    expect(canonical.state).toBe('SCORABLE');
    expect(canonical.score).toBeGreaterThanOrEqual(0);
    expect(canonical.score).toBeLessThanOrEqual(100);
  });

  it('wszystkie cztery filary mieszczą się w skali 0–100', () => {
    for (const value of Object.values(canonical.components)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('scenariusz ma realną lukę — lista braków nie jest pusta', () => {
    // Kandydat 3,5 roku stażu vs 5 lat wymaganych i brak części stosu:
    // demo ma pokazywać uczciwy pośredni wynik, nie reklamowe 95%.
    expect(quick.missingSkills.length).toBeGreaterThan(0);
  });
});
