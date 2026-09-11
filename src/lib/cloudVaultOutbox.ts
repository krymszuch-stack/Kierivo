import type { MasterVault } from '../types';
import { saveCloudVault } from './cloudVault';
import { readJson, removeRaw, writeJson } from './storage';

/** Stan pokazywany użytkownikowi przy utrwalaniu Master Vaultu. */
export type VaultSyncStatus = 'local' | 'pending' | 'cloud';

export interface PendingCloudVaultSave {
  ownerId: string;
  revision: number;
  queuedAt: string;
  vault: MasterVault;
}

type CloudVaultSender = (
  vault: MasterVault,
  expectedOwnerId: string
) => Promise<unknown>;

type StatusListener = (status: VaultSyncStatus) => void;

const OUTBOX_PREFIX = 'cvelocity:cloud-vault-outbox';
const inFlight = new Map<string, Promise<VaultSyncStatus>>();
const runtimeStatus = new Map<string, VaultSyncStatus>();
const listeners = new Map<string, Set<StatusListener>>();

export function cloudVaultOutboxKeyFor(ownerId: string): string {
  return `${OUTBOX_PREFIX}:${ownerId}`;
}

function isPendingSave(value: unknown, ownerId: string): value is PendingCloudVaultSave {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PendingCloudVaultSave>;
  return (
    candidate.ownerId === ownerId &&
    typeof candidate.revision === 'number' &&
    candidate.revision > 0 &&
    typeof candidate.queuedAt === 'string' &&
    Boolean(candidate.vault && typeof candidate.vault === 'object')
  );
}

export function getPendingCloudVault(ownerId: string): PendingCloudVaultSave | null {
  const value = readJson<PendingCloudVaultSave | null>(cloudVaultOutboxKeyFor(ownerId), null);
  return isPendingSave(value, ownerId) ? value : null;
}

function publish(ownerId: string, status: VaultSyncStatus): void {
  runtimeStatus.set(ownerId, status);
  listeners.get(ownerId)?.forEach((listener) => listener(status));
}

export function getCloudVaultSyncStatus(ownerId: string): VaultSyncStatus {
  if (getPendingCloudVault(ownerId)) return 'pending';
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
  vault: MasterVault
): PendingCloudVaultSave {
  const previous = getPendingCloudVault(ownerId);
  const pending: PendingCloudVaultSave = {
    ownerId,
    revision: (previous?.revision ?? 0) + 1,
    queuedAt: new Date().toISOString(),
    vault,
  };

  writeJson(cloudVaultOutboxKeyFor(ownerId), pending);
  publish(ownerId, 'pending');
  return pending;
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
  const existing = inFlight.get(ownerId);
  if (existing) return existing;

  if (!networkLooksAvailable()) {
    publish(ownerId, getPendingCloudVault(ownerId) ? 'pending' : 'cloud');
    return Promise.resolve(getPendingCloudVault(ownerId) ? 'pending' : 'cloud');
  }

  const task = (async (): Promise<VaultSyncStatus> => {
    while (networkLooksAvailable()) {
      const pending = getPendingCloudVault(ownerId);
      if (!pending) {
        publish(ownerId, 'cloud');
        return 'cloud';
      }

      try {
        await sender(pending.vault, ownerId);
      } catch {
        // Brak potwierdzenia = nadal oczekuje. Niczego nie kasujemy.
        publish(ownerId, 'pending');
        return 'pending';
      }

      // W czasie żądania mogła pojawić się nowsza rewizja. Usuwamy wyłącznie
      // dokładnie tę, którą serwer właśnie potwierdził.
      const latest = getPendingCloudVault(ownerId);
      if (latest?.revision === pending.revision) {
        removeRaw(cloudVaultOutboxKeyFor(ownerId));
      }

      // Jeśli latest był nowszy, pętla wyśle go jako następny. Jeśli właśnie
      // usunęliśmy potwierdzoną rewizję, kolejny obrót ustawi stan cloud.
    }

    publish(ownerId, 'pending');
    return 'pending';
  })();

  inFlight.set(ownerId, task);

  void task.finally(() => {
    inFlight.delete(ownerId);
    // Domyka bardzo wąski wyścig: nowa wersja może zostać zakolejkowana między
    // ostatnim odczytem outboxu a zakończeniem taska. Nie zostawiamy jej wtedy
    // do następnego restartu lub zdarzenia online.
    if (getPendingCloudVault(ownerId) && networkLooksAvailable()) {
      void flushPendingCloudVault(ownerId, sender);
    }
  });

  return task;
}
