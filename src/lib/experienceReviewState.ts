import type { WorkExperience } from '../types';

export type ExperienceReviewState = 'no-data' | 'limited' | 'attention' | 'no-alerts';

export function getExperienceReviewState(history: WorkExperience[], alertCount: number): ExperienceReviewState {
  if (history.length === 0) return 'no-data';
  if (alertCount > 0) return 'attention';
  // Audyt nie może potwierdzić osi czasu bez początku i końca każdego wpisu.
  if (history.some((entry) => !entry.startDate.trim() || (!entry.isCurrent && !entry.endDate.trim()))) {
    return 'limited';
  }
  return 'no-alerts';
}
