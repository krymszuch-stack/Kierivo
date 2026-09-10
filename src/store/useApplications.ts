import { useCallback, useEffect, useState } from 'react';
import { ApplicationStatus, JobApplication } from '../types';
import { ANONYMOUS_PROFILE_ID } from '../lib/localProfile';
import { applicationsKeyFor, onAppStorageWiped, readJson, removeRaw, StorageKeys, writeJson } from '../lib/storage';
import { useAuth } from '../context/AuthContext';

/**
 * Aplikacje w Pipeline — jedno źródło prawdy dla całego interfejsu.
 *
 * Wcześniej lista była prywatnym stanem `ApplicationTracker`: komponent czytał
 * ją z `localStorage` przy montowaniu i odsyłał z powrotem efektem. Dopóki
 * jedynym czytelnikiem był tracker, wystarczało. Przestało, gdy tej samej listy
 * potrzebują silnik „następnego kroku" i mechanizm odblokowań — stan schowany
 * w komponencie znaczyłby dla nich tyle, że rekomendacja aktualizuje się dopiero
 * po wejściu w Pipeline.
 *
 * Sklep wiąże zapis z profilem wystawionym przez `AuthContext`. Zapis idzie do
 * schowka natychmiast przy każdej zmianie: lista jest krótka, a jej
 * serializacja kosztuje ułamek tego co vault, więc odkładanie zapisu kupiłoby
 * tu tylko okno na utratę danych (reguła 9 w `AGENTS.md`).
 */

export function loadApplicationsFor(profileId: string): JobApplication[] {
  const raw = readJson<JobApplication[]>(applicationsKeyFor(profileId), []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is JobApplication => Boolean(a && typeof a === 'object' && a.id && a.status));
}

/**
 * Historia sprzed izolacji nie jest przypisywana automatycznie: na wspólnym
 * komputerze bieżący profil nie dowodzi, że należy do właściciela tych danych.
 * Interfejs pokazuje wyłącznie możliwość świadomego przypisania.
 */
export function loadUnassignedLegacyApplications(): JobApplication[] {
  const raw = readJson<JobApplication[]>(StorageKeys.applications, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is JobApplication => Boolean(a && typeof a === 'object' && a.id && a.status));
}

const cachedApplications = new Map<string, JobApplication[]>();
const listeners = new Set<() => void>();

function currentApplications(profileId: string): JobApplication[] {
  const cached = cachedApplications.get(profileId);
  if (cached) return cached;
  const loaded = loadApplicationsFor(profileId);
  cachedApplications.set(profileId, loaded);
  return loaded;
}

/**
 * Jedna reguła dla wszystkich dróg zapisu: odrzucona aplikacja nie może
 * dalej trzymać terminu rozmowy.
 *
 * Reguła siedzi w `commit`, a nie w poszczególnych handlerach, bo ścieżek
 * zapisu jest kilka (status w wierszu, edycja w modalu, notatki) — wcześniej
 * tylko jedna z nich czyściła `interviewAt` i ta sama zmiana statusu dawała
 * różny wynik w zależności od tego, gdzie użytkownik kliknął.
 */
function withStatusRules(application: JobApplication): JobApplication {
  if (!application) return application;
  if (application.status === 'Odrzucona' && application.interviewAt !== undefined) {
    return { ...application, interviewAt: undefined };
  }
  return application;
}

export function saveApplicationsFor(profileId: string, next: JobApplication[]): void {
  const applications = (Array.isArray(next) ? next : []).filter(Boolean).map(withStatusRules);
  cachedApplications.set(profileId, applications);
  writeJson(applicationsKeyFor(profileId), applications);
  listeners.forEach((notify) => notify());
}

/** Przypisuje starą, wspólną historię tylko po wyraźnym działaniu użytkownika. */
export function claimLegacyApplicationsFor(profileId: string): number {
  if (!profileId || profileId === ANONYMOUS_PROFILE_ID) return 0;

  const legacy = loadUnassignedLegacyApplications();
  if (legacy.length === 0) return 0;

  const current = currentApplications(profileId);
  const currentIds = new Set(current.map((entry) => entry.id));
  saveApplicationsFor(profileId, [...current, ...legacy.filter((entry) => !currentIds.has(entry.id))]);
  removeRaw(StorageKeys.applications);
  return legacy.length;
}

// „Usuń moje dane" musi obejmować także tę kopię w pamięci. Bez resetu pierwszy
// zapis po wymazaniu odtworzyłby w schowku pełną sprzed-usuwania listę — dane
// wróciłyby mimo komunikatu o nieodwracalnym usunięciu. Reset czyści wyłącznie
// pamięć: klucz właśnie zniknął, a ponowny zapis nastąpi dopiero przy nowej
// akcji użytkownika.
onAppStorageWiped(() => {
  cachedApplications.clear();
  listeners.forEach((notify) => notify());
});

export function useApplications() {
  const { user } = useAuth();
  const profileId = user?.id ?? ANONYMOUS_PROFILE_ID;
  const [state, setState] = useState<JobApplication[]>(() => currentApplications(profileId));

  useEffect(() => {
    const listener = () => setState(currentApplications(profileId));
    listeners.add(listener);
    // Stan mógł się zmienić między pierwszym renderem a podpięciem nasłuchu,
    // a po przełączeniu profilu nie może zachować listy poprzedniej osoby.
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, [profileId]);

  // Efekt przełącza subskrypcję po zmianie konta. Ten odczyt daje jednak
  // właściwą listę już w pierwszym renderze nowego profilu, bez jednej klatki
  // z historią poprzedniej osoby.
  const applications = currentApplications(profileId);
  const hasUnassignedLegacyApplications =
    profileId !== ANONYMOUS_PROFILE_ID && loadUnassignedLegacyApplications().length > 0;

  /** Dodaje albo nadpisuje wpis o tym samym identyfikatorze. */
  const saveApplication = useCallback((application: JobApplication) => {
    const applications = currentApplications(profileId);
    const index = applications.findIndex((entry) => entry.id === application.id);
    if (index === -1) {
      saveApplicationsFor(profileId, [application, ...applications]);
      return;
    }
    const next = [...applications];
    next[index] = {
      ...applications[index],
      ...application,
    };
    saveApplicationsFor(profileId, next);
  }, [profileId]);

  const removeApplication = useCallback((id: string) => {
    saveApplicationsFor(profileId, currentApplications(profileId).filter((entry) => entry.id !== id));
  }, [profileId]);

  const patchApplication = useCallback((id: string, changes: Partial<JobApplication>) => {
    saveApplicationsFor(
      profileId,
      currentApplications(profileId).map((entry) => (entry.id === id ? { ...entry, ...changes } : entry))
    );
  }, [profileId]);

  const claimLegacyApplications = useCallback(() => claimLegacyApplicationsFor(profileId), [profileId]);

  /**
   * Zmiana statusu przez wiersz tabeli. Reguła czyszczenia terminu rozmowy
   * obowiązuje wspólnie dla każdej drogi zapisu — patrz `withStatusRules`.
   */
  const setStatus = useCallback(
    (id: string, status: ApplicationStatus) => {
      patchApplication(id, { status });
    },
    [patchApplication]
  );

  return {
    applications: state === applications ? state : applications,
    saveApplication,
    removeApplication,
    patchApplication,
    setStatus,
    hasUnassignedLegacyApplications,
    claimLegacyApplications,
  };
}
