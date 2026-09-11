import React from 'react';
import { useAuth } from '../../context/AuthContext';

const LABELS = {
  local: 'Zapisane lokalnie',
  pending: 'Oczekuje na chmurę',
  cloud: 'Zapisane w chmurze',
} as const;

/**
 * Mały, stały wskaźnik prawdy o zapisie. Nie wyprowadza wniosku z pagehide ani
 * samego wywołania requestu: stan `cloud` pojawia się dopiero po potwierdzeniu
 * kolejki, a `pending` przeżywa restart dzięki trwałemu outboxowi.
 */
export const VaultSyncIndicator: React.FC = () => {
  const { isAuthenticated, mode, vaultSyncStatus } = useAuth();
  if (!isAuthenticated) return null;

  const status = mode === 'local' ? 'local' : vaultSyncStatus;

  return (
    <div
      className="pointer-events-none fixed right-4 top-20 z-20 rounded-lg border border-line bg-elevated/95 px-2.5 py-1.5 text-[10px] font-medium text-muted shadow-xs backdrop-blur sm:right-6"
      role="status"
      aria-live="polite"
      data-vault-sync-status={status}
    >
      {LABELS[status]}
    </div>
  );
};
