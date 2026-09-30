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
  Clock,
  FileText,
  Plus,
  Sparkles,
  Target,
  AlertCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { MasterVault } from '../types';
import type { NavTabId, NavSectionId } from '../lib/navigation';
import { measureVaultCompleteness } from '../lib/vaultCompleteness';
import { StorageKeys, readJson, LastJobAnalysisSummary } from '../lib/storage';
import { useApplications } from '../store/useApplications';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export type HomeViewProps = {
  /** Główne wezwanie do działania */
  onStart?: () => void;
  /** Przejście do widoku planów */
  onViewPricing?: () => void;
  /** Dane profilu użytkownika */
  vault?: MasterVault;
  /** Nawigacja po głównych zakładkach aplikacji */
  onNavigate?: (tab: NavTabId) => void;
  /** Otwarcie modalnego doradcy */
  onOpenAdvisor?: (question?: string) => void;
  /** Powody zablokowania poszczególnych sekcji */
  lockReasons?: Partial<Record<NavSectionId, string>>;
  /** Sloty na rekomendacje i pytania */
  actionSlot?: ReactNode;
  questionsSlot?: ReactNode;
};

export function HomeView({
  onStart,
  vault,
  onNavigate,
  onOpenAdvisor,
  actionSlot,
  questionsSlot,
}: HomeViewProps) {
  const { applications } = useApplications();

  // 1. Spersonalizowane powitanie i pora dnia
  const currentHour = new Date().getHours();
  const greeting = currentHour >= 18 || currentHour < 5 ? 'Dobry wieczór' : 'Dzień dobry';
  const rawName = vault?.personalInfo?.fullName?.trim();
  const firstName = rawName ? rawName.split(' ')[0] : '';
  const greetingText = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`;

  // 2. Poziom uzupełnienia profilu i zadanie priorytetowe
  const completeness = useMemo(() => {
    if (!vault) return { overall: 0, weakest: null, missingCount: 5 };
    const res = measureVaultCompleteness(vault);
    return {
      overall: res.percent,
      weakest: res.weakest,
      missingCount: res.missing.length,
    };
  }, [vault]);

  // Liczba wywiadów i aktywnych procesów
  const interviewsCount = useMemo(() => {
    return applications.filter((a) => a.status === 'Rozmowa').length;
  }, [applications]);

  // 3. Określenie głównego zadania (1 rzecz do zrobienia)
  const primaryTask = useMemo(() => {
    if (interviewsCount > 0) {
      const interviewApp = applications.find((a) => a.status === 'Rozmowa');
      return {
        title: `Przygotuj się do rozmowy w ${interviewApp?.company || 'firmie'}`,
        description: 'Przećwicz odpowiedzi STAR na prawdopodobne pytania rekrutacyjne i techniczne.',
        target: 'pipeline' as NavTabId,
        estimatedTime: 'około 6 min',
        buttonText: 'Przejdź do przygotowania →',
        progress: null,
      };
    }

    if (completeness.overall < 80) {
      const sectionName = completeness.weakest?.label || 'doświadczenie zawodowe';
      return {
        title: `Uzupełnij ${sectionName}`,
        description: 'Dzięki temu dokładniej ocenimy dopasowanie do ofert i przygotujemy bezbłędne CV.',
        target: 'profil' as NavTabId,
        estimatedTime: 'około 4 min',
        buttonText: 'Kontynuuj profil →',
        progress: completeness.overall,
      };
    }

    if (applications.length === 0) {
      return {
        title: 'Wklej pierwsze ogłoszenie o pracę',
        description: 'Sprawdź dopasowanie do oferty, poznaj mocne strony i odkryj ukryte kompetencje w Twoim profilu.',
        target: 'aplikuj' as NavTabId,
        estimatedTime: 'około 2 min',
        buttonText: 'Sprawdź ofertę →',
        progress: null,
      };
    }

    return {
      title: 'Zoptymalizuj CV pod nową ofertę',
      description: 'Dopasuj słowa kluczowe i wygeneruj dopasowany dokument gotowy do wysłania.',
      target: 'cv' as NavTabId,
      estimatedTime: 'około 3 min',
      buttonText: 'Otwórz CV →',
      progress: null,
    };
  }, [interviewsCount, completeness, applications]);

  // 4. Ostatnia analiza (zapisana w storage po przeanalizowaniu oferty)
  const lastAnalysis = useMemo(() => {
    return readJson<LastJobAnalysisSummary | null>(StorageKeys.lastJobAnalysis, null);
  }, []);

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
      <Card tone="raised" className="relative overflow-hidden border-brand-500/30 p-6 sm:p-8 shadow-raised">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-ink sm:text-2xl tracking-tight">
              {primaryTask.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted max-w-xl">
              {primaryTask.description}
            </p>
          </div>

          {primaryTask.progress !== null && (
            <div className="space-y-2 pt-1 max-w-md">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted font-medium">Twój profil</span>
                <span className="font-bold text-brand-fg">{primaryTask.progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-amber-500 transition-all duration-500"
                  style={{ width: `${primaryTask.progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-3 border-t border-line/50">
            <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
              <Clock className="h-3.5 w-3.5 text-muted" />
              {primaryTask.estimatedTime}
            </span>

            <Button
              type="button"
              variant="primary"
              size="md"
              icon={ArrowRight}
              onClick={() => handleNavigate(primaryTask.target)}
              className="font-bold shadow-md cursor-pointer"
            >
              {primaryTask.buttonText}
            </Button>
          </div>
        </div>
      </Card>

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

          {onOpenAdvisor && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              icon={Sparkles}
              onClick={() => onOpenAdvisor()}
              className="text-brand-fg hover:bg-brand-500/10 cursor-pointer font-semibold"
            >
              Zapytaj Doradcę
            </Button>
          )}
        </div>
      </div>

      {/* -------------------------------------- TWOJA AKTYWNOŚĆ */}
      <div className="space-y-3 pt-4 border-t border-line/60">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
          Twoja aktywność
        </h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleNavigate('aplikuj')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNavigate('aplikuj')}
            className="group cursor-pointer rounded-xl border border-line bg-surface p-4 transition-all duration-150 hover:border-brand-500/40 hover:bg-surface-raised"
          >
            <span className="block text-2xl font-bold text-ink group-hover:text-brand-fg">
              {lastAnalysis ? 1 : 0}
            </span>
            <span className="mt-1 block text-xs text-muted font-medium">
              analiz ofert
            </span>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => handleNavigate('cv')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNavigate('cv')}
            className="group cursor-pointer rounded-xl border border-line bg-surface p-4 transition-all duration-150 hover:border-brand-500/40 hover:bg-surface-raised"
          >
            <span className="block text-2xl font-bold text-ink group-hover:text-brand-fg">
              {vault?.personalInfo?.fullName ? 1 : 0}
            </span>
            <span className="mt-1 block text-xs text-muted font-medium">
              CV w profilu
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
                <span className="font-mono text-2xl font-extrabold text-brand-fg">
                  {lastAnalysis.score}%
                </span>
                <span className="text-xs text-muted font-medium">
                  dopasowania
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <span className="font-bold text-success-fg uppercase tracking-wider text-[11px] block">
                  Mocne strony
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
                  Do uzupełnienia
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Plus}
              onClick={() => handleNavigate('aplikuj')}
              className="cursor-pointer font-semibold"
            >
              Wklej pierwszą ofertę pracy
            </Button>
          </Card>
        )}
      </div>

      {/* Sloty opcjonalne (pytania uzupełniające) */}
      {(actionSlot || questionsSlot) && (
        <div className="space-y-4 pt-4 border-t border-line/60">
          {actionSlot}
          {questionsSlot}
        </div>
      )}
    </div>
  );
}

export default HomeView;
