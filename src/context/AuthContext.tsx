import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  LocalProfile,
  getActiveProfile,
  createLocalProfile,
  signOutLocalProfile,
  deleteLocalProfile,
  loadProfileVault,
  saveProfileVault,
  ANONYMOUS_PROFILE_ID,
} from '../lib/localProfile';
import { MasterVault } from '../types';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import { authErrorMessage } from '../lib/authErrors';
import { removeRaw, vaultKeyFor } from '../lib/storage';
import { showToast } from '../store/useToastStore';
import { setAccessTokenProvider } from '../lib/apiClient';
import {
  cloudVaultOutboxKeyFor,
  enqueueCloudVaultSave,
  flushPendingCloudVault,
  getCloudVaultSyncStatus,
  subscribeCloudVaultSyncStatus,
  type VaultSyncStatus,
} from '../lib/cloudVaultOutbox';

export type AuthMode = 'local' | 'cloud';

export interface AuthActionResult {
  ok: boolean;
  message: string;
  needsEmailConfirmation?: boolean;
}

interface AuthContextType {
  user: LocalProfile | null;
  isAuthenticated: boolean;
  mode: AuthMode | null;
  session: Session | null;
  cloudAvailable: boolean;
  userVault: MasterVault | null;
  /** Rzeczywisty stan trwałości bieżącego CV. */
  vaultSyncStatus: VaultSyncStatus;

  signInLocally: (name: string, email?: string) => MasterVault;
  signUpCloud: (email: string, password: string, displayName: string) => Promise<AuthActionResult>;
  signInCloud: (email: string, password: string) => Promise<AuthActionResult>;
  signInWithGoogle: () => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  resendConfirmation: (email: string) => Promise<AuthActionResult>;

