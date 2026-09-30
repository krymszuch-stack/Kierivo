import { describe, expect, it } from 'vitest';
import { HOME_MATCH_EXAMPLE } from '../homeMatchExample';

describe('Przykładowy wynik na ekranie startowym', () => {
  it('procent, licznik i widoczna lista braków opisują ten sam wynik', () => {
    const { totalRequirements, matchedRequirements, coverage, missingRequirements } = HOME_MATCH_EXAMPLE;

    expect(coverage).toBe(Math.round((matchedRequirements / totalRequirements) * 100));
    expect(totalRequirements - matchedRequirements).toBe(missingRequirements.length);
  });
});
