import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyVault } from '../sampleVault';
import {
  enqueueCloudVaultSave,
  flushPendingCloudVault,
  getCloudVaultSyncStatus,
  getPendingCloudVault,
} from '../cloudVaultOutbox';
import { resetLastGoodCache } from '../storage';
import { MemoryStorage } from './helpers/memoryStorage';

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

  it('serializuje szybkie A/B i nie pozwala staremu ACK skasować nowszej wersji', async () => {
    const ownerId = 'owner-sequence';
    const a = createEmptyVault('Wersja A', 'a@example.pl');
    const b = createEmptyVault('Wersja B', 'b@example.pl');

    let confirmA: (() => void) | undefined;
    const sender = vi.fn((vault) => {
      if (vault.personalInfo.fullName === 'Wersja A') {
        return new Promise<void>((resolve) => {
          confirmA = resolve;
        });
      }
      return Promise.resolve();
    });

    enqueueCloudVaultSave(ownerId, a);
    const flushing = flushPendingCloudVault(ownerId, sender);
    await Promise.resolve();

    enqueueCloudVaultSave(ownerId, b);
    expect(getPendingCloudVault(ownerId)?.vault.personalInfo.fullName).toBe('Wersja B');

    confirmA?.();
    await expect(flushing).resolves.toBe('cloud');

    expect(sender).toHaveBeenCalledTimes(2);
    expect(sender.mock.calls.map(([vault]) => vault.personalInfo.fullName)).toEqual([
      'Wersja A',
      'Wersja B',
    ]);
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
});
