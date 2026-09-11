import React from 'react';
import { Shell, ShellProps } from './layout/Shell';
import { PasswordRecoveryModal } from '../features/auth/PasswordRecoveryModal';

/**
 * Typ zakładek pochodzi z `src/lib/navigation.ts`, razem z etykietami i podpowiedziami
 * — po to, żeby nie dało się dodać sekcji do typu i zapomnieć o niej w menu.
 * Re-eksport zostaje, bo pół aplikacji importuje `NavTabId` stąd.
 */
export type { NavTabId, NavSectionId } from '../lib/navigation';

export type GlobalShellProps = ShellProps;

export const GlobalShell: React.FC<GlobalShellProps> = (props) => {
  return (
    <>
      <Shell {...props} />
      <PasswordRecoveryModal />
    </>
  );
};

export { Shell } from './layout/Shell';
export { Sidebar } from './layout/Sidebar';
export { Topbar } from './layout/Topbar';
export { NavItem } from './layout/NavItem';
