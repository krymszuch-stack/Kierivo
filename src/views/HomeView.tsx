/**
 * HomeView — Ekran Startowy Kierivo 11/10.
 *
 * Zaprojektowany wokół pytania: „Co mam zrobić teraz?”.
 * Struktura: Jedno zadanie → Kontekst i aktywność → Historia ostatniej analizy.
 * Zero przeładowania, zero sztucznego szumu, zero wymyślonych danych.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Target,
  AlertCircle,
  Puzzle,
  Download,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { MasterVault } from '../types';
import type { NavTabId } from '../lib/navigation';
import { StorageKeys, profileDataKeyFor, readJson } from '../lib/storage';
import { useApplications } from '../store/useApplications';
import { useAuth } from '../context/AuthContext';
import { ANONYMOUS_PROFILE_ID } from '../lib/localProfile';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { getSavedAtsScoreDisplayInfo } from '../lib/atsScoreEvidence';
import { getAnalysisFreshnessDetails } from '../lib/analysisFreshness';
import { readLastJobAnalysis } from '../lib/lastJobAnalysis';
import { InvalidLastJobAnalysisState } from './InvalidLastJobAnalysisState';
import { useAnalysisClock } from '../hooks/useAnalysisClock';
import { getHunterExtensionStoreUrl } from '../lib/hunterExtensionStore';
import { normalizeExternalHttpUrl } from '../lib/externalHttpUrl';
import { buildHunterAutofillProfile } from '../lib/hunterAutofillProfile';
import { probeHunterExtension } from '../lib/hunterExtensionPresence';

export type HomeViewProps = {
  /** Główne wezwanie do działania */
  onStart?: () => void;
  /** Dane profilu użytkownika */
  vault?: MasterVault;
  /** Nawigacja po głównych zakładkach aplikacji */
  onNavigate?: (tab: NavTabId) => void;
  actionSlot: ReactNode;
};

