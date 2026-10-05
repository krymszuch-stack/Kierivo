import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MasterVault } from '../../types';
import { createEmptyVault } from '../sampleVault';
import {
  enqueueCloudVaultSave,
  enqueueCloudVaultConflict,
  completeCloudVaultBootstrap,
  flushPendingCloudVault,
  getCloudVaultSyncStatus,
  getPendingCloudVault,
  resolvePendingCloudVaultConflict,
  resumeCloudVaultFlush,
  suspendCloudVaultFlush,
} from '../cloudVaultOutbox';
import { resetLastGoodCache } from '../storage';
import { MemoryStorage } from './helpers/memoryStorage';
import { CloudVaultConflictError } from '../cloudVault';
import { cloudVaultOutboxKeyFor } from '../cloudVaultKeys';
import { writeJson } from '../storage';
import { hasInvalidPendingCloudVault, markCloudVaultUnverified } from '../cloudVaultOutbox';

describe('cloudVaultOutbox', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new MemoryStorage(),
      writable: true,
      configurable: true,
    });
    resetLastGoodCache();
  });

  it('zachowuje niepotwierdzony zapis po błędzie i usuwa go dopiero po ACK', async () => {
    const ownerId = 'owner-a';
    const vault = createEmptyVault('Anna Offline', 'anna@example.pl');
    enqueueCloudVaultSave(ownerId, vault);

    const failedSender = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(flushPendingCloudVault(ownerId, failedSender)).resolves.toBe('pending');

    expect(getPendingCloudVault(ownerId)?.vault.personalInfo.fullName).toBe('Anna Offline');
    expect(getCloudVaultSyncStatus(ownerId)).toBe('pending');

    const confirmedSender = vi.fn().mockResolvedValue(undefined);
    await expect(flushPendingCloudVault(ownerId, confirmedSender)).resolves.toBe('cloud');

    expect(getPendingCloudVault(ownerId)).toBeNull();
    expect(getCloudVaultSyncStatus(ownerId)).toBe('cloud');
  });

  it('przechowuje konflikt pierwszego logowania bez uruchamiania wysyłki', () => {
    const ownerId = 'owner-first-login-conflict';
    const local = createEmptyVault('Lokalny snapshot');

    const pending = enqueueCloudVaultConflict(ownerId, local, 'rev-remote');

    expect(pending.conflict).toBe(true);
    expect(pending.baseUpdatedAt).toBe('rev-remote');
    expect(getPendingCloudVault(ownerId)?.vault.personalInfo.fullName).toBe('Lokalny snapshot');
    expect(getCloudVaultSyncStatus(ownerId)).toBe('conflict');
  });

  it('serializuje szybkie A/B i nie pozwala staremu ACK skasować nowszej wersji', async () => {
    const ownerId = 'owner-sequence';
    const a = createEmptyVault('Wersja A', 'a@example.pl');
    const b = createEmptyVault('Wersja B', 'b@example.pl');

    let confirmA: ((ack: { updatedAt: string }) => void) | undefined;
    const sender = vi.fn((vault: MasterVault, _ownerId: string, _baseUpdatedAt: string | null): Promise<{ updatedAt: string }> => {
      if (vault.personalInfo.fullName === 'Wersja A') {
        return new Promise<{ updatedAt: string }>((resolve) => {
          confirmA = resolve;
        });
      }
      return Promise.resolve({ updatedAt: 'rev-3' });
    });

    enqueueCloudVaultSave(ownerId, a);
    const flushing = flushPendingCloudVault(ownerId, sender);
    await Promise.resolve();

    enqueueCloudVaultSave(ownerId, b);
    expect(getPendingCloudVault(ownerId)?.vault.personalInfo.fullName).toBe('Wersja B');

    confirmA?.({ updatedAt: 'rev-2' });
    await expect(flushing).resolves.toBe('cloud');

    expect(sender).toHaveBeenCalledTimes(2);
    expect(sender.mock.calls.map(([vault]) => vault.personalInfo.fullName)).toEqual([
      'Wersja A',
      'Wersja B',
    ]);
    expect(sender.mock.calls[1][2]).toBe('rev-2');
    expect(getPendingCloudVault(ownerId)).toBeNull();
  });

  it('zachowuje konflikt między urządzeniami i nie ponawia starego snapshotu', async () => {
    const ownerId = 'owner-conflict';
    const local = createEmptyVault('Lokalna kopia');
    enqueueCloudVaultSave(ownerId, local);
    const sender = vi.fn().mockRejectedValue(new CloudVaultConflictError());

    await expect(flushPendingCloudVault(ownerId, sender)).resolves.toBe('conflict');
    expect(getCloudVaultSyncStatus(ownerId)).toBe('conflict');
    expect(getPendingCloudVault(ownerId)?.vault.personalInfo.fullName).toBe('Lokalna kopia');

    await expect(flushPendingCloudVault(ownerId, sender)).resolves.toBe('conflict');
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it('bootstrap świeżej rewizji nie kasuje konfliktu ani nie wysyła bez wyboru użytkownika', async () => {
    const ownerId = 'owner-conflict-refresh';
    const local = createEmptyVault('Zachowana praca');
    enqueueCloudVaultSave(ownerId, local);
    await flushPendingCloudVault(ownerId, vi.fn().mockRejectedValue(new CloudVaultConflictError()));

    const sender = vi.fn().mockResolvedValue({ updatedAt: 'rev-3' });
    await expect(completeCloudVaultBootstrap(
      ownerId,
      createEmptyVault('Scalona praca'),
      true,
      'rev-2',
      sender,
    )).resolves.toBe('conflict');

    expect(sender).not.toHaveBeenCalled();
    expect(getPendingCloudVault(ownerId)?.vault.personalInfo.fullName).toBe('Zachowana praca');
    expect(getCloudVaultSyncStatus(ownerId)).toBe('conflict');
  });

  it('czeka na jawny wybór snapshotu i dopiero wtedy rebaseuje konflikt', async () => {
    const ownerId = 'owner-explicit-conflict';
    const local = createEmptyVault('Lokalna poprawka');
    const remote = createEmptyVault('Zdalna poprawka');
    enqueueCloudVaultSave(ownerId, local);
    await flushPendingCloudVault(ownerId, vi.fn().mockRejectedValue(new CloudVaultConflictError()));

    const sender = vi.fn().mockResolvedValue({ updatedAt: 'rev-3' });
    await expect(resolvePendingCloudVaultConflict(ownerId, remote, 'rev-2', sender)).resolves.toBe('cloud');

    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0][0].personalInfo.fullName).toBe('Zdalna poprawka');
    expect(sender.mock.calls[0][2]).toBe('rev-2');
    expect(getPendingCloudVault(ownerId)).toBeNull();
  });

  it('izoluje oczekujące wersje między właścicielami', async () => {
    const a = createEmptyVault('Profil A', 'a@example.pl');
    const b = createEmptyVault('Profil B', 'b@example.pl');

    enqueueCloudVaultSave('owner-a', a);
    enqueueCloudVaultSave('owner-b', b);

    await flushPendingCloudVault('owner-a', vi.fn().mockResolvedValue(undefined));

    expect(getPendingCloudVault('owner-a')).toBeNull();
    expect(getPendingCloudVault('owner-b')?.vault.personalInfo.fullName).toBe('Profil B');
  });

  it('odtwarza oczekującą wersję z trwałego storage po utracie pamięci procesu', () => {
    const ownerId = 'owner-reopen';
    const vault = createEmptyVault('Po ponownym otwarciu', 'persist@example.pl');
    enqueueCloudVaultSave(ownerId, vault);

    // Symulacja ponownego otwarcia: kasujemy wyłącznie pamięć ostatniego dobrego
    // odczytu. localStorage zostaje, tak jak po zamknięciu i otwarciu aplikacji.
    resetLastGoodCache();

    const restored = getPendingCloudVault(ownerId);
    expect(restored?.ownerId).toBe(ownerId);
    expect(restored?.vault.personalInfo.fullName).toBe('Po ponownym otwarciu');
    expect(getCloudVaultSyncStatus(ownerId)).toBe('pending');
  });

  it('zachowuje i blokuje niepoprawny pending zamiast uznać pustą kolejkę', async () => {
    const ownerId = 'owner-malformed-outbox';
    const malformed = createEmptyVault('Uszkodzony snapshot');
    malformed.schemaVersion = 1;
    malformed.history = [{ id: 'bad' } as never];
    const pending = { ownerId, revision: 1, queuedAt: new Date().toISOString(), baseUpdatedAt: null, vault: malformed };
    writeJson(cloudVaultOutboxKeyFor(ownerId), pending);
    const sender = vi.fn().mockResolvedValue({ updatedAt: 'rev-2' });

    expect(hasInvalidPendingCloudVault(ownerId)).toBe(true);
    expect(getCloudVaultSyncStatus(ownerId)).toBe('pending');
    await expect(flushPendingCloudVault(ownerId, sender)).resolves.toBe('pending');
    expect(sender).not.toHaveBeenCalled();
    expect(localStorage.getItem(cloudVaultOutboxKeyFor(ownerId))).not.toBeNull();
    expect(() => enqueueCloudVaultSave(ownerId, createEmptyVault('Nowy snapshot')))
      .toThrow('nie został nadpisany');
  });

  it('nie zmienia błędnego odczytu w fałszywe potwierdzenie przy wstrzymanej synchronizacji', async () => {
    const ownerId = 'owner-unverified-cloud';
    suspendCloudVaultFlush(ownerId);
    markCloudVaultUnverified(ownerId);

    await expect(flushPendingCloudVault(ownerId, vi.fn())).resolves.toBe('unverified');
    expect(getCloudVaultSyncStatus(ownerId)).toBe('unverified');
  });

  it('nie wysyła outboxu przed zakończeniem scalenia z chmurą', async () => {
    const ownerId = 'owner-bootstrap';
    enqueueCloudVaultSave(ownerId, createEmptyVault('Kopia offline'));
    const sender = vi.fn().mockResolvedValue(undefined);
    suspendCloudVaultFlush(ownerId);

    await expect(flushPendingCloudVault(ownerId, sender)).resolves.toBe('pending');
    expect(sender).not.toHaveBeenCalled();
    expect(getPendingCloudVault(ownerId)?.vault.personalInfo.fullName).toBe('Kopia offline');

    resumeCloudVaultFlush(ownerId);
    await expect(flushPendingCloudVault(ownerId, sender)).resolves.toBe('cloud');
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it('wysyła scalony snapshot bootstrapu zamiast starego pendingu', async () => {
    const ownerId = 'owner-merged-bootstrap';
    const stale = createEmptyVault('Stary pending');
    const merged = createEmptyVault('Scalony profil');
    merged.skillsMatrix.hardSkills = ['Windows 11', 'Linux'];
    enqueueCloudVaultSave(ownerId, stale);
    suspendCloudVaultFlush(ownerId);
    const sender = vi.fn().mockResolvedValue(undefined);

    await expect(completeCloudVaultBootstrap(ownerId, merged, false, 'rev-1', sender)).resolves.toBe('cloud');

    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0][0].personalInfo.fullName).toBe('Scalony profil');
    expect(sender.mock.calls[0][0].skillsMatrix.hardSkills).toEqual(['Windows 11', 'Linux']);
    expect(getPendingCloudVault(ownerId)).toBeNull();
  });
});
