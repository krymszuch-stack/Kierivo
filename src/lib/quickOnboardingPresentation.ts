import type { TopProblem } from './quickAtsCheck';

/** Etykietę wybieramy z rodzaju problemu, nie z samej jego wagi. */
export function getTopProblemLabel(problem: Pick<TopProblem, 'category' | 'severity'>): string {
  switch (problem.category) {
    case 'formal':
      return 'Krytyczny wymóg';
    case 'hard_skill':
      return 'Brakująca umiejętność';
    case 'structure':
      return problem.severity === 'info' ? 'Wskazówka jakościowa' : 'Kontrola struktury';
  }
}
