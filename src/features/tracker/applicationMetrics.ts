import { ApplicationStatus } from '../../types';

export interface CurrentApplicationStageShare {
  /** null means there are no submitted applications, so there is no denominator. */
  percent: number | null;
  submittedCount: number;
  currentAdvancedStageCount: number;
}

/**
 * Pokazuje udzial rekordow, ktorych aktualny status to rozmowa lub oferta.
 * Tracker przechowuje biezacy status, nie pelna historie etapow; po zamknieciu
 * procesu nie da sie ustalic, czy wczesniej byla rozmowa. Dlatego tej liczby
 * nie opisujemy jako historycznej konwersji ani odpowiedzi pracodawcow.
 */
export function calculateCurrentApplicationStageShare(
  statuses: readonly ApplicationStatus[],
): CurrentApplicationStageShare {
  const submittedStatuses: readonly ApplicationStatus[] = ['Wys\u0142ana', 'Rozmowa', 'Oferta', 'Odrzucona'];
  const submittedCount = statuses.filter((status) => submittedStatuses.includes(status)).length;
  const currentAdvancedStageCount = statuses.filter((status) => status === 'Rozmowa' || status === 'Oferta').length;

  return {
    percent: submittedCount === 0 ? null : Math.round((currentAdvancedStageCount / submittedCount) * 100),
    submittedCount,
    currentAdvancedStageCount,
  };
}
