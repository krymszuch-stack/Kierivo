import { ApplicationStatus } from '../../types';

export interface ApplicationProgressMetric {
  /** null oznacza brak wysłanych/aktywnych aplikacji, czyli brak mianownika. */
  percent: number | null;
  eligibleCount: number;
  progressedCount: number;
}

/**
 * Mierzy przejście od wysłania do rozmowy/oferty, nie ogólny odzew.
 * Szkice nie są wysłane, a „Odrzucona” nie rozróżnia decyzji pracodawcy od
 * rezygnacji kandydata, więc żaden z tych stanów nie daje wiarygodnego mianownika.
 */
export function calculateApplicationProgress(
  statuses: readonly ApplicationStatus[],
): ApplicationProgressMetric {
  const eligibleStatuses: readonly ApplicationStatus[] = ['Wysłana', 'Rozmowa', 'Oferta'];
  const eligibleCount = statuses.filter((status) => eligibleStatuses.includes(status)).length;
  const progressedCount = statuses.filter((status) => status === 'Rozmowa' || status === 'Oferta').length;

  return {
    percent: eligibleCount === 0 ? null : Math.round((progressedCount / eligibleCount) * 100),
    eligibleCount,
    progressedCount,
  };
}
