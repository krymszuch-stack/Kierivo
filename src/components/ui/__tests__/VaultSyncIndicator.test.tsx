import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const authState = vi.hoisted(() => ({ value: null as unknown }));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => authState.value,
}));

import { VaultSyncIndicator } from '../VaultSyncIndicator';

describe('VaultSyncIndicator', () => {
  it('pokazuje konflikt i wyjaśnia zachowanie lokalnego CV', () => {
    authState.value = {
      isAuthenticated: true,
      mode: 'cloud',
      vaultSyncStatus: 'conflict',
    };

    const markup = renderToStaticMarkup(<VaultSyncIndicator />);

    expect(markup).toContain('data-vault-sync-status="conflict"');
    expect(markup).toContain('Konflikt synchronizacji');
    expect(markup).toContain('Zachowaliśmy obie wersje');
    expect(markup).toContain('wybierz, którą zapisać');
  });

  it('nie pokazuje statusu konta osobie niezalogowanej', () => {
    authState.value = {
      isAuthenticated: false,
      mode: null,
      vaultSyncStatus: 'local',
    };

    expect(renderToStaticMarkup(<VaultSyncIndicator />)).toBe('');
  });
});
