const CLOUD_VAULT_OUTBOX_PREFIX = 'cvelocity:cloud-vault-outbox';

export function cloudVaultOutboxKeyFor(ownerId: string): string {
  return `${CLOUD_VAULT_OUTBOX_PREFIX}:${ownerId}`;
}
