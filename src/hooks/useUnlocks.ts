import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { JobApplication, MasterVault } from '../types';
import { UnlockState, deriveUnlocks } from '../lib/uxMilestones';
import {
  getMilestones,
  markShortcutsHintSeen,
  subscribeMilestones,
  syncMilestonesForProfile,
} from '../store/milestonesStore';

/**
 * Cienkie spięcie logiki odblokowań z Reactem.
 *
 * Cała decyzyjność siedzi w `src/lib/uxMilestones.ts` i jest tam przetestowana
 * bez DOM-u; utrwalanie w `src/store/milestonesStore.ts`. Tutaj zostaje samo
 * połączenie jednego z drugim.
 */
export interface UseUnlocksResult extends UnlockState {
  /** Odhacza jednorazową podpowiedź o skrótach klawiszowych. */
  dismissShortcutsHint: () => void;
}

export function useUnlocks(
  vault: MasterVault,
  applications: JobApplication[],
  profileId: string,
  vaultProfileId: string = profileId
): UseUnlocksResult {
  const subscribe = useCallback((listener: () => void) => subscribeMilestones(profileId, listener), [profileId]);
  const readSnapshot = useCallback(() => getMilestones(profileId), [profileId]);
  const milestones = useSyncExternalStore(subscribe, readSnapshot, readSnapshot);

  // Efekt wyłącznie zgłasza stan sklepowi. Nie ustawia stanu Reacta — o tym,
  // czy trzeba przerysować, decyduje sklep, gdy faktycznie coś dopisze.
  useEffect(() => {
    // Przy zmianie konta App może przez jeden render trzymać poprzedni Vault.
    // Nie zapisuj wtedy kamieni milowych starego profilu pod nowym ID.
    syncMilestonesForProfile(profileId, vaultProfileId, { vault, applications });
  }, [profileId, vaultProfileId, vault, applications]);

  const dismissShortcutsHint = useCallback(() => markShortcutsHintSeen(profileId), [profileId]);
  const unlocks = useMemo(() => deriveUnlocks(milestones), [milestones]);

  return { ...unlocks, dismissShortcutsHint };
}