export function HomeView({
  onStart,
  vault,
  onNavigate,
  actionSlot,
}: HomeViewProps) {
  const { applications } = useApplications();
  const { user } = useAuth();
  const [browserReportsOnline, setBrowserReportsOnline] = useState<boolean | null>(null);
  const [hunterPresence, setHunterPresence] = useState<
    { state: 'checking' } | { state: 'not-detected' } | { state: 'detected'; version: string }
  >({ state: 'checking' });
  const now = useAnalysisClock();
  const profileId = user?.id ?? ANONYMOUS_PROFILE_ID;

  // 1. Spersonalizowane powitanie i pora dnia
  const currentHour = new Date().getHours();
  const greeting = currentHour >= 18 || currentHour < 5 ? 'Dobry wieczór' : 'Dzień dobry';
  const rawName = vault?.personalInfo?.fullName?.trim();
  const firstName = rawName ? rawName.split(' ')[0] : '';
  const greetingText = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`;

  // Liczymy wyłącznie rzeczywiste wpisy aplikacji i etapów rozmowy.
  const interviewsCount = useMemo(() => {
    return applications.filter((a) => a.status === 'Rozmowa').length;
  }, [applications]);

  // 4. Ostatnia analiza (zapisana w storage po przeanalizowaniu oferty)
  const lastAnalysisRead = useMemo(
    () => readLastJobAnalysis(readJson<unknown>(profileDataKeyFor(StorageKeys.lastJobAnalysis, profileId), null)),
    [profileId]
  );
  const lastAnalysis = lastAnalysisRead.state === 'valid' ? lastAnalysisRead.value : null;
  const lastAnalysisSourceUrl = normalizeExternalHttpUrl(lastAnalysis?.sourceUrl);
  const lastAnalysisScoreInfo = lastAnalysis?.score === undefined
    ? undefined
    : getSavedAtsScoreDisplayInfo(lastAnalysis.score, lastAnalysis.atsScoreContext, lastAnalysis.atsScoreProvenance, now);
  const lastAnalysisFreshness = getAnalysisFreshnessDetails(lastAnalysis, vault?.updatedAt, now);
  const extensionStoreUrl = getHunterExtensionStoreUrl(import.meta.env.VITE_HUNTER_EXTENSION_STORE_URL);
  const hunterAutofillProfile = vault ? buildHunterAutofillProfile(vault) : null;

  useEffect(() => {
    const updateConnectionHint = () => setBrowserReportsOnline(navigator.onLine);
    updateConnectionHint();
    window.addEventListener('online', updateConnectionHint);
    window.addEventListener('offline', updateConnectionHint);
    return () => {
      window.removeEventListener('online', updateConnectionHint);
      window.removeEventListener('offline', updateConnectionHint);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let attempt = 0;
    const checkPresence = async () => {
      const currentAttempt = ++attempt;
      const result = await probeHunterExtension(window);
      if (!active || currentAttempt !== attempt) return;
      setHunterPresence(result.detected
        ? { state: 'detected', version: result.version ?? 'unknown' }
        : { state: 'not-detected' });
    };
    const updateWhenVisible = () => {
      if (document.visibilityState === 'visible') void checkPresence();
    };

    void checkPresence();
    window.addEventListener('focus', updateWhenVisible);
    document.addEventListener('visibilitychange', updateWhenVisible);
    const interval = window.setInterval(updateWhenVisible, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', updateWhenVisible);
      document.removeEventListener('visibilitychange', updateWhenVisible);
    };
  }, []);

  const handleNavigate = (tab: NavTabId) => {
    if (onNavigate) {
      onNavigate(tab);
    } else if (onStart) {
      onStart();
    }
  };

  const handleDownloadHunterProfile = () => {
    if (!hunterAutofillProfile) return;
    const blobUrl = URL.createObjectURL(new Blob(
      [JSON.stringify(hunterAutofillProfile, null, 2)],
      { type: 'application/json' },
    ));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'kierivo-hunter-autofill-profile.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8 sm:px-6 lg:py-12">
      {/* ---------------------------------------------------- NAGŁÓWEK */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-brand-fg">
            Kierivo
          </span>
          <span className="text-xs text-muted">
            Trzy ruchy i masz kontrolę nad swoim CV.
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {greetingText}
        </h1>
        <p className="text-base text-muted font-medium">
          Masz 1 rzecz do zrobienia.
        </p>
      </div>

      {/* -------------------------------------- GŁÓWNA KARTA ZADANIA 11/10 */}
      {actionSlot}

      {/* -------------------------------------- SZYBKIE AKCJE ALTERNATYWNE */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
          lub
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            icon={Target}
            onClick={() => handleNavigate('aplikuj')}
            className="cursor-pointer font-semibold"
          >
            Wklej ofertę pracy
          </Button>

          <Button
            type="button"
            variant="outline"
            size="md"
            icon={FileText}
            onClick={() => handleNavigate('cv')}
            className="cursor-pointer font-semibold"
          >
            Otwórz CV
          </Button>

        </div>
      </div>

      {/* ------------------------------ KIERIVO EXTENSION: dystrybucja i status */}
      <Card tone="flat" className="border border-line p-5 sm:p-6">
        <section aria-labelledby="extension-hub-title" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-brand-subtle p-2 text-brand-fg" aria-hidden="true">
                <Puzzle className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <h2 id="extension-hub-title" className="text-base font-bold text-ink">
                  Kierivo Extension
                </h2>
                <p className="text-sm text-muted">
                  Przygotowanie aplikacji w przeglądarce, z kontrolą po Twojej stronie.
                </p>
              </div>
            </div>
            <span className="w-fit rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted">
              Public Pre-Beta · 0 zł
            </span>
          </div>

          <p className="text-sm text-muted" role="status">
            {extensionStoreUrl
              ? 'Listing jest dostępny. Kierivo sprawdza lokalną obecność Huntera.'
              : 'Brak publicznego listingu w Chrome Web Store. Lokalną obecność Huntera można sprawdzić po przyznaniu dostępu.'}
          </p>

          <p className="rounded-lg border border-line/70 bg-surface px-3 py-2 text-sm text-muted" role="status" aria-live="polite">
            {hunterPresence.state === 'checking'
              ? 'Sprawdzam, czy Hunter jest połączony…'
              : hunterPresence.state === 'detected'
                ? `Wykryto Hunter ${hunterPresence.version}. To potwierdza tylko obecność rozszerzenia; nie loguje Cię ani nie przesyła profilu.`
                : 'Hunter nie jest wykryty. Aby połączyć lokalną instalację, otwórz popup Huntera, wybierz „Połącz z Kierivo” i zaakceptuj dostęp do domeny Kierivo.'}
          </p>

          {browserReportsOnline === false && (
            <p className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning-fg" role="status">
              Przeglądarka zgłasza brak połączenia. Lokalny eksport profilu nadal działa; otwarcie ogłoszenia i Chrome Web Store wymaga sieci.
            </p>
          )}

          <ul className="grid gap-2 text-xs text-muted sm:grid-cols-2" aria-label="Dostępność Kierivo Extension">
            <li><span className="font-semibold text-ink">Obecność:</span> {hunterPresence.state === 'detected' ? `Hunter ${hunterPresence.version} wykryty` : hunterPresence.state === 'checking' ? 'sprawdzanie' : 'nie wykryto'}; handshake nie daje dostępu do profilu.</li>
            <li><span className="font-semibold text-ink">Autofill:</span> lokalny import profilu; pola wybierasz w Hunterze.</li>
            <li><span className="font-semibold text-ink">Pro:</span> niedostępny w Public Pre-Beta.</li>
            <li><span className="font-semibold text-ink">Telefon:</span> użyj ręcznego workflow; rozszerzenie przygotuj w desktopowej przeglądarce Chromium.</li>
          </ul>

          <div className="space-y-2 rounded-lg border border-line/70 bg-surface p-3">
            <p className="text-sm font-semibold text-ink">Przygotuj dane do autofill</p>
            <p className="text-xs text-muted">
              Pobierzesz lokalny plik z imieniem, nazwiskiem, e-mailem i telefonem, jeśli są w profilu. Nie wysyłamy go do serwera. W Hunterze wczytaj plik, otwórz ogłoszenie i osobno zaznacz pola do wypełnienia. LinkedIn pomijamy do czasu wyboru właściwego wariantu.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Download}
              disabled={!hunterAutofillProfile}
              aria-describedby="hunter-profile-export-status"
              onClick={handleDownloadHunterProfile}
            >
              Pobierz profil do Huntera
            </Button>
            <p id="hunter-profile-export-status" className="text-xs text-muted" role="status">
              {hunterAutofillProfile
                ? 'Plik zawiera tylko dostępne imię, nazwisko, e-mail i telefon. Eksport nie wymaga połączenia z siecią.'
                : 'Dodaj jawne imię, nazwisko, e-mail lub telefon do profilu, aby przygotować lokalny plik.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {extensionStoreUrl ? (
              <a
                href={extensionStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Pobierz z Chrome Web Store
              </a>
            ) : (
              <Button type="button" variant="outline" size="sm" disabled>
                Wkrótce w Chrome Web Store
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => handleNavigate('aplikuj')}>
              Otwórz oferty
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => handleNavigate('pipeline')}>
              Moje aplikacje
            </Button>
          </div>
        </section>
      </Card>

      {/* -------------------------------------- TWOJA AKTYWNOŚĆ */}
      <div className="space-y-3 pt-4 border-t border-line/60">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
          Twoja aktywność
        </h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleNavigate('pipeline')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNavigate('pipeline')}
            className="group cursor-pointer rounded-xl border border-line bg-surface p-4 transition-all duration-150 hover:border-brand-500/40 hover:bg-surface-raised"
          >
            <span className="block text-2xl font-bold text-ink group-hover:text-brand-fg">
              {applications.length}
            </span>
            <span className="mt-1 block text-xs text-muted font-medium">
              aplikacji
            </span>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => handleNavigate('pipeline')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNavigate('pipeline')}
            className="group cursor-pointer rounded-xl border border-line bg-surface p-4 transition-all duration-150 hover:border-brand-500/40 hover:bg-surface-raised"
          >
            <span className="block text-2xl font-bold text-ink group-hover:text-brand-fg">
              {interviewsCount}
            </span>
            <span className="mt-1 block text-xs text-muted font-medium">
              rozmów
            </span>
          </div>
        </div>
      </div>

      {/* -------------------------------------- OSTATNIA ANALIZA */}
      <div className="space-y-3 pt-4 border-t border-line/60">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
          Ostatnia analiza
        </h3>

        {lastAnalysis ? (
          <Card tone="raised" className="p-5 space-y-4 border border-line">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-3">
              <div>
                <h4 className="text-base font-bold text-ink">
                  {lastAnalysis.position}
                </h4>
                <p className="text-xs text-muted font-medium">
                  {lastAnalysis.company}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`font-mono text-2xl font-extrabold ${lastAnalysisScoreInfo?.state === 'limited' || lastAnalysisScoreInfo?.state === 'unknown' ? 'text-warning-fg' : 'text-brand-fg'}`}>
                  {lastAnalysisScoreInfo?.label ?? '—'}
                </span>
                <span className="text-xs text-muted font-medium">
                  {lastAnalysisScoreInfo?.state === 'unknown' ? 'zakres nieznany' : lastAnalysisScoreInfo ? 'ocena Kierivo' : 'brak oceny'}
                </span>
              </div>
            </div>

            {lastAnalysisScoreInfo && (
              <p className="-mt-2 text-xs text-muted" role="note">
                {lastAnalysisScoreInfo.note}
              </p>
            )}

            {lastAnalysisFreshness.note && (
              <p className="-mt-2 text-xs text-warning-fg" role="status">
                {lastAnalysisFreshness.note}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <span className="font-bold text-success-fg uppercase tracking-wider text-[11px] block">
                  {lastAnalysisFreshness.state === 'current' ? 'Mocne strony' : 'Mocne strony w zapisanej analizie'}
                </span>
                <ul className="space-y-1">
                  {lastAnalysis.strengths.slice(0, 3).map((st, idx) => (
                    <li key={idx} className="flex items-center gap-1.5 text-ink font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      <span className="truncate">{st}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-warning-fg uppercase tracking-wider text-[11px] block">
                  {lastAnalysisFreshness.state === 'current' ? 'Do uzupełnienia' : 'Braki w zapisanej analizie'}
                </span>
                <ul className="space-y-1">
                  {lastAnalysis.gaps.slice(0, 3).map((gap, idx) => (
                    <li key={idx} className="flex items-center gap-1.5 text-ink font-medium">
                      <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" />
                      <span className="truncate">{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={ArrowRight}
                  onClick={() => handleNavigate('aplikuj')}
                  className="cursor-pointer font-semibold"
                >
                  Otwórz analizę
                </Button>
                {lastAnalysisSourceUrl && hunterAutofillProfile ? (
                  <a
                    href={lastAnalysisSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleDownloadHunterProfile}
                    className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    Przygotuj autofill i otwórz ogłoszenie
                  </a>
                ) : lastAnalysisSourceUrl ? (
                  <a
                    href={lastAnalysisSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    Otwórz oryginalne ogłoszenie
                  </a>
                ) : null}
              </div>
            </div>
          </Card>
        ) : lastAnalysisRead.state === 'invalid' ? (
          <InvalidLastJobAnalysisState />
        ) : (
          <Card tone="flat" className="p-6 text-center space-y-3 border-dashed border-line">
            <Target className="mx-auto h-8 w-8 text-muted" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">
                Nie przeanalizowano jeszcze żadnej oferty
              </p>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Wklej ogłoszenie z Pracuj.pl, OLX lub LinkedIn, aby sprawdzić dopasowanie do Twojego profilu i odkryć ukryte kompetencje.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Sloty opcjonalne (pytania uzupełniające) */}
    </div>
  );
}

export default HomeView;
