import { useCallback, useEffect, useState } from 'react';
import { ApplicationStatus, JobApplication } from '../types';
import { ANONYMOUS_PROFILE_ID } from '../lib/localProfile';
import { applicationsKeyFor, onAppStorageWiped, onProfileStorageCleared, readJson, readJsonForMigration, removeRaw, StorageKeys, writeJson, writeJsonDurably } from '../lib/storage';
import { useAuth } from '../context/AuthContext';
import { parseApplications } from '../lib/applicationRecordSchema';
import { mergeMigrationRecords } from '../lib/mergeMigrationRecords';

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

const rejectedByKey = new Map<string, unknown[]>();

function loadApplications(key: string): JobApplication[] {
  const parsed = parseApplications(readJson<unknown>(key, []));
  rejectedByKey.set(key, parsed.rejected);
  return parsed.applications;
}

export function loadApplicationsFor(profileId: string): JobApplication[] {
  return loadApplications(applicationsKeyFor(profileId));
}

/**
 * Historia sprzed izolacji nie jest przypisywana automatycznie: na wspólnym
 * komputerze bieżący profil nie dowodzi, że należy do właściciela tych danych.
 * Interfejs pokazuje wyłącznie możliwość świadomego przypisania.
 */
export function loadUnassignedLegacyApplications(): JobApplication[] {
  return loadApplications(StorageKeys.applications);
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
  const key = applicationsKeyFor(profileId);
  const parsedNext = parseApplications(next);
  const applications = parsedNext.applications.map(withStatusRules);
  const rejected = [
    ...(rejectedByKey.get(key) ?? parseApplications(readJson<unknown>(key, [])).rejected),
    ...parsedNext.rejected,
  ];
  rejectedByKey.set(key, rejected);
  cachedApplications.set(profileId, applications);
  writeJson(key, [...applications, ...rejected]);
  listeners.forEach((notify) => notify());
}

/** Przypisuje starą, wspólną historię tylko po wyraźnym działaniu użytkownika. */
export async function claimLegacyApplicationsFor(profileId: string): Promise<number> {
  if (!profileId || profileId === ANONYMOUS_PROFILE_ID) return 0;

  const source = readJsonForMigration(StorageKeys.applications);
  if (!source.success || source.raw === null) return 0;
  const parsedLegacy = parseApplications(source.value);
  const legacy = parsedLegacy.applications;
  if (legacy.length === 0 || parsedLegacy.rejected.length > 0) return 0;

  const key = applicationsKeyFor(profileId);
  const target = readJsonForMigration(key);
  if (!target.success) return 0;
  const parsedTarget = parseApplications(target.raw === null ? [] : target.value);
  const current = parsedTarget.applications;
  const merged = mergeMigrationRecords(current, legacy);
  if (!merged) return 0;
  const applications = merged.map(withStatusRules);
  const rejected = parsedTarget.rejected;
  // Nie usuwaj wspólnej historii po zapisie awaryjnym, który jeszcze nie
  // zakończył transakcji. Cache celu publikujemy dopiero po utrwaleniu kopii.
  const persisted = await writeJsonDurably(key, [...applications, ...rejected]);
  const currentSource = readJsonForMigration(StorageKeys.applications);
  if (!persisted || !currentSource.success || currentSource.raw !== source.raw) return 0;
  cachedApplications.set(profileId, applications);
  rejectedByKey.set(key, rejected);
  removeRaw(StorageKeys.applications);
  listeners.forEach((notify) => notify());
  return legacy.length;
}

// „Usuń moje dane" musi obejmować także tę kopię w pamięci. Bez resetu pierwszy
// zapis po wymazaniu odtworzyłby w schowku pełną sprzed-usuwania listę — dane
// wróciłyby mimo komunikatu o nieodwracalnym usunięciu. Reset czyści wyłącznie
// pamięć: klucz właśnie zniknął, a ponowny zapis nastąpi dopiero przy nowej
// akcji użytkownika.
onAppStorageWiped(() => {
  cachedApplications.clear();
  rejectedByKey.clear();
  listeners.forEach((notify) => notify());
});

onProfileStorageCleared(profileId => {
  cachedApplications.delete(profileId);
  rejectedByKey.delete(applicationsKeyFor(profileId));
  listeners.forEach(notify => notify());
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
  const rejectedApplicationsCount = rejectedByKey.get(applicationsKeyFor(profileId))?.length ?? 0;
  const rejectedLegacyApplicationsCount = rejectedByKey.get(StorageKeys.applications)?.length ?? 0;

  /** Dodaje albo nadpisuje wpis o tym samym identyfikatorze. */
  const saveApplication = useCallback((application: JobApplication) => {
    const applications = currentApplications(profileId);
    const index = applications.findIndex((entry) => entry.id === application.id);
    const now = new Date().toISOString();
    if (index === -1) {
      saveApplicationsFor(profileId, [{ ...application, updatedAt: application.updatedAt || now }, ...applications]);
      return;
    }
    const next = [...applications];
    next[index] = {
      ...applications[index],
      ...application,
      updatedAt: now,
    };
    saveApplicationsFor(profileId, next);
  }, [profileId]);

  const removeApplication = useCallback((id: string) => {
    saveApplicationsFor(profileId, currentApplications(profileId).filter((entry) => entry.id !== id));
  }, [profileId]);

  const patchApplication = useCallback((id: string, changes: Partial<JobApplication>) => {
    const now = new Date().toISOString();
    saveApplicationsFor(
      profileId,
      currentApplications(profileId).map((entry) => (entry.id === id ? { ...entry, ...changes, updatedAt: now } : entry))
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
    rejectedApplicationsCount,
    rejectedLegacyApplicationsCount,
    hasUnassignedLegacyApplications,
    claimLegacyApplications,
  };
}
