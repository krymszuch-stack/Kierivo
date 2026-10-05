/**
 * HomeView — Ekran Startowy Kierivo 11/10.
 *
 * Zaprojektowany wokół pytania: „Co mam zrobić teraz?”.
 * Struktura: Jedno zadanie → Kontekst i aktywność → Historia ostatniej analizy.
 * Zero przeładowania, zero sztucznego szumu, zero wymyślonych danych.
 */

import React, { useMemo } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Target,
  AlertCircle,
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
  const lastAnalysisScoreInfo = lastAnalysis?.score === undefined
    ? undefined
    : getSavedAtsScoreDisplayInfo(lastAnalysis.score, lastAnalysis.atsScoreContext, lastAnalysis.atsScoreProvenance, now);
  const lastAnalysisFreshness = getAnalysisFreshnessDetails(lastAnalysis, vault?.updatedAt, now);

  const handleNavigate = (tab: NavTabId) => {
    if (onNavigate) {
      onNavigate(tab);
    } else if (onStart) {
      onStart();
    }
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
