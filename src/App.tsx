import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { useDeferredPersist } from './hooks/useDeferredPersist';
import { useUnlocks } from './hooks/useUnlocks';
import { MasterVault } from './types';
import { createEmptyVault } from './lib/sampleVault';
import { NavTabId, isNavSectionId, resolveTabId } from './lib/navigation';
import { resolveNextAction } from './lib/nextAction';
import {
  ANONYMOUS_PROFILE_ID,
  getActiveProfile,
  loadProfileVault,
  saveProfileVault,
  type LocalProfile,
} from './lib/localProfile';
import { isPrivacyWipeInProgress, removeRaw, vaultKeyFor } from './lib/storage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useEntitlements, isProStatus, resetEntitlementsToUnauthenticated } from './store/useEntitlements';
import { ThemeProvider } from './providers/ThemeProvider';
import { AccessibilityProvider } from './providers/AccessibilityProvider';
import { ToastHost } from './components/ui/ToastHost';
import { ApplicationFeedbackModal } from './features/tracker/ApplicationFeedbackModal';
import { showToast } from './store/useToastStore';
import { useAppStore } from './store/useAppStore';
import { useApplications } from './store/useApplications';
import { AuthModal } from './features/auth/AuthModal';
import { GlobalShell } from './components/GlobalShell';
import { CommandPalette } from './components/CommandPalette';
import { Skeleton } from './components/ui/Skeleton';
import { HomeView } from './views/HomeView';
import { NextActionCard } from './components/nextaction/NextActionCard';
import { CvQuestionsCard } from './features/questions/CvQuestionsCard';
import { fetchCloudVault } from './lib/cloudVault';
import {
  completeCloudVaultBootstrap,
  enqueueCloudVaultConflict,
  resolvePendingCloudVaultConflict,
} from './lib/cloudVaultOutbox';
import {
  getLocalVaultForCloudOwner,
  isLocalVaultEligibleForCloudOwner,
  isVaultBoundToCloudOwner,
  resolveVaultOnSignIn,
} from './lib/vaultSync';
import { AdvisorModalHost, preloadAdvisorModal } from './features/advisor/AdvisorModalHost';
import { ElevatorPitchModal } from './features/pitch/ElevatorPitchModal';
import { DrillModeModal } from './features/drill/DrillModeModal';
import { RecruiterVoiceLabModal } from './features/recruiter/RecruiterVoiceLabModal';
import { Modal } from './components/ui/Modal';
import type { AdvisorContext } from './features/advisor/advisorContext';

// Lazy-loaded heavy views for fast initial bundle & LCP
const JobMatcher = lazy(() => import('./features/matcher/JobMatcher').then((m) => ({ default: m.JobMatcher })));
const DocumentRenderer = lazy(() => import('./features/matcher/DocumentRenderer').then((m) => ({ default: m.DocumentRenderer })));
const AtsLabView = lazy(() => import('./features/ats/AtsLabView').then((m) => ({ default: m.AtsLabView })));
const MasterVaultEditor = lazy(() => import('./features/vault/MasterVaultEditor').then((m) => ({ default: m.MasterVaultEditor })));
const ProfilerSection = lazy(() => import('./features/profiler/ProfilerSection').then((m) => ({ default: m.ProfilerSection })));
const CVParserModal = lazy(() => import('./features/parser/CVParserModal').then((m) => ({ default: m.CVParserModal })));
const ApplicationTracker = lazy(() => import('./features/tracker/ApplicationTracker').then((m) => ({ default: m.ApplicationTracker })));
const PricingView = lazy(() => import('./views/PricingView').then((m) => ({ default: m.PricingView })));
const CareerTipsView = lazy(() => import('./views/CareerTipsView').then((m) => ({ default: m.CareerTipsView })));
const DesignTokensShowcaseModal = lazy(() => import('./components/DesignTokensShowcaseModal').then((m) => ({ default: m.DesignTokensShowcaseModal })));
const InterviewCockpitView = lazy(() => import('./features/cockpit/InterviewCockpitView').then((m) => ({ default: m.InterviewCockpitView })));
const ProfileSection = lazy(() => import('./features/profile/ProfileSection').then((m) => ({ default: m.ProfileSection })));
const CVLibraryView = lazy(() => import('./features/library/CVLibraryView').then((m) => ({ default: m.CVLibraryView })));

