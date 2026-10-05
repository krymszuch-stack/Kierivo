import type { MasterVault } from '../types';
import { CURRENT_DATA_SCHEMA_VERSION, migrateVault } from './dataMigration';
import { parseMasterVaultImport } from './masterVaultImportSchema';

/** Current-schema snapshots must already be complete; migration must not repair them into a different CV. */
export function parseStoredCloudVault(value: unknown): MasterVault | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  if (record.schemaVersion === CURRENT_DATA_SCHEMA_VERSION) {
    return parseMasterVaultImport(value);
  }

  return parseMasterVaultImport(migrateVault(value));
}

export interface ValidatedPendingVaultEnvelope {
  ownerId: string;
  revision: number;
  queuedAt: string;
  conflict?: boolean;
  baseUpdatedAt?: string | null;
  vault: MasterVault;
}

export function parsePendingVaultEnvelope(value: unknown, ownerId: string): ValidatedPendingVaultEnvelope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const vault = parseStoredCloudVault(candidate.vault);
  if (
    candidate.ownerId !== ownerId ||
    typeof candidate.revision !== 'number' || !Number.isInteger(candidate.revision) || candidate.revision < 1 ||
    typeof candidate.queuedAt !== 'string' ||
    !(candidate.baseUpdatedAt === undefined || candidate.baseUpdatedAt === null || typeof candidate.baseUpdatedAt === 'string') ||
    !(candidate.conflict === undefined || typeof candidate.conflict === 'boolean') ||
    !vault
  ) return null;

  return {
    ownerId,
    revision: candidate.revision,
    queuedAt: candidate.queuedAt,
    ...(candidate.conflict === true ? { conflict: true } : {}),
    ...(candidate.baseUpdatedAt !== undefined ? { baseUpdatedAt: candidate.baseUpdatedAt as string | null } : {}),
    vault,
  };
}
