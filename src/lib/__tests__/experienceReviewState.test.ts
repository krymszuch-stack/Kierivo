import { describe, expect, it } from 'vitest';
import type { WorkExperience } from '../../types';
import { getExperienceReviewState } from '../experienceReviewState';

const entry: WorkExperience = {
  id: 'synthetic', company: 'Firma', role: 'Rola', location: '',
  startDate: '2024-01', endDate: '2024-12', isCurrent: false, highlights: [],
};

describe('zakres kontroli historii pracy', () => {
  it('nie ogłasza sukcesu dla pustej lub niedatowanej historii', () => {
    expect(getExperienceReviewState([], 0)).toBe('no-data');
    expect(getExperienceReviewState([{ ...entry, startDate: '' }], 0)).toBe('limited');
    expect(getExperienceReviewState([{ ...entry, endDate: '' }], 0)).toBe('limited');
    expect(getExperienceReviewState([{ ...entry, isCurrent: true, endDate: '' }], 0)).toBe('no-alerts');
  });

  it('zachowuje uwagi audytora jako ważniejszy sygnał', () => {
    expect(getExperienceReviewState([{ ...entry, startDate: '' }], 1)).toBe('attention');
    expect(getExperienceReviewState([entry], 0)).toBe('no-alerts');
  });
});
