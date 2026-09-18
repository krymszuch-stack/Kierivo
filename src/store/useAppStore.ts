import { useState, useEffect, useCallback } from 'react';
import { NavTabId } from '../components/GlobalShell';
import { StorageKeys, readRaw, readJson, registerKeyMigration, writeJson } from '../lib/storage';

/**
 * Stan interfejsu: co jest otwarte i która zakładka jest aktywna.
 *
 * Świadomie **nie ma tu nic o użytkowniku**. Był tu wcześniej `UserSession`
 * zapisywany do `localStorage` — trzecie źródło prawdy o tożsamości, obok
 * `AuthContext` i sklepu z uprawnieniami. Nic go nie czytało, ale samo jego
 * istnienie już raz doprowadziło do rozjazdu opisanego w `AuthContext.tsx`:
 * modal logowania zapisywał użytkownika w jednym miejscu, a pasek górny czytał
 * go z innego i dalej pokazywał „Zaloguj się".
 *
 * Kto korzysta z aplikacji, wie wyłącznie `src/context/AuthContext.tsx`.
 */
interface AppStoreState {
  activeTab: NavTabId;
  sidebarCollapsed: boolean;
  isAdvisorOpen: boolean;
  isAuthModalOpen: boolean;
  isDesignTokensOpen: boolean;
  isVoiceLabOpen: boolean;
  advisorInitialQuestion?: string;
  /**
   * Aplikacja wskazana przez rekomendację „następnego kroku" — Pipeline
   * podświetla jej wiersz. Stan przejściowy (nie persystowany): po chwili
   * i tak znika, a zapisywanie podświetlenia nie ma sensu.
   */
  highlightedApplicationId?: string | null;
}

// In-memory global state subscribers for zero-dependency store
let globalState: AppStoreState = {
  activeTab: 'home',
  sidebarCollapsed: readInitialSidebarCollapsed(),
  isAdvisorOpen: false,
  isAuthModalOpen: false,
  isDesignTokensOpen: false,
  isVoiceLabOpen: false,
  advisorInitialQuestion: undefined,
  highlightedApplicationId: null,
};

/**
 * Preferencje paska bocznego w wersjonowanej kopercie.
 *
 * v2 (obecna): obiekt `{ collapsed }` w standardowej kopercie storage.ts
 * (suma kontrola + wersja). v1: surowy string `true`/`false` sprzed
 * wprowadzenia kopert — migracja czyta go przed pierwszym zapisem v2 i po
 * niej użytkownik nie traci ustawienia zwinięcia.
 */
interface SidebarPrefsV2 {
  collapsed: boolean;
}

function readInitialSidebarCollapsed(): boolean {
  const legacy = readRaw(StorageKeys.sidebarCollapsed);
  if (legacy === null) {
    return typeof window !== 'undefined' && window.innerWidth >= 1024 && window.innerWidth < 1280;
  }

  // Koperta v2? readJson załatwia CRC i migracje. Surowy „true"/„false"? To v1.
  const parsed = readJson<SidebarPrefsV2 | null>(StorageKeys.sidebarCollapsed, null);
  if (parsed && typeof parsed.collapsed === 'boolean') return parsed.collapsed;

  return legacy.trim() === 'true';
}

registerKeyMigration(StorageKeys.sidebarCollapsed, {
  // 1 → 2: dane przychodziły jako surowy boolean-string; normalizujemy do
  // kształtu v2. (Odczyt v1 łapie też gałąź powyżej, więc to siatka
  // bezpieczeństwa dla kopert starszych niż obecny kod.)
  1: (data) => ({ collapsed: data === true || data === 'true' }),
});

/**
 * Ostatni poprawny stan preferencji — referencja trzymana obok globalState.
 * `revertState()` wraca do niej, gdy świeży zapis/odczyt okaże się niepoprawny;
 * bez tej kopii revert nie miałby się do czego przywrócić.
 */
let lastGoodPrefs: SidebarPrefsV2 = { collapsed: globalState.sidebarCollapsed };

/**
 * Transakcyjny powrot do ostatniego poprawnego stanu utrwalanych preferencji.
 *
 * Scenariusz użycia: odczyt z koperty z niezgodną sumą kontrolną (ucięty zapis)
 * albo przyszła wersja schematu, której ten kod nie rozumie. Zamiast działać na
 * wymyślonych wartościach domyślnych, sklep cofa się do ostatniego stanu, który
 * przeszedł walidację, i powiadamia subskrybentów — spójnie z tym, jak
 * `storage.ts` reveruje vault przez pamięć `lastGood`.
 */
export function revertState(): void {
  if (globalState.sidebarCollapsed === lastGoodPrefs.collapsed) return;

  globalState = { ...globalState, sidebarCollapsed: lastGoodPrefs.collapsed };
  listeners.forEach((listener) => listener());
}

const listeners = new Set<() => void>();

function setStoreState(updater: Partial<AppStoreState> | ((prev: AppStoreState) => Partial<AppStoreState>)) {
  const nextPartial = typeof updater === 'function' ? updater(globalState) : updater;
  globalState = { ...globalState, ...nextPartial };

  if (nextPartial.sidebarCollapsed !== undefined) {
    const prefs: SidebarPrefsV2 = { collapsed: globalState.sidebarCollapsed };
    writeJson(StorageKeys.sidebarCollapsed, prefs);
    // Dopiero po udanym zapisie stan staje się „ostatnim poprawnym".
    lastGoodPrefs = prefs;
  }

  listeners.forEach((listener) => listener());
}

export function setAuthModalOpenGlobal(isAuthModalOpen: boolean): void {
  setStoreState({ isAuthModalOpen });
}

export function getAppStoreState(): AppStoreState {
  return globalState;
}

export function useAppStore() {
  const [state, setState] = useState<AppStoreState>(globalState);

  useEffect(() => {
    const listener = () => setState(globalState);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setActiveTab = useCallback((activeTab: NavTabId) => {
    setStoreState({ activeTab });
  }, []);

  const toggleSidebar = useCallback(() => {
    setStoreState((prev) => ({ sidebarCollapsed: !prev.sidebarCollapsed }));
  }, []);

  const setSidebarCollapsed = useCallback((sidebarCollapsed: boolean) => {
    setStoreState({ sidebarCollapsed });
  }, []);

  const setAdvisorOpen = useCallback((isAdvisorOpen: boolean, advisorInitialQuestion?: string) => {
    setStoreState({ isAdvisorOpen, advisorInitialQuestion });
  }, []);

  const setAuthModalOpen = useCallback((isAuthModalOpen: boolean) => {
    setStoreState({ isAuthModalOpen });
  }, []);

  const setDesignTokensOpen = useCallback((isDesignTokensOpen: boolean) => {
    setStoreState({ isDesignTokensOpen });
  }, []);

  const setVoiceLabOpen = useCallback((isVoiceLabOpen: boolean) => {
    setStoreState({ isVoiceLabOpen });
  }, []);

  const setHighlightedApplicationId = useCallback((highlightedApplicationId: string | null) => {
    setStoreState({ highlightedApplicationId });
  }, []);

  return {
    ...state,
    setActiveTab,
    toggleSidebar,
    setSidebarCollapsed,
    setAdvisorOpen,
    setAuthModalOpen,
    setDesignTokensOpen,
    setVoiceLabOpen,
    setHighlightedApplicationId,
  };
}
