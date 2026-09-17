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
import { oauthRedirectError, passwordRecoveryRedirectError, stripAuthErrorParams } from '../lib/authRecovery';
import { oauthProviderById, type OAuthProviderId } from '../lib/oauthProviders';
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
  /** Supabase ustanowił sesję z prawidłowego linku PASSWORD_RECOVERY. */
  passwordRecoveryActive: boolean;
  /** Polski komunikat dla wygasłego lub nieprawidłowego linku recovery. */
  passwordRecoveryError: string | null;
  /**
   * Komunikat błędu powrotu OAuth (np. anulowanie w oknie dostawcy), odczytany
   * z adresu przy starcie. Modal logowania ma obowiązek go pokazać — cisza
   * po nieudanym logowaniu to kłamstwo przez pominięcie (reguła 2).
   */
  oauthNotice: string | null;
  clearOAuthNotice: () => void;

  signInLocally: (name: string, email?: string) => MasterVault;
  signUpCloud: (email: string, password: string, displayName: string) => Promise<AuthActionResult>;
  signInCloud: (email: string, password: string) => Promise<AuthActionResult>;
  /** Logowanie przez dostawcę z rejestru `oauthProviders` (Google, Microsoft, LinkedIn). */
  signInWithProvider: (provider: OAuthProviderId) => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  updateRecoveredPassword: (password: string) => Promise<AuthActionResult>;
  clearPasswordRecoveryError: () => void;
  resendConfirmation: (email: string) => Promise<AuthActionResult>;

  logout: () => Promise<void>;
  deleteAccount: () => Promise<AuthActionResult>;
  saveUserVault: (vault: MasterVault) => void;
  saveCurrentVault: (vault: MasterVault) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CHMURA_NIESKONFIGUROWANA = 'Konta w chmurze nie są tu skonfigurowane.';

/**
 * Powrót zawsze prowadzi na bieżący origin. Na produkcji daje to domenę,
 * z której użytkownik faktycznie korzysta (np. domenę własną zamiast technicznej
 * domeny hostingu), a lokalnie ten sam kod wraca do localhosta.
 */
function redirectTarget(): string {
  return `${window.location.origin}/`;
}

function profileFromSession(session: Session): LocalProfile {
  // Klucze dopasowane do tego, co dostawcy OAuth wkładają do user_metadata:
  // Google → `full_name`, Microsoft → `name`/`preferred_username`, LinkedIn
  // OIDC → `name`. Ten sam łańcuch fallbacku trzyma migracja triggera
  // `handle_new_user` — obie strony muszą się zgadzać przy zmianie.
  const meta = session.user.user_metadata as
    | { display_name?: string; full_name?: string; name?: string; preferred_username?: string }
    | undefined;
  const email = session.user.email ?? '';
  const name =
    meta?.display_name?.trim() ||
    meta?.full_name?.trim() ||
    meta?.name?.trim() ||
    meta?.preferred_username?.trim() ||
    email.split('@')[0] ||
    'Użytkownik';
  return {
    id: session.user.id,
    name,
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
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(false);
  const [passwordRecoveryError, setPasswordRecoveryError] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

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

    // Gdy jednorazowy link już wygasł, Supabase nie ustanowi sesji i nie wyśle
    // PASSWORD_RECOVERY. Błąd wraca wtedy w URL — przechwytujemy wyłącznie
    // błędy tokenu, tłumaczymy je i usuwamy techniczne parametry z adresu.
    const redirectError = passwordRecoveryRedirectError(window.location.search, window.location.hash);
    if (redirectError) {
      setPasswordRecoveryActive(false);
      setPasswordRecoveryError(redirectError);
      window.history.replaceState(null, '', stripAuthErrorParams(window.location.href));
    }

    // Po anulowaniu w oknie dostawcy albo błędzie konfiguracji Supabase
    // wraca z nas do adresu z `error=...`. Komunikat trzymamy w stanie
    // (AuthModal pokaże baner) i czyścimy URL — odświeżenie nie może
    // pokazywać w kółko starego błędu.
    const oauthError = oauthRedirectError(window.location.search, window.location.hash);
    if (oauthError) {
      setOauthNotice(oauthError);
      window.history.replaceState(null, '', stripAuthErrorParams(window.location.href));
    }

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

        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecoveryActive(true);
          setPasswordRecoveryError(null);
        }

        if (
          (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') &&
          window.location.hash.includes('access_token')
        ) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setMode(null);
        setUserVault(null);
        setVaultSyncStatus('local');
        setPasswordRecoveryActive(false);
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

  const signInWithProvider = useCallback(
    async (providerId: OAuthProviderId): Promise<AuthActionResult> => {
      if (!supabase) return { ok: false, message: CHMURA_NIESKONFIGUROWANA };

      const provider = oauthProviderById(providerId);
      if (!provider) return { ok: false, message: 'Nieznany sposób logowania.' };

      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider.id,
        options: {
          redirectTo: redirectTarget(),
          queryParams: provider.queryParams,
        },
      });

      if (error) return { ok: false, message: authErrorMessage(error) };
      return { ok: true, message: '' };
    },
    [supabase]
  );

  const clearOAuthNotice = useCallback(() => {
    setOauthNotice(null);
  }, []);

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

  const updateRecoveredPassword = useCallback(
    async (password: string): Promise<AuthActionResult> => {
      if (!supabase) return { ok: false, message: CHMURA_NIESKONFIGUROWANA };
      if (!passwordRecoveryActive) {
        return { ok: false, message: 'Link do zmiany hasła nie jest już aktywny. Poproś o nowy.' };
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { ok: false, message: authErrorMessage(error) };

      setPasswordRecoveryActive(false);
      setPasswordRecoveryError(null);
      return { ok: true, message: '' };
    },
    [supabase, passwordRecoveryActive]
  );

  const clearPasswordRecoveryError = useCallback(() => {
    setPasswordRecoveryError(null);
  }, []);

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
    setPasswordRecoveryActive(false);
    setPasswordRecoveryError(null);
    setOauthNotice(null);
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
      setPasswordRecoveryActive(false);
      setPasswordRecoveryError(null);
      return { ok: true, message: '' };
    }

    deleteLocalProfile();
    setUser(null);
    setMode(null);
    setUserVault(null);
    setVaultSyncStatus('local');
    setPasswordRecoveryActive(false);
    setPasswordRecoveryError(null);
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

      setUserVault((prev) => (prev === sanitizedVault ? prev : sanitizedVault));

      if (mode === 'cloud') {
        // W trybie chmurowym owner-scoped outbox jest jedyną trwałą kopią
        // lokalną. Dzięki temu deferred flush po logout nie odtworzy zwykłego
        // klucza profilu, który mógłby zostać znaleziony na wspólnym komputerze.
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
        saveProfileVault(ownerId, sanitizedVault);
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
      passwordRecoveryActive,
      passwordRecoveryError,
      oauthNotice,
      clearOAuthNotice,
      signInLocally,
      signUpCloud,
      signInCloud,
      signInWithProvider,
      requestPasswordReset,
      updateRecoveredPassword,
      clearPasswordRecoveryError,
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
      passwordRecoveryActive,
      passwordRecoveryError,
      oauthNotice,
      clearOAuthNotice,
      signInLocally,
      signUpCloud,
      signInCloud,
      signInWithProvider,
      requestPasswordReset,
      updateRecoveredPassword,
      clearPasswordRecoveryError,
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
