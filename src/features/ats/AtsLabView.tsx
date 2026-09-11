import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  BookOpen,
  Layers,
  ChevronDown,
  ChevronUp,
  Compass,
  ArrowRight,
  Lightbulb,
  Zap,
} from 'lucide-react';
import { MasterVault } from '../../types';
import { simulateMultiEngineATS, AtsEngineResult } from '../../lib/atsSimulator';
import { formatDecimalPl } from '../../lib/pluralFormat';
import { buildAtsTelemetryReport, STUFFING_DENSITY_THRESHOLD } from '../../lib/atsScorer';
import { ScoreRing } from '../../components/ui/ScoreRing';
import { StorageKeys, readJson, writeJson } from '../../lib/storage';

export interface AtsLabViewProps {
  vault: MasterVault;
  jobOfferText?: string;
  targetRole?: string;
}

export const AtsLabView: React.FC<AtsLabViewProps> = ({
  vault,
  jobOfferText = '',
  targetRole = '',
}) => {
  // Szkic ogłoszenia przeżywa zmianę zakładki: wcześniej useState gubił treść
  // przy każdym unmountcie widoku, czyli dokładnie wtedy, gdy użytkownik chciał
  // „podejrzeć profil i wrócić". Klucz jest w rejestrze storage — CRC i wipe
  // obejmują go automatycznie.
  const savedDraft = useMemo(
    () => readJson<{ jd?: string; role?: string }>(StorageKeys.draftAtsLab, {}),
    []
  );
  const [customJdText, setCustomJdText] = useState(jobOfferText || savedDraft.jd || '');
  const [customRole, setCustomRole] = useState(targetRole || vault.personalInfo?.title || savedDraft.role || '');

  useEffect(() => {
    writeJson(StorageKeys.draftAtsLab, { jd: customJdText, role: customRole });
  }, [customJdText, customRole]);

  const [selectedEngineId, setSelectedEngineId] = useState<string | null>('konsensus_cvelocity');
  const [openPracticeIdx, setOpenPracticeIdx] = useState<number | null>(0);

  const consensus = useMemo(() => {
    return simulateMultiEngineATS(vault, customJdText, customRole);
  }, [vault, customJdText, customRole]);

  // Raport śledczy: każdy wskaźnik da się wywieść z vaultu i ogłoszenia.
  // Przeliczany razem z konsensusem — te same dane wejściowe, zero dodatkowego
  // stanu do zsynchronizowania.
  const telemetry = useMemo(() => {
    return buildAtsTelemetryReport({ vault, jobDescription: customJdText });
  }, [vault, customJdText]);

  const activeEngine = useMemo(() => {
    return consensus.engines.find((e) => e.id === selectedEngineId) || consensus.engines[0];
  }, [consensus.engines, selectedEngineId]);

  const getStatusColor = (status?: AtsEngineResult['status'] | string) => {
    switch (status) {
      case 'OPTIMAL':
        return {
          bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
          border: 'border-emerald-500/30',
          text: 'text-emerald-700 dark:text-emerald-400',
          label: 'Wzorowy',
          badge: 'bg-emerald-500 text-white',
        };
      case 'ACCEPTABLE':
        return {
          bg: 'bg-blue-500/10 dark:bg-blue-500/15',
          border: 'border-blue-500/30',
          text: 'text-blue-700 dark:text-blue-400',
          label: 'Akceptowalny',
          badge: 'bg-blue-500 text-white',
        };
      case 'RISKY':
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-500/15',
          border: 'border-amber-500/30',
          text: 'text-amber-700 dark:text-amber-400',
          label: 'Ryzykowny',
          badge: 'bg-amber-500 text-white',
        };
      case 'REJECTED':
        return {
          bg: 'bg-rose-500/10 dark:bg-rose-500/15',
          border: 'border-rose-500/30',
          text: 'text-rose-700 dark:text-rose-400',
          label: 'Odrzucony',
          badge: 'bg-rose-500 text-white',
        };
      default:
        return {
          bg: 'bg-ink/5',
          border: 'border-ink/20',
          text: 'text-ink-muted',
          label: 'Nieznany',
          badge: 'bg-ink/60 text-white',
        };
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8 animate-fade-in">
      {/* 1. Nagłówek i kontekst laboratorium */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-fg">
            <Layers className="h-4 w-4" />
            <span>Laboratorium Audytu Rekrutacyjnego</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Audyt ATS i Konsensus Rynkowy
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Sprawdź, jak 10 wyspecjalizowanych filtrów i silników weryfikacji w CVelocity ocenia Twoje CV pod kątem czytelności, słów kluczowych i wymagań formalnych. Wynik CVelocity nie jest wynikiem zewnętrznego systemu ATS ani gwarancją rekrutacji.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" /> 10 Silników Weryfikacji
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-fg">
            <Zap className="h-3.5 w-3.5" /> 0 Tokenów AI • Pełny Determinizm
          </span>
        </div>
      </div>

      {/* 2. Główny Panel: Mediana Konsensusu i Strategiczne Podsumowanie */}
      <div className="relative overflow-hidden rounded-3xl border border-brand/20 bg-surface-raised/80 p-6 sm:p-8 shadow-card-glass backdrop-blur-xl">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-center">
          {/* Radialny wskaźnik mediany — ScoreRing, jedno źródło geometrii */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-surface/50 border border-ink/5">
            <ScoreRing value={consensus.medianScore} label="Mediana filtrów" />
            {/* Mediana liczy się z ocen wewnętrznych silników CVelocity — dawna
                nazwa „rynkowa" sugerowała benchmark, którego nie mierzymy. */}
            <span className="mt-2 block text-[11px] text-ink-faint">
              mediana naszych filtrów, nie rynku
            </span>

            <div className="mt-4 flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                consensus.medianScore >= 80 ? 'bg-emerald-500 text-white' : consensus.medianScore >= 65 ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white'
              }`}>
                {consensus.medianScore >= 80 ? 'Wysoka Gotowość Rynkowa' : consensus.medianScore >= 65 ? 'Stabilny Próg Przejścia' : 'Wymaga Uzupełnienia'}
              </span>
            </div>
          </div>

          {/* Opis narracyjny i statystyki */}
          <div className="lg:col-span-8 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand-fg" /> Uzasadnienie Oceny Systemowej
              </h2>
              <p className="mt-2 text-sm sm:text-base leading-relaxed text-ink-muted">
                {consensus.summaryJustification}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-surface/60 border border-ink/5 text-center">
                <span className="text-xs text-ink-faint block">Średnia Ocen</span>
                <span className="text-xl font-bold font-mono text-ink mt-0.5 block">{consensus.meanScore}%</span>
              </div>
              <div className="p-3 rounded-xl bg-surface/60 border border-ink/5 text-center">
                <span className="text-xs text-ink-faint block">Najniższa Ocena</span>
                <span className="text-xl font-bold font-mono text-rose-500 mt-0.5 block">{consensus.minScore}%</span>
              </div>
              <div className="p-3 rounded-xl bg-surface/60 border border-ink/5 text-center">
                <span className="text-xs text-ink-faint block">Najwyższa Ocena</span>
                <span className="text-xl font-bold font-mono text-emerald-500 mt-0.5 block">{consensus.maxScore}%</span>
              </div>
              <div className="p-3 rounded-xl bg-surface/60 border border-ink/5 text-center">
                <span className="text-xs text-ink-faint block">Liczba Silników</span>
                {/* Wyprowadzone z konsensusu — hardcod „10 / 10" rozjeżdżał się z faktyczną listą silników. */}
                <span className="text-xl font-bold font-mono text-brand-fg mt-0.5 block">{consensus.engines.length} / {consensus.engines.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Telemetria śledcza — matematyka pod spodem oceny */}
      <div className="rounded-3xl border border-ink/10 bg-surface-raised/80 p-6 sm:p-8 shadow-card-glass backdrop-blur-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink flex items-center gap-2">
              <Zap className="h-5 w-5 text-brand-fg" /> Telemetria Śledcza — dowody, nie szacunek
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Każdy wskaźnik da się wywieść z Twojego profilu i treści ogłoszenia: pokrycie lematów po rdzeniach, sprawczość języka, parsowalność struktury i kary za twarde wymagania.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl bg-surface/60 border border-ink/5 px-5 py-3 text-center">
            <span className="text-3xl font-black font-mono text-ink">{telemetry.overallScore}%</span>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-faint">Wynik Telemetrii</span>
          </div>
        </div>

        {/* Rozkład formuły */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {([
            ['Pokrycie lematów', '40%', telemetry.formulaBreakdown.hardSkillsScore],
            ['Doświadczenie i metryki', '25%', telemetry.formulaBreakdown.experienceScore],
            ['Struktura dokumentu', '20%', telemetry.formulaBreakdown.structureScore],
            ['Sprawczość języka', '15%', telemetry.formulaBreakdown.actionVerbsScore],
          ] as const).map(([label, weight, value]) => (
            <div key={label} className="p-4 rounded-xl bg-surface/60 border border-ink/5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-muted">{label}</span>
                <span className="font-mono text-[10px] text-brand-fg">waga {weight}</span>
              </div>
              <span className="mt-1 block text-2xl font-bold font-mono text-ink">{value}</span>
              <div className="mt-2 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-700"
                  style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                />
              </div>
            </div>
          ))}
          <div className={`p-4 rounded-xl border ${
            telemetry.formulaBreakdown.knockoutPenalties > 0
              ? 'bg-rose-500/5 border-rose-500/30'
              : 'bg-surface/60 border-ink/5'
          }`}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink-muted">Kary zerojedynkowe</span>
              <span className="font-mono text-[10px] text-rose-500">−100 pkt max</span>
            </div>
            <span className={`mt-1 block text-2xl font-bold font-mono ${
              telemetry.formulaBreakdown.knockoutPenalties > 0 ? 'text-rose-500' : 'text-emerald-500'
            }`}>
              −{telemetry.formulaBreakdown.knockoutPenalties}
            </span>
            <p className="mt-2 text-[11px] leading-snug text-ink-faint">
              {telemetry.formulaBreakdown.knockoutPenalties === 0
                ? 'Brak niespełnionych wymagań formalnych.'
                : 'Niespełnione kryteria odrzucają profil niezależnie od reszty wyniku.'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Język */}
          <div className="p-5 rounded-2xl bg-surface/60 border border-ink/5 space-y-3">
            <h4 className="text-sm font-bold text-ink flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-brand-fg" /> Telemetria językowa
            </h4>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
              <span>Tokeny w profilu: <strong className="font-mono text-ink">{telemetry.linguisticTelemetry.totalExtractedTokens}</strong></span>
              <span>Sprawczość (cz. dokonane): <strong className="font-mono text-ink">{Math.round(telemetry.linguisticTelemetry.actionVerbRatio * 100)}%</strong> zdań</span>
            </div>

            {telemetry.linguisticTelemetry.missingCriticalLemmas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-ink mb-1.5">Brakujące krytyczne lematy:</p>
                <div className="flex flex-wrap gap-1.5">
                  {telemetry.linguisticTelemetry.missingCriticalLemmas.map((lemma) => (
                    <span key={lemma} className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" /> {lemma}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {telemetry.linguisticTelemetry.matchedLemmas.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-ink/5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken/60 text-ink-faint">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Lemat</th>
                      <th className="px-2 py-2 font-semibold text-center">CV</th>
                      <th className="px-2 py-2 font-semibold text-center">JD</th>
                      <th className="px-3 py-2 font-semibold text-right">Gęstość</th>
                    </tr>
                  </thead>
                  <tbody>
                    {telemetry.linguisticTelemetry.matchedLemmas.slice(0, 6).map((lemma) => (
                      <tr key={lemma.term} className="border-t border-ink/5">
                        <td className="px-3 py-1.5 font-medium text-ink truncate max-w-[180px]" title={lemma.term}>
                          {lemma.term}
                          {lemma.densityRatio > STUFFING_DENSITY_THRESHOLD && (
                            <span className="ml-1.5 rounded bg-rose-500/10 px-1 text-[10px] font-bold text-rose-500" title="Podejrzenie upychania słów kluczowych">upychanie słów kluczowych?</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono text-ink-muted">{lemma.countInCv}</td>
                        <td className="px-2 py-1.5 text-center font-mono text-ink-muted">{lemma.countInJd}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-ink">{formatDecimalPl(lemma.densityRatio, 1)}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Struktura */}
          <div className="p-5 rounded-2xl bg-surface/60 border border-ink/5 space-y-3">
            <h4 className="text-sm font-bold text-ink flex items-center gap-2">
              <Layers className="h-4 w-4 text-brand-fg" /> Parsowalność struktury
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-lg bg-surface/80 border border-ink/5">
                <p className="text-[11px] text-ink-faint">Kolejność czytania</p>
                <p className={`mt-0.5 text-sm font-bold font-mono ${
                  telemetry.structuralTelemetry.readingOrderIntegrity === 'STABLE' ? 'text-emerald-500' : 'text-rose-500'
                }`}>
                  {telemetry.structuralTelemetry.readingOrderIntegrity}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-surface/80 border border-ink/5">
                <p className="text-[11px] text-ink-faint">Hierarchia nagłówków</p>
                <p className={`mt-0.5 text-sm font-bold font-mono ${telemetry.structuralTelemetry.headingHierarchyValid ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {telemetry.structuralTelemetry.headingHierarchyValid ? 'VALID' : 'FLAT'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-surface/80 border border-ink/5">
                <p className="text-[11px] text-ink-faint">Tabele</p>
                <p className={`mt-0.5 text-sm font-bold font-mono ${telemetry.structuralTelemetry.tableCount > 0 ? 'text-amber-500' : 'text-ink'}`}>
                  {telemetry.structuralTelemetry.tableCount}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-surface/80 border border-ink/5">
                <p className="text-[11px] text-ink-faint">Znaki nietypowe</p>
                <p className="mt-0.5 text-sm font-bold font-mono text-ink">{telemetry.structuralTelemetry.unsupportedCharactersCount}</p>
              </div>
            </div>
            <p className="text-[11px] leading-snug text-ink-faint">
              Pomiar dotyczy dokumentu kanonicznego renderowanego z Twojego profilu — jego jednokolumnowy porządek jest stabilny z konstrukcji eksportu.
            </p>
          </div>
        </div>

        {/* Mierzone wymiary zgodności */}
        <p className="mt-6 text-[11px] text-ink-faint">
          Wskaźniki heurystyczne mierzonych cech dokumentu. Wynik CVelocity nie jest wynikiem zewnętrznego systemu ATS ani gwarancją rekrutacji.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {telemetry.systemVulnerabilities.map((system) => (
            <div key={system.systemId} className="p-5 rounded-2xl border border-ink/5 bg-surface/60 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-ink">{system.featureName}</p>
                  <p className="text-[11px] text-ink-faint">{system.systemCategory} • heurystyka techniczna</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white ${
                  system.passProbability >= 75 ? 'bg-emerald-500' : system.passProbability >= 50 ? 'bg-blue-500' : system.passProbability >= 30 ? 'bg-amber-500' : 'bg-rose-500'
                }`}>
                  {system.passProbability}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    system.passProbability >= 75 ? 'bg-emerald-500' : system.passProbability >= 50 ? 'bg-blue-500' : system.passProbability >= 30 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${system.passProbability}%` }}
                />
              </div>

              {system.criticalRisks.length > 0 && (
                <ul className="space-y-1.5">
                  {system.criticalRisks.map((risk) => (
                    <li key={risk} className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-muted">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              )}
              {system.complianceReasons.length > 0 && (
                <ul className="space-y-1.5">
                  {system.complianceReasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-muted">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4. Panel Realistycznej Oceny Predyspozycji i Ścieżek Alternatywnych */}
      <div className={`p-6 rounded-3xl border ${
        consensus.careerFitAdvice.isRealisticFit
          ? 'border-emerald-500/20 bg-emerald-500/5'
          : 'border-amber-500/25 bg-amber-500/5'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl ${consensus.careerFitAdvice.isRealisticFit ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
            <Compass className="h-6 w-6" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink">
                Uczciwa Ocena Predyspozycji do tego stanowiska
              </h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${consensus.careerFitAdvice.isRealisticFit ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                {consensus.careerFitAdvice.isRealisticFit ? 'Dopasowanie Realne' : 'Rozbieżność Kompetencji'}
              </span>
            </div>
            <p className="text-sm text-ink-muted leading-relaxed">
              {consensus.careerFitAdvice.verdict}
            </p>
            <div className="p-3 rounded-xl bg-surface/80 border border-ink/5 text-xs text-ink">
              <strong>Rekomendowany plan działania:</strong> {consensus.careerFitAdvice.actionablePlan}
            </div>

            {!consensus.careerFitAdvice.isRealisticFit && consensus.careerFitAdvice.suggestedAlternativeRoles.length > 0 && (
              <div className="pt-2">
                <span className="text-xs font-bold text-ink-muted block mb-1.5">
                  Sugerowane role pokrewne o lepszym dopasowaniu do Twojego profilu:
                </span>
                <div className="flex flex-wrap gap-2">
                  {consensus.careerFitAdvice.suggestedAlternativeRoles.map((roleName, rIdx) => (
                    <span
                      key={rIdx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface border border-ink/10 text-xs font-semibold text-ink"
                    >
                      <ArrowRight className="h-3 w-3 text-brand-fg" /> {roleName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Siatka 10 Krążków Silników Weryfikacji */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink flex items-center gap-2">
            <Award className="h-5 w-5 text-brand-fg" /> Oceny 10 Silników i Modułów CVelocity
          </h2>
          <span className="text-xs text-ink-faint hidden sm:inline">
            Kliknij silnik, aby zobaczyć szczegółowy audyt i propozycje zmian
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
          {consensus.engines.map((engine) => {
            const isSelected = engine.id === selectedEngineId;
            const style = getStatusColor(engine.status);

            return (
              <motion.button
                key={engine.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedEngineId(engine.id)}
                className={`relative flex flex-col items-center justify-between p-4 rounded-2xl border text-center transition-all duration-200 ${
                  isSelected
                    ? 'border-brand ring-2 ring-brand/30 shadow-brand-glow bg-surface-raised'
                    : 'border-ink/10 bg-surface/60 hover:bg-surface-raised/80'
                }`}
              >
                {/* Score badge top */}
                <div className="relative mb-2 flex items-center justify-center">
                  <svg className="h-16 w-16 -rotate-90 transform" viewBox="0 0 60 60">
                    <circle
                      cx="30"
                      cy="30"
                      r="24"
                      stroke="currentColor"
                      strokeWidth="5"
                      fill="transparent"
                      className="text-surface-sunken"
                    />
                    <circle
                      cx="30"
                      cy="30"
                      r="24"
                      stroke="currentColor"
                      strokeWidth="5"
                      fill="transparent"
                      strokeDasharray={150}
                      strokeDashoffset={150 - (150 * engine.score) / 100}
                      strokeLinecap="round"
                      className={engine.score >= 80 ? 'text-emerald-500' : engine.score >= 65 ? 'text-blue-500' : 'text-amber-500'}
                    />
                  </svg>
                  <span className="absolute text-sm font-black font-mono text-ink">
                    {engine.score}%
                  </span>
                </div>

                <div className="w-full">
                  <div className="text-xs font-bold text-ink truncate" title={engine.name}>
                    {engine.name}
                  </div>
                  <div className="text-[10px] text-ink-faint truncate" title={engine.component}>
                    {engine.component}
                  </div>
                </div>

                <div className="mt-2 w-full">
                  <span className={`block w-full py-0.5 text-[9px] font-extrabold rounded-full ${style.badge}`}>
                    {style.label}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 5. Karta Szczegółowego Audytu Wybranego Modułu */}
      {activeEngine && (
        <motion.div
          key={activeEngine.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-ink/10 bg-surface-raised p-6 sm:p-8 shadow-card-glass"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-ink/5 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-ink">{activeEngine.name}</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand/10 text-brand-fg font-semibold">
                  {activeEngine.component}
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                Kategoria weryfikacji: <strong className="text-ink">{activeEngine.category}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs text-ink-faint block">Ocena tego modułu</span>
                <span className="text-2xl font-black font-mono text-brand-fg">{activeEngine.score}%</span>
              </div>
              <span className={`px-3 py-1 rounded-xl text-xs font-extrabold ${getStatusColor(activeEngine.status).badge}`}>
                {getStatusColor(activeEngine.status).label}
              </span>
            </div>
          </div>

          <div className="mt-4 text-xs font-mono text-ink-muted bg-surface/50 p-2.5 rounded-xl border border-ink/5">
            <strong>Kryteria i wagi oceniania:</strong> {activeEngine.weightsFocus}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Zalety */}
            <div className="space-y-3 rounded-2xl bg-emerald-500/5 p-4 border border-emerald-500/15">
              <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Co zostało ocenione pozytywnie:
              </h4>
              <ul className="space-y-2 text-xs text-ink-muted">
                {activeEngine.keyStrengths.map((str, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold mt-0.5">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Kary i zastrzeżenia */}
            <div className="space-y-3 rounded-2xl bg-amber-500/5 p-4 border border-amber-500/15">
              <h4 className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Co obniżyło ocenę (Zastrzeżenia):
              </h4>
              {activeEngine.penaltiesAndFlags.length > 0 ? (
                <ul className="space-y-2 text-xs text-ink-muted">
                  {activeEngine.penaltiesAndFlags.map((flag, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                      <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-muted">Brak zastrzeżeń — moduł nie naliczył żadnych kar punktowych.</p>
              )}
            </div>
          </div>

          {/* Konkretne propozycje zmian */}
          {activeEngine.proposals && activeEngine.proposals.length > 0 && (
            <div className="mt-6 p-4 rounded-2xl bg-surface/80 border border-brand/20 space-y-2">
              <span className="text-xs font-bold text-brand-fg flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4" /> Konkretne propozycje modyfikacji w CV:
              </span>
              <ul className="space-y-1.5 text-xs text-ink-muted pl-1">
                {activeEngine.proposals.map((prop, pIdx) => (
                  <li key={pIdx} className="flex items-start gap-2">
                    <span className="text-brand-fg font-bold">→</span>
                    <span>{prop}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 p-3.5 rounded-2xl bg-surface border border-ink/5 flex items-start gap-3">
            <HelpCircle className="h-4 w-4 text-brand-fg shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-ink block">Wskazówka:</span>
              <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{activeEngine.recommendation}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* 6. Przewodnik Inżynierii CV: 6 Złotych Zasad */}
      <div className="space-y-4 pt-4 border-t border-ink/5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-fg">
            <BookOpen className="h-4 w-4" />
            <span>Standardy Inżynierii CV</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-ink">
            6 Zasad Tworzenia CV pod Systemy Rekrutacyjne i Rekruterów
          </h2>
          <p className="text-xs text-ink-muted">
            Praktyczne przykłady „Źle vs Dobrze”, które uczą jak formułować doświadczenie i umiejętności, aby osiągnąć wysoki wynik bez sztucznego lania wody.
          </p>
        </div>

        <div className="space-y-3">
          {consensus.globalBestPractices.map((practice, idx) => {
            const isOpen = openPracticeIdx === idx;

            return (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-ink/10 bg-surface/60 transition-colors"
              >
                <button
                  onClick={() => setOpenPracticeIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-4 text-left font-semibold text-sm text-ink hover:bg-surface-raised/50"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand/10 text-brand-fg text-xs font-bold font-mono">
                      {idx + 1}
                    </span>
                    {practice.title}
                  </span>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-ink-muted" /> : <ChevronDown className="h-4 w-4 text-ink-muted" />}
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-ink/5 px-4 pb-4 pt-3 text-xs space-y-3 bg-surface-raised/40"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/15">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-1">
                            ❌ Źle (Odrzucane przez filtry):
                          </span>
                          <p className="text-ink-muted font-mono text-[11px] leading-relaxed">{practice.badExample}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                            ✅ Dobrze (Wysoka Ocena i Czytelność):
                          </span>
                          <p className="text-ink-muted font-mono text-[11px] leading-relaxed">{practice.goodExample}</p>
                        </div>
                      </div>

                      <p className="text-xs text-ink-muted leading-relaxed italic bg-surface/50 p-2.5 rounded-xl border border-ink/5">
                        💡 <strong>Dlaczego to ma znaczenie:</strong> {practice.explanation}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
