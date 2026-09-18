import { ApplicationStatus, JobApplication } from '../../types';

/**
 * Konfiguracja statusów pipeline rekrutacyjnego (Kierivo Tracker).
 *
 * Zgodnie z wymaganiem ergonomii UI:
 * Na starcie pipeline prezentuje zredukowaną liczbę 4 kluczowych stanów:
 * 1. „Do wysłania" — szkice i dopasowane oferty przed wysyłką
 * 2. „Wysłane" — aplikacje przesłane, oczekujące na kontakt
 * 3. „W toku" — aktywne etapy rekrutacji (rozmowy, zadania, etapy techniczne)
 * 4. „Zakończone" — zamknięte procesy (oferty zatrudnienia oraz odrzucenia)
 *
 * W konfiguracji zaawansowanej użytkownik ma dostęp do pełnego granularnego
 * rozbicia (Do wysłania, Wysłana, Rozmowa, Oferta, Odrzucona).
 */

export type SimplifiedStatus = 'Do wysłania' | 'Wysłana' | 'W toku' | 'Zakończone';

/**
 * Czytelne opisy każdego statusu i grupy statusów przeznaczone do tooltipów
 * (dostępne dla czytników ekranu i wyświetlane po najechaniu / focusie).
 */
export const STATUS_TOOLTIPS: Record<ApplicationStatus | 'W toku' | 'Zakończone' | 'ALL', string> = {
  ALL: 'Wszystkie zarejestrowane zgłoszenia rekrutacyjne bez względu na etap procesu.',
  'Do wysłania': 'Wersja robocza zgłoszenia. Przygotuj i dopasuj CV przed wysłaniem do pracodawcy.',
  Wysłana: 'Aplikacja wysłana do pracodawcy. Oczekujesz na pierwszy kontakt lub screening telefoniczny.',
  Rozmowa: 'Aktywny etap rekrutacji: zaplanowane lub trwające rozmowy, zadania techniczne i spotkania rekrutacyjne.',
  Oferta: 'Otrzymano formalną propozycję zatrudnienia. Etap negocjacji warunków i podjęcia decyzji.',
  Odrzucona: 'Proces rekrutacyjny zakończony decyzją odmowną pracodawcy lub rezygnacją kandydata.',
  'W toku': 'Aktywne procesy rekrutacyjne w trakcie rozmów, spotkań technicznych lub realizacji zadań.',
  Zakończone: 'Zamknięte procesy rekrutacyjne: zakończone otrzymaną ofertą zatrudnienia lub decyzją odmowną.',
};

/**
 * Mapuje status domenowy JobApplication na jeden z 4 zredukowanych stanów.
 */
export function mapStatusToSimplified(status: ApplicationStatus): SimplifiedStatus {
  switch (status) {
    case 'Do wysłania':
      return 'Do wysłania';
    case 'Wysłana':
      return 'Wysłana';
    case 'Rozmowa':
      return 'W toku';
    case 'Oferta':
    case 'Odrzucona':
      return 'Zakończone';
    default:
      return 'Wysłana';
  }
}

/**
 * Sprawdza, czy dana aplikacja spełnia warunek wybranego filtra w danym trybie widoku.
 */
export function matchesStatusFilter(
  appStatus: ApplicationStatus,
  filterId: string,
  isAdvancedMode: boolean
): boolean {
  if (filterId === 'ALL') return true;

  if (isAdvancedMode) {
    return appStatus === filterId;
  }

  // Tryb uproszczony (4 główne stany)
  switch (filterId) {
    case 'Do wysłania':
      return appStatus === 'Do wysłania';
    case 'Wysłana':
    case 'Wysłane':
      return appStatus === 'Wysłana';
    case 'W toku':
      return appStatus === 'Rozmowa';
    case 'Zakończone':
      return appStatus === 'Oferta' || appStatus === 'Odrzucona';
    default:
      return appStatus === filterId;
  }
}

export interface PipelineFilterItem {
  id: string;
  label: string;
  count: number;
  tooltip: string;
}

/**
 * Generuje listę przycisków filtrów w zależności od wybranego trybu widoku.
 */
export function getPipelineFilters(
  applications: JobApplication[],
  isAdvancedMode: boolean
): PipelineFilterItem[] {
  const totalApps = applications.length;

  if (isAdvancedMode) {
    return [
      {
        id: 'ALL',
        label: 'Wszystkie',
        count: totalApps,
        tooltip: STATUS_TOOLTIPS.ALL,
      },
      {
        id: 'Do wysłania',
        label: 'Do wysłania',
        count: applications.filter((a) => a?.status === 'Do wysłania').length,
        tooltip: STATUS_TOOLTIPS['Do wysłania'],
      },
      {
        id: 'Wysłana',
        label: 'Wysłane',
        count: applications.filter((a) => a?.status === 'Wysłana').length,
        tooltip: STATUS_TOOLTIPS.Wysłana,
      },
      {
        id: 'Rozmowa',
        label: 'Rozmowy',
        count: applications.filter((a) => a?.status === 'Rozmowa').length,
        tooltip: STATUS_TOOLTIPS.Rozmowa,
      },
      {
        id: 'Oferta',
        label: 'Oferty',
        count: applications.filter((a) => a?.status === 'Oferta').length,
        tooltip: STATUS_TOOLTIPS.Oferta,
      },
      {
        id: 'Odrzucona',
        label: 'Odrzucone',
        count: applications.filter((a) => a?.status === 'Odrzucona').length,
        tooltip: STATUS_TOOLTIPS.Odrzucona,
      },
    ];
  }

  // Tryb uproszczony (4 główne stany widoczne na starcie)
  const toSendCount = applications.filter((a) => a?.status === 'Do wysłania').length;
  const sentCount = applications.filter((a) => a?.status === 'Wysłana').length;
  const inProgressCount = applications.filter((a) => a?.status === 'Rozmowa').length;
  const completedCount = applications.filter(
    (a) => a?.status === 'Oferta' || a?.status === 'Odrzucona'
  ).length;

  return [
    {
      id: 'ALL',
      label: 'Wszystkie',
      count: totalApps,
      tooltip: STATUS_TOOLTIPS.ALL,
    },
    {
      id: 'Do wysłania',
      label: 'Do wysłania',
      count: toSendCount,
      tooltip: STATUS_TOOLTIPS['Do wysłania'],
    },
    {
      id: 'Wysłana',
      label: 'Wysłane',
      count: sentCount,
      tooltip: STATUS_TOOLTIPS.Wysłana,
    },
    {
      id: 'W toku',
      label: 'W toku',
      count: inProgressCount,
      tooltip: STATUS_TOOLTIPS['W toku'],
    },
    {
      id: 'Zakończone',
      label: 'Zakończone',
      count: completedCount,
      tooltip: STATUS_TOOLTIPS.Zakończone,
    },
  ];
}
