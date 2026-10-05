import React from 'react';
import { useAuth } from '../../context/AuthContext';

const LABELS = {
  local: 'Zapisane lokalnie',
  pending: 'Oczekuje na chmurę',
  cloud: 'Zapisane w chmurze',
  conflict: 'Konflikt synchronizacji',
  unverified: 'Niepotwierdzony stan chmury',
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
      className={`fixed right-4 top-20 z-20 rounded-lg border bg-elevated/95 px-2.5 py-1.5 text-[10px] font-medium shadow-xs backdrop-blur sm:right-6 ${
        status === 'conflict' || status === 'unverified' ? 'border-amber-500/50 text-amber-700' : 'border-line text-muted'
      }`}
      role="status"
      aria-live="polite"
      aria-label={status === 'conflict'
        ? `${LABELS[status]}. Zachowaliśmy obie wersje; wybierz, którą zapisać.`
        : LABELS[status]}
      data-vault-sync-status={status}
      title={status === 'conflict'
        ? 'Lokalne CV zachowano. Chmura zmieniła się na innym urządzeniu; nie nadpisaliśmy jej automatycznie.'
        : status === 'unverified'
          ? 'Nie udało się odczytać stanu konta. Nie potwierdziliśmy, że bieżące CV jest zapisane w chmurze.'
        : undefined}
    >
      {LABELS[status]}
    </div>
  );
};