const ViewLoadingFallback = () => (
  <div className="space-y-4 p-4 sm:p-6" aria-busy="true" aria-live="polite">
    <Skeleton variant="card" height={140} />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Skeleton variant="card" height={200} />
      <Skeleton variant="card" height={200} />
    </div>
  </div>
);

function MainApp() {
  const {
    activeTab,
    setActiveTab,
    isAdvisorOpen,
    setAdvisorOpen,
    isAuthModalOpen,
    setAuthModalOpen,
    isDesignTokensOpen,
    setDesignTokensOpen,
    isVoiceLabOpen,
    setVoiceLabOpen,
    advisorInitialQuestion,
  } = useAppStore();

  const { userVault, saveUserVault, user, isAuthenticated, mode, cloudAvailable, vaultSyncStatus } = useAuth();

  const [storedVault, setVault] = useState<MasterVault>(() => {
    const profile = getActiveProfile();
    const storedVault = loadProfileVault(profile?.id ?? ANONYMOUS_PROFILE_ID);

    if (storedVault) {
      return storedVault;
    }

    return createEmptyVault(profile?.name, profile?.email);
  });
  const [vaultProfileId, setVaultProfileId] = useState(
    () => getActiveProfile()?.id ?? ANONYMOUS_PROFILE_ID
  );
  const vault = useMemo(() => {
    const handoffIsPending = mode === 'cloud' && user &&
      vaultProfileId !== user.id && vaultProfileId !== ANONYMOUS_PROFILE_ID;
    return handoffIsPending ? createEmptyVault(user.name, user.email) : storedVault;
  }, [mode, user, vaultProfileId, storedVault]);
  const [cloudSyncRetryTick, setCloudSyncRetryTick] = useState(0);
  const [cloudVaultConflict, setCloudVaultConflict] = useState<{
    ownerId: string;
    localVault: MasterVault;
    remoteVault: MasterVault | null;
    remoteUpdatedAt: string | null;
  } | null>(null);
  const [resolvingCloudVaultConflict, setResolvingCloudVaultConflict] = useState(false);
  const retryCloudBootstrapOnOnline = useRef(false);

  const { applications } = useApplications();
  // Wynik dopasowania jest stanem bieżącej sesji, nie kolejną kopią CV w schowku.
  const [advisorContext, setAdvisorContext] = useState<AdvisorContext | null>(null);

  /**
   * Prawdziwe uprawnienia pobierane raz na sesję konta i po powrocie z bramki.
   *
   * Bez tego licznik w interfejsie żył wyłącznie z `localStorage`: kupiona
   * subskrypcja potwierdzona webhookiem nie pojawiałaby się do ręcznego
   * wyczyszczenia schowka, a komentarz `refresh()` obiecywał wywołanie, którego
   * nikt nie wykonywał (reguła 5).
   */
  const { refresh: refreshEntitlements, subscription } = useEntitlements();

  // Jedno źródło statusu planu dla całej powłoki. Wcześniej topbar czytał
  // useEntitlements, a stopka sidebara dostawała domyślne „free" — użytkownik
  // Pro widział oba stany naraz.
  const planStatus = isProStatus(subscription.status)
    ? 'active'
    : subscription.status === 'trialing'
      ? 'trialing'
      : 'free';

  useEffect(() => {
    if (mode !== 'cloud' || !user) {
      resetEntitlementsToUnauthenticated();
      return;
    }
    void refreshEntitlements();
  }, [mode, user?.id, refreshEntitlements]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (!checkout) return;

    // Parametr znika z paska od razu, żeby odświeżenie strony nie odpalało
    // komunikatu ponownie. Sam parametr niczego nie dowodzi — status potwierdza
    // dopiero odpowiedź `/api/me`, więc to ona rozstrzyga, co pokażemy.
    params.delete('checkout');
    const rest = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`
    );

    if (checkout === 'success') {
      void refreshEntitlements();
      showToast('Dziękujemy za zakup', {
        message: 'Sprawdzamy status płatności — plan pojawi się na koncie po potwierdzeniu.',
        variant: 'info',
      });
    }
  }, [refreshEntitlements]);

  // Jeden zapis, pod jednym kluczem. Wcześniej każda zmiana trafiała naraz do
  // klucza globalnego i do klucza profilu, więc te same dane leżały w schowku
  // w dwóch kopiach, które potrafiły się rozjechać.
  //
  // Zapis jest odłożony w czasie, bo utrwalanie to pełna serializacja drzewa,
  // a edytor tworzy nowy obiekt vaultu przy każdej edycji pola — bez odłożenia
  // `JSON.stringify` całych 38 kB wykonywał się przy każdym wpisanym znaku.
  // `useDeferredPersist` dosyła zaległy zapis przy ukryciu karty, zamknięciu
  // strony i odmontowaniu, więc opóźnienie nie tworzy okna utraty danych.
  const persistVault = useCallback(
    (current: MasterVault) => {
      if (isPrivacyWipeInProgress()) return;
      if (isAuthenticated && user) {
        // Podczas zmiany konta `vault` może jeszcze pochodzić z poprzedniego
        // profilu. Nie zapisuj go pod nowym właścicielem, zanim bootstrap
        // pobierze jego chmurę i jawnie rozstrzygnie, czy wolno scalić źródło.
        if (mode === 'cloud' && !isVaultBoundToCloudOwner(vaultProfileId, user.id)) return;
        saveUserVault(current);
      } else if (!user && !isAuthenticated) {
        saveProfileVault(ANONYMOUS_PROFILE_ID, current);
      }
    },
    [isAuthenticated, user, mode, vaultProfileId, saveUserVault]
  );

  const { cancel: cancelVaultPersist } = useDeferredPersist(vault, persistVault);

  const prevUserRef = useRef<LocalProfile | null>(user);

  // Sync user vault when authenticated user changes, or reset on logout
  useEffect(() => {
    if (user && userVault) {
      prevUserRef.current = user;
      setVault(userVault);
      setVaultProfileId(user.id);
    } else if (!user && prevUserRef.current) {
      // Wylogowanie lub zamknięcie profilu:
      // 1. Natychmiast anulujemy oczekujące opóźnione zapisy starego profilu
      cancelVaultPersist();
      // 2. Skasuj klucz profilu anonimowego ze schowka
      removeRaw(vaultKeyFor(ANONYMOUS_PROFILE_ID));
      // 3. Zresetuj stan pamięciowy do czystego profilu
      prevUserRef.current = null;
      setVault(createEmptyVault());
      setVaultProfileId(ANONYMOUS_PROFILE_ID);
    }
  }, [user, userVault, cancelVaultPersist]);
  /**
   * Pierwsze spotkanie lokalnego CV z kontem w chmurze.
   *
   * Rozstrzygnięcie żyje tutaj, a nie w `AuthContext`, bo to `MainApp` trzyma
   * vault — kontekst jest wyżej w drzewie i nie ma do niego dostępu.
   *
   * `vaultRef` zamiast `vault` w zależnościach jest konieczne: efekt ma
   * zadziałać **raz po zalogowaniu**, a nie przy każdym wpisanym znaku.
   * Wpisanie `vault` do tablicy zależności robiłoby żądanie do chmury po każdej
   * literze i nadpisywało dopiero co pobrane dane.
   */
  const vaultRef = useRef(vault);
  // Aktualizacja w efekcie, nie w trakcie renderu — ten sam wzorzec co
  // `persistRef` w `useDeferredPersist.ts`.
  useEffect(() => {
    vaultRef.current = vault;
  }, [vault]);

  const syncedForUser = useRef<string | null>(null);
  const wasCloudVaultConflict = useRef(false);

  useEffect(() => {
    const retry = () => {
      if (!retryCloudBootstrapOnOnline.current) return;
      retryCloudBootstrapOnOnline.current = false;
      syncedForUser.current = null;
      setCloudSyncRetryTick((current) => current + 1);
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  useEffect(() => {
    if (mode !== 'cloud' || !user) return;
    if (syncedForUser.current === user.id) return;
    syncedForUser.current = user.id;

    let aktywny = true;
    const localVault = getLocalVaultForCloudOwner(vaultRef.current, vaultProfileId, user.id);

    void (async () => {
      try {
        const remoteSnapshot = await fetchCloudVault(user.id);
        if (!aktywny) return;

        if (remoteSnapshot.pendingConflict) {
          const localSnapshot = remoteSnapshot.vault ?? createEmptyVault(user.name, user.email);
          setVault(localSnapshot);
          setVaultProfileId(user.id);
          retryCloudBootstrapOnOnline.current = !remoteSnapshot.remoteReadSucceeded;
          if (!remoteSnapshot.remoteReadSucceeded) {
            syncedForUser.current = null;
            showToast('Zachowaliśmy lokalną wersję CV', {
              message: 'Wykryliśmy konflikt zapisu. Po odzyskaniu połączenia pokażemy obie wersje do wyboru.',
              variant: 'info',
            });
            return;
          }
          enqueueCloudVaultConflict(user.id, localSnapshot, remoteSnapshot.remoteUpdatedAt);
          setCloudVaultConflict({
            ownerId: user.id,
            localVault: localSnapshot,
            remoteVault: remoteSnapshot.conflictRemoteVault ?? null,
            remoteUpdatedAt: remoteSnapshot.remoteUpdatedAt,
          });
          return;
        }

        const wynik = resolveVaultOnSignIn(localVault, remoteSnapshot.vault);
        if (wynik.action === 'konflikt') {
          enqueueCloudVaultConflict(user.id, localVault, remoteSnapshot.remoteUpdatedAt);
          setVault(localVault);
          setVaultProfileId(user.id);
          setCloudVaultConflict({
            ownerId: user.id,
            localVault,
            remoteVault: remoteSnapshot.vault,
            remoteUpdatedAt: remoteSnapshot.remoteUpdatedAt,
          });
          return;
        }
        setVault(wynik.vault);

        if (!remoteSnapshot.remoteReadSucceeded) {
          // Offline pending pozostaje dostępny lokalnie, ale nie wysyłamy go
          // bez poznania aktualnej chmury, bo nadpisałby zmiany z innego urządzenia.
          retryCloudBootstrapOnOnline.current = true;
          syncedForUser.current = null;
          return;
        }

        retryCloudBootstrapOnOnline.current = false;
        // Dopiero rozstrzygnięty snapshot trafia do kolejki. To zamyka wyścig,
        // w którym AuthContext mógł wysłać offline kopię przed tym odczytem.
        await completeCloudVaultBootstrap(
          user.id,
          wynik.vault,
          wynik.shouldUpload,
          remoteSnapshot.remoteUpdatedAt,
        );
        setVaultProfileId(user.id);
      } catch {
        if (!aktywny) return;
        // Nieudany odczyt nie może skasować tego, co użytkownik ma na ekranie —
        // `resolveVaultOnSignIn` nigdy nie dostanie tu pustej chmury „na wszelki
        // wypadek", bo w ogóle nie dochodzi do rozstrzygnięcia.
        syncedForUser.current = null;
        retryCloudBootstrapOnOnline.current = true;
        showToast('Nie udało się pobrać CV z konta', {
          message: isLocalVaultEligibleForCloudOwner(vaultProfileId, user.id)
            ? 'Pracujesz na wersji z tego urządzenia. Odśwież stronę, żeby spróbować ponownie.'
            : 'Dane poprzedniego profilu lokalnego pozostały na tym urządzeniu i nie zostały połączone z kontem. Odśwież stronę, żeby spróbować ponownie.',
          variant: 'error',
        });
      }
    })();

    return () => {
      aktywny = false;
    };
  }, [mode, user, vaultProfileId, cloudSyncRetryTick]);

  useEffect(() => {
    const isConflict = mode === 'cloud' && vaultSyncStatus === 'conflict';
    const newlyConflicted = isConflict && !wasCloudVaultConflict.current;
    wasCloudVaultConflict.current = isConflict;
    if (!newlyConflicted || !user || cloudVaultConflict?.ownerId === user.id) return;

    // Retry paths can discover a CAS conflict after the initial modal was
    // dismissed. Fetch the other snapshot again so the user can choose safely.
    syncedForUser.current = null;
    setCloudSyncRetryTick((current) => current + 1);
  }, [mode, user, vaultSyncStatus, cloudVaultConflict?.ownerId]);

  const currentProfileId = user?.id ?? ANONYMOUS_PROFILE_ID;
  const unlocks = useUnlocks(vault, applications, currentProfileId, vaultProfileId);

  /**
   * Czas, względem którego liczone są reguły „rozmowa za mniej niż 48 h"
   * i „aplikacja bez odpowiedzi od tygodnia".
   *
   * Odświeżany przy powrocie na kartę, a nie zegarem co minutę. Karta otwarta
   * w tle przez pół dnia i tak nikomu niczego nie przypomni, a przerysowywanie
   * całego drzewa co sześćdziesiąt sekund kosztowałoby więcej niż jest warte.
   */
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const nextAction = useMemo(
    () => resolveNextAction({ vault, applications, now }),
    [vault, applications, now]
  );

  /**
   * Jedyne wejście do zmiany sekcji.
   *
   * Tłumaczy identyfikatory sprzed konsolidacji (`vault`, `matcher`…) i pilnuje
   * odblokowań. Pasek boczny sam wyszarza zamknięte sekcje, ale nie jest
   * jedyną drogą — paleta poleceń i rekomendacje też tu trafiają, więc reguła
   * musi stać w miejscu, przez które przechodzą wszystkie.
   */
  const navigate = useCallback(
    (tab: NavTabId | string) => {
      const target = resolveTabId(tab);

      if (isNavSectionId(target) && unlocks.sections[target] === false) {
        showToast('Ta sekcja jest jeszcze zamknięta', {
          message: unlocks.reasons[target],
          variant: 'info',
        });
        return;
      }

      setActiveTab(target);
    },
    [setActiveTab, unlocks]
  );

  // Parser CV dostaje tu kompletny vault po scaleniu ze strategiami z diffu
  // (applyParsedCVToVault) — podstawiamy 1:1. Przepuszczanie tego jeszcze raz
  // przez mergeImportedVault ignorowało wybór „zastąp", bo tamte scalanie
  // zawsze dokłada wpisy.
  const handleApplyVault = (imported: MasterVault) => {
    setVault(imported);
  };

  const handleOpenAdvisor = (initialQuestion?: string) => {
    // Preload tuż przed otwarciem — chunk zdąży się pobrać zanim React go zażąda.
    void preloadAdvisorModal();
    setAdvisorOpen(true, initialQuestion);
  };

  const resolveCloudVaultConflict = async (chosenVault: MasterVault) => {
    if (!cloudVaultConflict || resolvingCloudVaultConflict) return;
    setResolvingCloudVaultConflict(true);
    try {
      const status = await resolvePendingCloudVaultConflict(
        cloudVaultConflict.ownerId,
        chosenVault,
        cloudVaultConflict.remoteUpdatedAt,
      );
      setVault(chosenVault);
      setVaultProfileId(cloudVaultConflict.ownerId);
      if (status === 'conflict') {
        setCloudVaultConflict(null);
        syncedForUser.current = null;
        setCloudSyncRetryTick((current) => current + 1);
        showToast('Pojawiła się nowsza zmiana w chmurze', {
          message: 'Wybrana wersja została zachowana lokalnie. Pobieramy aktualną wersję, aby ponownie pokazać wybór.',
          variant: 'info',
        });
        return;
      }
      setCloudVaultConflict(null);
      showToast(status === 'cloud' ? 'Konflikt rozstrzygnięty' : 'Wersja wybrana i zapisana lokalnie', {
        message: status === 'cloud'
          ? 'Wybrana wersja CV została zapisana w chmurze.'
          : 'Wybrana wersja czeka na synchronizację. Pozostałe dane nie zostały automatycznie połączone.',
        variant: status === 'cloud' ? 'success' : 'info',
      });
    } catch {
      showToast('Nie udało się rozstrzygnąć konfliktu', {
        message: 'Obie wersje pozostają zachowane. Spróbuj ponownie po odświeżeniu połączenia.',
        variant: 'error',
      });
    } finally {
      setResolvingCloudVaultConflict(false);
    }
  };

  const visibleCloudVaultConflict = cloudVaultConflict?.ownerId === user?.id
    ? cloudVaultConflict
    : null;

  // Narzędzia sekcji TRENUJ. Otwierane z Kokpitu, nie z paska górnego —
  // wcześniej wisiały w globalnej nawigacji razem ze skrótami Ctrl+B/P/D,
  // widoczne od pierwszej sekundy, choć dotyczą rozmowy, której nikt jeszcze
  // nie umówił. Zasobnik Rozmowy (HUD, pętla) mieszka teraz w Pipeline.
  // Modala Mostu Kompetencyjnego tu nie ma: jedynym żywym wejściem jest
  // mapper słów kluczowych w APLIKUJ, który renderuje własną instancję
  // z preselekcją brakującej umiejętności.
  const [isPitchOpen, setPitchOpen] = useState(false);
  const [isDrillOpen, setDrillOpen] = useState(false);
  const [isGlobalCvPreviewOpen, setIsGlobalCvPreviewOpen] = useState(false);

  /** Pusty profil = pierwsza wizyta. Ta sama reguła co w `HomeView`. */
  const isFirstVisit = !vault.personalInfo.fullName && vault.history.length === 0;

  return (
    <GlobalShell
      activeTab={activeTab}
      onSelectTab={navigate}
      onOpenAdvisor={handleOpenAdvisor}
      onOpenAuthModal={() => setAuthModalOpen(true)}
      onOpenCvPreview={() => setIsGlobalCvPreviewOpen(true)}
      onOpenDesignTokens={() => setDesignTokensOpen(true)}
      unlockedSections={unlocks.sections}
      lockReasons={unlocks.reasons}
      isAuthenticated={isAuthenticated}
      authMode={mode}
      userEmail={user?.email}
      cloudAvailable={cloudAvailable}
      planStatus={planStatus}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: [0.19, 1, 0.22, 1] }}
        >
          {/* Ekran startowy: powitanie na górze, rekomendacje i pytania pod nim, moduły poniżej. */}
          {activeTab === 'home' && (
            <HomeView
              vault={vault}
              onNavigate={navigate}
              onOpenAdvisor={handleOpenAdvisor}
              lockReasons={unlocks.reasons}
              actionSlot={
                !isFirstVisit ? (
                  <NextActionCard action={nextAction} onNavigate={navigate} />
                ) : undefined
              }
              questionsSlot={
                !isFirstVisit ? (
                  <CvQuestionsCard
                    key={user?.id ?? ANONYMOUS_PROFILE_ID}
                    profileId={user?.id ?? ANONYMOUS_PROFILE_ID}
                    vault={vault}
                    onChange={setVault}
                  />
                ) : undefined
              }
            />
          )}

          <Suspense fallback={<ViewLoadingFallback />}>
            {/* PROFIL — dane, import CV i preferencje jako kroki jednej sekcji */}
            {activeTab === 'profil' && (
              <ProfileSection
                vault={vault}
                onChangeVault={setVault}
                onApplyVault={handleApplyVault}
                renderEditor={(props) => <MasterVaultEditor {...props} />}
                renderParser={(props) => <CVParserModal {...props} />}
                renderProfiler={(props) => <ProfilerSection {...props} />}
              />
            )}

            {/* APLIKUJ — oferta, dopasowanie ATS, generator dokumentów */}
            {activeTab === 'aplikuj' && (
              <JobMatcher
                vault={vault}
                onUpdateVault={setVault}
                onAdvisorContext={setAdvisorContext}
              />
            )}

            {/* Tab: Laboratorium Audytu ATS 360° (Multi-Engine Consensus) */}
            {activeTab === 'ats-lab' && (
              <AtsLabView
                key={user?.id ?? ANONYMOUS_PROFILE_ID}
                profileId={user?.id ?? ANONYMOUS_PROFILE_ID}
                vault={vault}
                onNavigate={setActiveTab}
              />
            )}

            {/* TRENUJ — przygotowanie do rozmowy */}
            {activeTab === 'trenuj' && (
              <InterviewCockpitView
                vault={vault}
                onOpenDrill={() => setDrillOpen(true)}
                onOpenPitch={() => setPitchOpen(true)}
              />
            )}

            {/* PIPELINE — wysłane aplikacje i kontekstowy Zasobnik Rozmowy */}
            {activeTab === 'pipeline' && (
              <ApplicationTracker
                vault={vault}
                interviewToolboxUnlocked={unlocks.interviewToolbox}
                showShortcutsHint={unlocks.showShortcutsHint}
                onDismissShortcutsHint={unlocks.dismissShortcutsHint}
              />
            )}

            {/* Cennik — poza czterema krokami, wchodzi się z menu konta */}
            {activeTab === 'pricing' && <PricingView />}

            {/* Porady & Baza wiedzy (Blog/SEO) */}
            {activeTab === 'porady' && <CareerTipsView vault={vault} />}

            {/* Biblioteka CV — wersje dokumentów, tagi, klonowanie, re-eksport */}
            {activeTab === 'biblioteka' && <CVLibraryView onNavigate={navigate} />}
          </Suspense>
        </motion.div>
      </AnimatePresence>

      <Suspense fallback={null}>
        <AdvisorModalHost
          isOpen={isAdvisorOpen}
          onClose={() => setAdvisorOpen(false)}
          vault={vault}
          advisorContext={advisorContext}
          initialQuestion={advisorInitialQuestion}
          onNavigate={navigate}
        />

        <DesignTokensShowcaseModal
          isOpen={isDesignTokensOpen}
          onClose={() => setDesignTokensOpen(false)}
        />
      </Suspense>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccessVaultLoaded={(loadedVault) => {
          setVault(loadedVault);
        }}
      />

      {visibleCloudVaultConflict && (
        <Modal
          isOpen
          onClose={() => {
            if (!resolvingCloudVaultConflict) setCloudVaultConflict(null);
          }}
          title="Konflikt dwóch wersji CV"
          description="Lokalne CV i wersja z konta są różne. Bez wspólnej historii zmian połączenie mogłoby przywrócić usunięte wpisy. Wybierz jedną pełną wersję do zapisania."
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-sunken/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Lokalna wersja</p>
                <p className="mt-2 text-sm text-ink">
                  {visibleCloudVaultConflict.localVault.history.length} doświadczeń · {visibleCloudVaultConflict.localVault.education.length} etapów edukacji · {visibleCloudVaultConflict.localVault.projects.length} projektów
                </p>
                <button
                  type="button"
                  disabled={resolvingCloudVaultConflict}
                  onClick={() => void resolveCloudVaultConflict(visibleCloudVaultConflict.localVault)}
                  className="mt-4 min-h-11 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Zachowaj lokalną wersję
                </button>
                <p className="mt-2 text-xs text-muted">Ta wersja zastąpi zapis w chmurze.</p>
              </div>
              <div className="rounded-xl border border-line bg-sunken/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Wersja z chmury</p>
                {visibleCloudVaultConflict.remoteVault ? (
                  <>
                    <p className="mt-2 text-sm text-ink">
                      {visibleCloudVaultConflict.remoteVault.history.length} doświadczeń · {visibleCloudVaultConflict.remoteVault.education.length} etapów edukacji · {visibleCloudVaultConflict.remoteVault.projects.length} projektów
                    </p>
                    <button
                      type="button"
                      disabled={resolvingCloudVaultConflict}
                      onClick={() => void resolveCloudVaultConflict(visibleCloudVaultConflict.remoteVault!)}
                      className="mt-4 min-h-11 w-full rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                    >
                      Zachowaj wersję z chmury
                    </button>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-muted">W chmurze nie ma aktualnie zapisanego CV.</p>
                    <button
                      type="button"
                      disabled={resolvingCloudVaultConflict}
                      onClick={() => void resolveCloudVaultConflict(createEmptyVault(user?.name, user?.email))}
                      className="mt-4 min-h-11 w-full rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                    >
                      Zachowaj pustą wersję z chmury
                    </button>
                  </>
                )}
                <p className="mt-2 text-xs text-muted">Ta wersja zastąpi lokalną kopię dla konta.</p>
              </div>
            </div>
            <p className="text-xs text-muted">
              Niewybrana wersja nie zostanie scalona. Przed wyborem możesz zamknąć okno; konflikt i lokalny zapis pozostaną zachowane.
            </p>
          </div>
        </Modal>
      )}

      {/* Narzędzia treningowe — otwierane z Kokpitu w sekcji TRENUJ */}
      <ElevatorPitchModal
        isOpen={isPitchOpen}
        onClose={() => setPitchOpen(false)}
        vault={vault}
      />

      <DrillModeModal isOpen={isDrillOpen} onClose={() => setDrillOpen(false)} />

      {/* Laboratorium Głosu & Deterministyczny Router VAD (180 nagrań, dyktowanie) */}
      <RecruiterVoiceLabModal
        isOpen={isVoiceLabOpen}
        onClose={() => setVoiceLabOpen(false)}
      />

      {/* Ankieta po eksporcie: pyta o wysyłkę i sama prowadzi wpis w Pipeline */}
      <ApplicationFeedbackModal onNavigate={navigate} />

      {/* Generator końcowego dokumentu dostępny z głównej nawigacji. */}
      {isGlobalCvPreviewOpen && (
        <Modal
          isOpen={isGlobalCvPreviewOpen}
          onClose={() => setIsGlobalCvPreviewOpen(false)}
          title={`Generator gotowego CV • ${vault.personalInfo?.fullName || 'Twój Profil'}`}
          size="full"
        >
          <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-2xl" />}>
            <DocumentRenderer
              vault={vault}
              onUpdateVault={(updated) => setVault(updated)}
              onExported={() => {
                showToast('Eksport CV', {
                  message: 'Dokument CV został przekazany do druku / zapisu PDF.',
                  variant: 'info',
                });
              }}
            />
          </Suspense>
        </Modal>
      )}

      {/* Wyszukiwarka funkcji otwierana widocznym przyciskiem. Dostaje `navigate`, nie `setActiveTab`: wcześniej omijała blokady
          sekcji, bo jedyny strażnik odblokowań siedzi w `navigate`. */}
      <CommandPalette onNavigate={navigate} />
    </GlobalShell>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <AccessibilityProvider>
          <AuthProvider>
            <MainApp />
            <ToastHost />
          </AuthProvider>
        </AccessibilityProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
