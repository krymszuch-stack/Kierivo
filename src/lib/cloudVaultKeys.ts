import { StorageKeys } from './storage';

export function cloudVaultOutboxKeyFor(ownerId: string): string {
  return `${StorageKeys.cloudVaultOutbox}:${ownerId}`;
}

export function cloudVaultRevisionKeyFor(ownerId: string): string {
  return `${StorageKeys.cloudVaultRevision}:${ownerId}`;
}
