import type { MasterVault } from '../types';
import { CloudVaultConflictError, saveCloudVault } from './cloudVault';
import { cloudVaultOutboxKeyFor, cloudVaultRevisionKeyFor } from './cloudVaultKeys';
import { readJson, removeRaw, writeJson } from './storage';
import { parsePendingVaultEnvelope, parseStoredCloudVault } from './cloudVaultValidation';

export { cloudVaultOutboxKeyFor } from './cloudVaultKeys';

/** Stan pokazywany użytkownikowi przy utrwalaniu Master Vaultu. */
export type VaultSyncStatus = 'local' | 'pending' | 'cloud' | 'conflict' | 'unverified';

export interface PendingCloudVaultSave {
  ownerId: string;
  revision: number;
  queuedAt: string;
  /** Rewizja chmury, na której oparto ten snapshot; null oznacza brak wiersza. */
  baseUpdatedAt: string | null;
  /** Konflikt CAS wymaga świeżego odczytu; nie wolno ponawiać starego snapshotu. */
  conflict?: boolean;
  vault: MasterVault;
}

type CloudVaultSender = (
  vault: MasterVault,
  expectedOwnerId: string,
  expectedUpdatedAt: string | null
) => Promise<{ updatedAt: string } | void>;

type StatusListener = (status: VaultSyncStatus) => void;

const inFlight = new Map<string, Promise<VaultSyncStatus>>();
const runtimeStatus = new Map<string, VaultSyncStatus>();
const listeners = new Map<string, Set<StatusListener>>();
const flushSuspendedOwners = new Set<string>();

/** Blokuje wysyłkę, dopóki aplikacja nie scali lokalnego stanu z chmurą. */
export function suspendCloudVaultFlush(ownerId: string): void {
  flushSuspendedOwners.add(ownerId);
}

/** Odblokowuje kolejkę po potwierdzonym odczycie i scaleniu stanu właściciela. */
export function resumeCloudVaultFlush(ownerId: string): void {
  flushSuspendedOwners.delete(ownerId);
}

/** Odczyt nie potwierdził stanu konta; wskaźnik nie może twierdzić, że CV zapisano w chmurze. */
export function markCloudVaultUnverified(ownerId: string): void {
  publish(ownerId, 'unverified');
}

/** Po udanym bootstrapie kolejkuje cały scalony obraz przed odblokowaniem sieci. */
export async function completeCloudVaultBootstrap(
  ownerId: string,
  mergedVault: MasterVault,
  shouldUpload: boolean,
  remoteUpdatedAt: string | null,
  sender: CloudVaultSender = saveCloudVault,
): Promise<VaultSyncStatus> {
  if (hasInvalidPendingCloudVault(ownerId)) {
    publish(ownerId, 'pending');
    return 'pending';
  }
  if (getPendingCloudVault(ownerId)?.conflict) {
    publish(ownerId, 'conflict');
    return 'conflict';
  }
  writeJson(cloudVaultRevisionKeyFor(ownerId), remoteUpdatedAt);
  if (shouldUpload || getPendingCloudVault(ownerId)) {
    // Outbox mógł zmienić się w czasie odczytu; nowy pełny snapshot obejmuje
    // zarówno odczytaną chmurę, pending, jak i lokalne edycje z bootstrapu.
    enqueueCloudVaultSave(ownerId, mergedVault, {
      resetConflict: true,
      baseUpdatedAt: remoteUpdatedAt,
    });
  }
  resumeCloudVaultFlush(ownerId);
  return flushPendingCloudVault(ownerId, sender);
}

export function getPendingCloudVault(ownerId: string): PendingCloudVaultSave | null {
  const value = parsePendingVaultEnvelope(readJson<unknown>(cloudVaultOutboxKeyFor(ownerId), null), ownerId);
  if (!value) return null;
  return {
    ...value,
    baseUpdatedAt: value.baseUpdatedAt ?? readJson<string | null>(cloudVaultRevisionKeyFor(ownerId), null),
  };
}

