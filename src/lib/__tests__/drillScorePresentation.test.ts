import { describe, expect, it } from 'vitest';
import { formatDrillOverallScore } from '../drillScorePresentation';

describe('prezentacja wyniku treningu', () => {
  it('nie pokazuje niekalibrowanego wyniku z bieżącej ani historycznej próby', () => {
    expect(formatDrillOverallScore(null, 'points')).toBe('nie jest mierzony');
    expect(formatDrillOverallScore(null, 'percent')).toBe('nie jest mierzony');
    expect(formatDrillOverallScore(96, 'percent')).toBe('nie jest mierzony');
  });

  it('nie pokazuje historycznej niefinitywnej liczby jako punktów', () => {
    expect(formatDrillOverallScore(Number.NaN, 'points')).toBe('nie jest mierzony');
  });
});
