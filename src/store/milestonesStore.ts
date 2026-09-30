import { UxLiveState, UxMilestones, loadMilestones, reconcileMilestones, saveMilestones } from '../lib/uxMilestones';
import { onAppStorageWiped } from '../lib/storage';

/**
 * Kamienie milowe trzymane poza Reactem.
 *
 * Kuszące było zamknąć je w `useState` i przeliczać efektem, ale wychodził
 * z tego dokładnie ten wzorzec, przed którym ostrzega `react-hooks`: efekt,
 * który ustawia stan, po czym powoduje kolejny render. Sklep modułowy plus
 * `useSyncExternalStore` w haku odwraca zależność — React czyta migawkę,
 * zamiast być źródłem prawdy dla czegoś, co i tak musi przeżyć przeładowanie
 * strony.
 */

const milestonesByProfile = new Map<string, UxMilestones>();
const listenersByProfile = new Map<string, Set<() => void>>();

function currentMilestones(profileId: string): UxMilestones {
  const cached = milestonesByProfile.get(profileId);
  if (cached) return cached;
  const loaded = loadMilestones(profileId);
  milestonesByProfile.set(profileId, loaded);
  return loaded;
}

function notify(profileId: string): void {
  listenersByProfile.get(profileId)?.forEach((listener) => listener());
}

/**
 * Migawka. Musi oddawać **tę samą referencję**, dopóki nic się nie zmieniło —
 * `useSyncExternalStore` porównuje wynik tożsamością i nowy obiekt przy każdym
 * wywołaniu wpędziłby go w nieskończoną pętlę renderów.
 */
export function getMilestones(profileId: string): UxMilestones {
  return currentMilestones(profileId);
}

export function subscribeMilestones(profileId: string, listener: () => void): () => void {
  const listeners = listenersByProfile.get(profileId) ?? new Set<() => void>();
  listeners.add(listener);
  listenersByProfile.set(profileId, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) listenersByProfile.delete(profileId);
  };
}

/**
 * Dopisuje kamienie milowe wynikające z bieżącego stanu. Bez zmiany — bez
 * powiadomienia, więc wywoływanie tego przy każdym renderze jest bezpieczne.
 */
export function syncMilestones(profileId: string, state: UxLiveState): void {
  const current = currentMilestones(profileId);
  const next = reconcileMilestones(current, state, new Date());
  if (next === current) return;

  milestonesByProfile.set(profileId, next);
  saveMilestones(profileId, next);
  notify(profileId);
}

/** Odrzuca chwilowy stan starego Vaultu po zmianie aktywnego profilu. */
export function syncMilestonesForProfile(
  profileId: string,
  vaultProfileId: string,
  state: UxLiveState
): void {
  if (profileId !== vaultProfileId) return;
  syncMilestones(profileId, state);
}

/** Odhacza jednorazową podpowiedź o skrótach klawiszowych. */
export function markShortcutsHintSeen(profileId: string): void {
  const current = currentMilestones(profileId);
  if (current.shortcutsHintSeenAt) return;

  const next = { ...current, shortcutsHintSeenAt: new Date().toISOString() };
  milestonesByProfile.set(profileId, next);
  saveMilestones(profileId, next);
  notify(profileId);
}

// Bez tego resetu pierwszy syncMilestones po „usuń moje dane" porównywałby się
// z pamięcią sprzed wymazania i odzyskiwał kamienie milowe do schowka — razem
// z odblokowanymi sekcjami, które miały zniknąć razem z profilem.
onAppStorageWiped(() => {
  milestonesByProfile.clear();
  listenersByProfile.forEach((listeners) => listeners.forEach((listener) => listener()));
});