/** Invalid pending data remains in storage and must never be mistaken for an empty queue. */
export function hasInvalidPendingCloudVault(ownerId: string): boolean {
  const raw = readJson<unknown>(cloudVaultOutboxKeyFor(ownerId), null);
  return raw !== null && parsePendingVaultEnvelope(raw, ownerId) === null;
}

function publish(ownerId: string, status: VaultSyncStatus): void {
  runtimeStatus.set(ownerId, status);
  listeners.get(ownerId)?.forEach((listener) => listener(status));
}

export function getCloudVaultSyncStatus(ownerId: string): VaultSyncStatus {
  if (hasInvalidPendingCloudVault(ownerId)) return 'pending';
  const pending = getPendingCloudVault(ownerId);
  if (pending?.conflict) return 'conflict';
  if (pending) return 'pending';
  return runtimeStatus.get(ownerId) ?? 'cloud';
}

export function subscribeCloudVaultSyncStatus(
  ownerId: string,
  listener: StatusListener
): () => void {
  const ownerListeners = listeners.get(ownerId) ?? new Set<StatusListener>();
  ownerListeners.add(listener);
  listeners.set(ownerId, ownerListeners);
  listener(getCloudVaultSyncStatus(ownerId));

  return () => {
    ownerListeners.delete(listener);
    if (ownerListeners.size === 0) listeners.delete(ownerId);
  };
}

/**
 * Najpierw zapisuje najnowszą wersję do trwałego, właścicielskiego outboxu.
 * Dopiero potem wolno próbować sieci. Dzięki temu zamknięcie karty, logout lub
 * utrata sieci nie zamieniają braku odpowiedzi HTTP w fałszywe „zapisano".
 */
export function enqueueCloudVaultSave(
  ownerId: string,
  vault: MasterVault,
  options: { resetConflict?: boolean; baseUpdatedAt?: string | null } = {},
): PendingCloudVaultSave {
  if (hasInvalidPendingCloudVault(ownerId)) {
    throw new Error('Lokalny zapis CV ma nieprawidłowy format i nie został nadpisany.');
  }
  const validVault = parseStoredCloudVault(vault);
  if (!validVault) throw new Error('Nie dodano CV do synchronizacji: snapshot ma nieprawidłowy format.');
  const previous = getPendingCloudVault(ownerId);
  const pending: PendingCloudVaultSave = {
    ownerId,
    revision: (previous?.revision ?? 0) + 1,
    queuedAt: new Date().toISOString(),
    baseUpdatedAt: options.baseUpdatedAt !== undefined
      ? options.baseUpdatedAt
      : previous?.baseUpdatedAt ?? readJson<string | null>(cloudVaultRevisionKeyFor(ownerId), null),
    ...(previous?.conflict && !options.resetConflict ? { conflict: true } : {}),
    vault: validVault,
  };

  writeJson(cloudVaultOutboxKeyFor(ownerId), pending);
  publish(ownerId, pending.conflict ? 'conflict' : 'pending');
  return pending;
}

/** Zachowuje snapshot lokalny jako konflikt bez próby automatycznej wysyłki. */
export function enqueueCloudVaultConflict(
  ownerId: string,
  vault: MasterVault,
  baseUpdatedAt: string | null,
): PendingCloudVaultSave {
  const queued = enqueueCloudVaultSave(ownerId, vault, { resetConflict: true, baseUpdatedAt });
  const conflict = { ...queued, conflict: true };
  writeJson(cloudVaultOutboxKeyFor(ownerId), conflict);
  publish(ownerId, 'conflict');
  return conflict;
}

/**
 * CAS conflict requires a visible user choice. Rebase only after the user
 * chooses which complete snapshot should replace the currently stored one.
 */
