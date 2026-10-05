import { describe, expect, it } from 'vitest';
import { getScoreRingTrackDashArray } from '../scoreRingPresentation';

describe('prezentacja pierscienia wyniku', () => {
  it('odroznia brak wyniku od prawdziwego zera', () => {
    expect(getScoreRingTrackDashArray(null)).toBe('4 5');
    expect(getScoreRingTrackDashArray(0)).toBeUndefined();
    expect(getScoreRingTrackDashArray(72)).toBeUndefined();
  });
});