  logout: () => Promise<void>;
  deleteAccount: () => Promise<AuthActionResult>;
  saveUserVault: (vault: MasterVault) => void;
  saveCurrentVault: (vault: MasterVault) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CHMURA_NIESKONFIGUROWANA = 'Konta w chmurze nie są tu skonfigurowane.';

function redirectTarget(): string {
  return `${window.location.origin}/`;
}

function profileFromSession(session: Session): LocalProfile {
  const meta = session.user.user_metadata as { display_name?: string } | undefined;
  const email = session.user.email ?? '';
  return {
    id: session.user.id,
    name: meta?.display_name?.trim() || email.split('@')[0] || 'Użytkownik',
    email,
    createdAt: session.user.created_at ?? new Date().toISOString(),
  };
}

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  onVaultLoaded?: (vault: MasterVault) => void;
}> = ({ children, onVaultLoaded }) => {
  const [user, setUser] = useState<LocalProfile | null>(() => getActiveProfile());
  const [mode, setMode] = useState<AuthMode | null>(() => (getActiveProfile() ? 'local' : null));
  const [session, setSession] = useState<Session | null>(null);
  const [userVault, setUserVault] = useState<MasterVault | null>(() => {
    const active = getActiveProfile();
    return active ? loadProfileVault(active.id) : null;
  });
  const [vaultSyncStatus, setVaultSyncStatus] = useState<VaultSyncStatus>('local');

  const supabase = getSupabaseBrowserClient();
  const cloudAvailable = supabase !== null;

  useEffect(() => {
    if (supabase) {
      setAccessTokenProvider(async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      });
    } else {
      setAccessTokenProvider(() => null);
    }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active || !data.session) return;
      const profile = profileFromSession(data.session);
      setSession(data.session);
      setUser(profile);
      setMode('cloud');
      setVaultSyncStatus(getCloudVaultSyncStatus(profile.id));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      if (nextSession) {
        const profile = profileFromSession(nextSession);
        setSession(nextSession);
        setUser(profile);
        setMode('cloud');
        setVaultSyncStatus(getCloudVaultSyncStatus(profile.id));
        if (event === 'SIGNED_IN' && window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setMode(null);
        setUserVault(null);
        setVaultSyncStatus('local');
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  /**
   * Stan i retry są związane z ID właściciela. Po przełączeniu profilu listener
   * poprzedniego właściciela znika, więc jego oczekujący zapis nie może pojawić
   * się w UI ani zostać potraktowany jako dokument nowego konta.
   */
  useEffect(() => {
    if (mode !== 'cloud' || !user) {
      setVaultSyncStatus('local');
      return;
    }

    const ownerId = user.id;
    const unsubscribe = subscribeCloudVaultSyncStatus(ownerId, setVaultSyncStatus);
    const retry = () => {
      void flushPendingCloudVault(ownerId);
    };

    window.addEventListener('online', retry);
    void flushPendingCloudVault(ownerId);

    return () => {
      window.removeEventListener('online', retry);
      unsubscribe();
    };
  }, [mode, user?.id]);

  const signInLocally = useCallback(
    (name: string, email?: string): MasterVault => {
      const { profile, vault } = createLocalProfile(name, email);
      setUser(profile);
      setMode('local');
      setVaultSyncStatus('local');
      setUserVault(vault);
      onVaultLoaded?.(vault);
      return vault;
    },
    [onVaultLoaded]
  );

  const signUpCloud = useCallback(
    async (email: string, password: string, displayName: string): Promise<AuthActionResult> => {
      if (!supabase) return { ok: false, message: CHMURA_NIESKONFIGUROWANA };

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName.trim() }, emailRedirectTo: redirectTarget() },
      });

      if (error) return { ok: false, message: authErrorMessage(error) };
      if (!data.session) return { ok: true, message: '', needsEmailConfirmation: true };
      return { ok: true, message: '' };
    },
    [supabase]
  );

  const signInCloud = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      if (!supabase) return { ok: false, message: CHMURA_NIESKONFIGUROWANA };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, message: authErrorMessage(error) };
      return { ok: true, message: '' };
    },
    [supabase]
  );

  const signInWithGoogle = useCallback(async (): Promise<AuthActionResult> => {
    if (!supabase) return { ok: false, message: CHMURA_NIESKONFIGUROWANA };

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTarget(),
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });

    if (error) return { ok: false, message: authErrorMessage(error) };
    return { ok: true, message: '' };
  }, [supabase]);

  const requestPasswordReset = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      if (!supabase) return { ok: false, message: CHMURA_NIESKONFIGUROWANA };
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTarget(),
      });
      if (error) return { ok: false, message: authErrorMessage(error) };
      return { ok: true, message: '' };
    },
    [supabase]
  );

  const resendConfirmation = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      if (!supabase) return { ok: false, message: CHMURA_NIESKONFIGUROWANA };
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) return { ok: false, message: authErrorMessage(error) };
      return { ok: true, message: '' };
    },
    [supabase]
  );

  const logout = useCallback(async () => {
    if (mode === 'cloud' && supabase) {
      const outgoingOwner = user?.id;
      await supabase.auth.signOut();
      // Zwykłą kopię profilu czyścimy na wspólnym komputerze. Oczekująca,
      // niepotwierdzona wersja zostaje wyłącznie w outboxie związanym z ID
      // właściciela i zostanie użyta dopiero po ponownym logowaniu tego konta.
      if (outgoingOwner) removeRaw(vaultKeyFor(outgoingOwner));
    } else {
      signOutLocalProfile();
    }

    removeRaw(vaultKeyFor(ANONYMOUS_PROFILE_ID));
    setUser(null);
    setMode(null);
    setUserVault(null);
    setVaultSyncStatus('local');
  }, [mode, supabase, user]);

  const deleteAccount = useCallback(async (): Promise<AuthActionResult> => {
    if (mode === 'cloud' && supabase) {
      const ownerId = user?.id;
      const { error } = await supabase.functions.invoke('usun-konto');
      if (error) {
        return { ok: false, message: 'Nie udało się usunąć konta. Spróbuj ponownie za chwilę.' };
      }
      await supabase.auth.signOut();
      if (ownerId) removeRaw(cloudVaultOutboxKeyFor(ownerId));
      deleteLocalProfile();
      setSession(null);
      setUser(null);
      setMode(null);
      setUserVault(null);
      setVaultSyncStatus('local');
      return { ok: true, message: '' };
    }

    deleteLocalProfile();
    setUser(null);
    setMode(null);
    setUserVault(null);
    setVaultSyncStatus('local');
    return { ok: true, message: '' };
  }, [mode, supabase, user?.id]);

  const saveUserVaultFunc = useCallback(
    (vault: MasterVault) => {
      if (!user) return;

      const ownerId = user.id;
      const stripTags = (value: string | undefined) => (value || '').replace(/<[^>]+>/g, '').trim();
      const { personalInfo } = vault;

      const cleaned = {
        fullName: stripTags(personalInfo.fullName),
        email: stripTags(personalInfo.email),
        phone: stripTags(personalInfo.phone),
        location: stripTags(personalInfo.location),
      };

      const needsSanitization =
        cleaned.fullName !== personalInfo.fullName ||
        cleaned.email !== personalInfo.email ||
        cleaned.phone !== personalInfo.phone ||
        cleaned.location !== personalInfo.location;

      const sanitizedVault: MasterVault = needsSanitization
        ? { ...vault, personalInfo: { ...personalInfo, ...cleaned } }
        : vault;

      saveProfileVault(ownerId, sanitizedVault);
      setUserVault((prev) => (prev === sanitizedVault ? prev : sanitizedVault));

      if (mode === 'cloud') {
        enqueueCloudVaultSave(ownerId, sanitizedVault);
        void flushPendingCloudVault(ownerId).then((status) => {
          if (status === 'pending') {
            showToast('CV zapisane lokalnie', {
              message: 'Synchronizacja z chmurą oczekuje. Spróbujemy ponownie po odzyskaniu połączenia.',
              variant: 'info',
            });
          }
        });
      } else {
        setVaultSyncStatus('local');
      }
    },
    [user, mode]
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      mode,
      session,
      cloudAvailable,
      userVault,
      vaultSyncStatus,
      signInLocally,
      signUpCloud,
      signInCloud,
      signInWithGoogle,
      requestPasswordReset,
      resendConfirmation,
      logout,
      deleteAccount,
      saveUserVault: saveUserVaultFunc,
      saveCurrentVault: saveUserVaultFunc,
    }),
    [
      user,
      mode,
      session,
      cloudAvailable,
      userVault,
      vaultSyncStatus,
      signInLocally,
      signUpCloud,
      signInCloud,
      signInWithGoogle,
      requestPasswordReset,
      resendConfirmation,
      logout,
      deleteAccount,
      saveUserVaultFunc,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