export async function resolvePendingCloudVaultConflict(
  ownerId: string,
  chosenVault: MasterVault,
  remoteUpdatedAt: string | null,
  sender: CloudVaultSender = saveCloudVault,
): Promise<VaultSyncStatus> {
  if (hasInvalidPendingCloudVault(ownerId)) {
    publish(ownerId, 'pending');
    return 'pending';
  }
  const pending = getPendingCloudVault(ownerId);
  if (!pending?.conflict) {
    throw new Error('Nie ma oczekującego konfliktu CV do rozstrzygnięcia.');
  }

  enqueueCloudVaultSave(ownerId, chosenVault, {
    resetConflict: true,
    baseUpdatedAt: remoteUpdatedAt,
  });
  resumeCloudVaultFlush(ownerId);
  return flushPendingCloudVault(ownerId, sender);
}

function networkLooksAvailable(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/**
 * Opróżnia outbox jednego właściciela. Wysyłki są serializowane per konto:
 * gdy A jest w locie, a użytkownik zapisze B, B zostaje w outboxie i leci
 * dopiero po A. Stara odpowiedź nie może więc usunąć ani nadpisać nowszej
 * wersji.
 */
export function flushPendingCloudVault(
  ownerId: string,
  sender: CloudVaultSender = saveCloudVault
): Promise<VaultSyncStatus> {
  if (hasInvalidPendingCloudVault(ownerId)) {
    publish(ownerId, 'pending');
    return Promise.resolve('pending');
  }
  if (flushSuspendedOwners.has(ownerId)) {
    const status = getCloudVaultSyncStatus(ownerId);
    publish(ownerId, status);
    return Promise.resolve(status);
  }

  const existing = inFlight.get(ownerId);
  if (existing) return existing;

  if (!networkLooksAvailable()) {
    const status = getCloudVaultSyncStatus(ownerId);
    publish(ownerId, status);
    return Promise.resolve(status);
  }

  const task = (async (): Promise<VaultSyncStatus> => {
    while (networkLooksAvailable()) {
      const pending = getPendingCloudVault(ownerId);
      if (!pending) {
        publish(ownerId, 'cloud');
        return 'cloud';
      }
      if (pending.conflict) {
        publish(ownerId, 'conflict');
        return 'conflict';
      }

      let confirmation: { updatedAt: string } | void;
      try {
        confirmation = await sender(pending.vault, ownerId, pending.baseUpdatedAt);
      } catch (error) {
        if (error instanceof CloudVaultConflictError) {
          writeJson(cloudVaultOutboxKeyFor(ownerId), { ...pending, conflict: true });
          publish(ownerId, 'conflict');
          return 'conflict';
        }
        // Brak potwierdzenia = nadal oczekuje. Niczego nie kasujemy. Kolejna
        // próba nastąpi po nowym zapisie, zdarzeniu online lub ponownym wejściu.
        publish(ownerId, 'pending');
        return 'pending';
      }

      // W czasie żądania mogła pojawić się nowsza rewizja. Usuwamy wyłącznie
      // dokładnie tę, którą serwer właśnie potwierdził.
      const latest = getPendingCloudVault(ownerId);
      if (latest?.revision === pending.revision) {
        removeRaw(cloudVaultOutboxKeyFor(ownerId));
        if (confirmation?.updatedAt) writeJson(cloudVaultRevisionKeyFor(ownerId), confirmation.updatedAt);
      } else if (latest && confirmation?.updatedAt) {
        // A zatwierdziła się przed nowszym B z tej samej karty: B może teraz
        // bezpiecznie porównać się z rewizją utworzoną przez ACK dla A.
        writeJson(cloudVaultOutboxKeyFor(ownerId), {
          ...latest,
          baseUpdatedAt: confirmation.updatedAt,
        });
      }

      // Jeśli latest był nowszy, pętla wyśle go jako następny. Jeśli właśnie
      // usunęliśmy potwierdzoną rewizję, kolejny obrót ustawi stan cloud.
    }

    publish(ownerId, 'pending');
    return 'pending';
  })();

  inFlight.set(ownerId, task);
  void task.finally(() => inFlight.delete(ownerId));
  return task;
}
