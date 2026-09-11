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

const HEURISTIC_PROFILE_LABELS = [
  {
    name: 'Odczyt liniowy i struktura',
    category: 'kolejność tekstu, tabele, znaki i nagłówki',
  },
  {
    name: 'Frazy i reguły logiczne',
    category: 'pokrycie wymagań, gęstość fraz i kryteria formalne',
  },
  {
    name: 'Mapowanie sekcji i czytelność',
    category: 'nagłówki, znaki i opis doświadczenia',
  },
] as const;

export const AtsLabView: React.FC<AtsLabViewProps> = ({
  vault,
  jobOfferText = '',
  targetRole = '',
}) => {
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

  const consensus = useMemo(
    () => simulateMultiEngineATS(vault, customJdText, customRole),
    [vault, customJdText, customRole]
  );

  const telemetry = useMemo(
    () => buildAtsTelemetryReport({ vault, jobDescription: customJdText }),
    [vault, customJdText]
  );

  const activeEngine = useMemo(
    () => consensus.engines.find((engine) => engine.id === selectedEngineId) || consensus.engines[0],
    [consensus.engines, selectedEngineId]
  );

  const getStatusColor = (status?: AtsEngineResult['status'] | string) => {
    switch (status) {
      case 'OPTIMAL':
        return { badge: 'bg-emerald-500 text-white', label: 'Wysoki wynik' };
      case 'ACCEPTABLE':
        return { badge: 'bg-blue-500 text-white', label: 'Umiarkowany wynik' };
      case 'RISKY':
        return { badge: 'bg-amber-500 text-white', label: 'Niski wynik' };
      case 'REJECTED':
        return { badge: 'bg-rose-500 text-white', label: 'Bardzo niski wynik' };
      default:
        return { badge: 'bg-ink/60 text-white', label: 'Brak oceny' };
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-fg">
            <Layers className="h-4 w-4" />
            <span>Laboratorium reguł CVelocity</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Audyt CVelocity i konsensus modułów
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            {consensus.engines.length} wewnętrznych modułów ocenia mierzalne cechy profilu i ogłoszenia.
            Wyniki nie pochodzą z zewnętrznych ATS i nie są prawdopodobieństwem przejścia rekrutacji.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" /> {consensus.engines.length} modułów CVelocity
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-fg">
            <Zap className="h-3.5 w-3.5" /> reguły deterministyczne
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-brand/20 bg-surface-raised/80 p-6 shadow-card-glass backdrop-blur-xl sm:p-8">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-ink/5 bg-surface/50 p-4 text-center lg:col-span-4">
            <ScoreRing value={consensus.medianScore} label="Mediana modułów" />
            <span className="mt-2 block text-[11px] text-ink-faint">
              mediana wewnętrznych reguł CVelocity, nie benchmark rynku
            </span>
            <span className={`mt-4 rounded-full px-2.5 py-0.5 text-xs font-extrabold text-white ${
              consensus.medianScore >= 80 ? 'bg-emerald-500' : consensus.medianScore >= 65 ? 'bg-blue-500' : 'bg-amber-500'
            }`}>
              {consensus.medianScore >= 80
                ? 'Wysoka zgodność z regułami'
                : consensus.medianScore >= 65
                  ? 'Umiarkowana zgodność z regułami'
                  : 'Niska zgodność z regułami'}
            </span>
          </div>

          <div className="space-y-5 lg:col-span-8">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                <Sparkles className="h-5 w-5 text-brand-fg" /> Uzasadnienie oceny CVelocity
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted sm:text-base">
                {consensus.summaryJustification}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Średnia', consensus.meanScore],
                ['Minimum', consensus.minScore],
                ['Maksimum', consensus.maxScore],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-ink/5 bg-surface/60 p-3 text-center">
                  <span className="block text-xs text-ink-faint">{label}</span>
                  <span className="mt-0.5 block font-mono text-xl font-bold text-ink">{value}%</span>
                </div>
              ))}
              <div className="rounded-xl border border-ink/5 bg-surface/60 p-3 text-center">
                <span className="block text-xs text-ink-faint">Liczba modułów</span>
                <span className="mt-0.5 block font-mono text-xl font-bold text-brand-fg">{consensus.engines.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-ink/10 bg-surface-raised/80 p-6 shadow-card-glass backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <Zap className="h-5 w-5 text-brand-fg" /> Mierzone cechy dokumentu
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Pokrycie lematów, doświadczenie i metryki, struktura dokumentu, język sprawczy oraz kary za rozpoznane wymagania formalne.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-ink/5 bg-surface/60 px-5 py-3 text-center">
            <span className="font-mono text-3xl font-black text-ink">{telemetry.overallScore}%</span>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-faint">Wynik telemetrii</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {([
            ['Pokrycie lematów', '40%', telemetry.formulaBreakdown.hardSkillsScore],
            ['Doświadczenie i metryki', '25%', telemetry.formulaBreakdown.experienceScore],
            ['Struktura dokumentu', '20%', telemetry.formulaBreakdown.structureScore],
            ['Sprawczość języka', '15%', telemetry.formulaBreakdown.actionVerbsScore],
          ] as const).map(([label, weight, value]) => (
            <div key={label} className="rounded-xl border border-ink/5 bg-surface/60 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-muted">{label}</span>
                <span className="font-mono text-[10px] text-brand-fg">waga {weight}</span>
              </div>
              <span className="mt-1 block font-mono text-2xl font-bold text-ink">{value}</span>
            </div>
          ))}
          <div className="rounded-xl border border-ink/5 bg-surface/60 p-4">
            <span className="text-xs font-semibold text-ink-muted">Kary formalne</span>
            <span className={`mt-1 block font-mono text-2xl font-bold ${telemetry.formulaBreakdown.knockoutPenalties > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              −{telemetry.formulaBreakdown.knockoutPenalties}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-ink/5 bg-surface/60 p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
              <BookOpen className="h-4 w-4 text-brand-fg" /> Telemetria językowa
            </h3>
            <p className="text-xs text-ink-muted">
              Tokeny w profilu: <strong className="font-mono text-ink">{telemetry.linguisticTelemetry.totalExtractedTokens}</strong> · sprawczość języka:{' '}
              <strong className="font-mono text-ink">{Math.round(telemetry.linguisticTelemetry.actionVerbRatio * 100)}%</strong> zdań
            </p>
            {telemetry.linguisticTelemetry.missingCriticalLemmas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {telemetry.linguisticTelemetry.missingCriticalLemmas.map((lemma) => (
                  <span key={lemma} className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {lemma}
                  </span>
                ))}
              </div>
            )}
            {telemetry.linguisticTelemetry.matchedLemmas.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-ink/5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken/60 text-ink-faint">
                    <tr><th className="px-3 py-2">Lemat</th><th className="px-2 py-2 text-center">CV</th><th className="px-2 py-2 text-center">JD</th><th className="px-3 py-2 text-right">Gęstość</th></tr>
                  </thead>
                  <tbody>
                    {telemetry.linguisticTelemetry.matchedLemmas.slice(0, 6).map((lemma) => (
                      <tr key={lemma.term} className="border-t border-ink/5">
                        <td className="px-3 py-1.5 font-medium text-ink">
                          {lemma.term}
                          {lemma.densityRatio > STUFFING_DENSITY_THRESHOLD && <span className="ml-1 text-[10px] text-rose-500">wysoka gęstość</span>}
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono">{lemma.countInCv}</td>
                        <td className="px-2 py-1.5 text-center font-mono">{lemma.countInJd}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatDecimalPl(lemma.densityRatio, 1)}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-ink/5 bg-surface/60 p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
              <Layers className="h-4 w-4 text-brand-fg" /> Struktura
            </h3>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-lg border border-ink/5 bg-surface/80 p-3">Kolejność: <strong>{telemetry.structuralTelemetry.readingOrderIntegrity}</strong></div>
              <div className="rounded-lg border border-ink/5 bg-surface/80 p-3">Nagłówki: <strong>{telemetry.structuralTelemetry.headingHierarchyValid ? 'VALID' : 'FLAT'}</strong></div>
              <div className="rounded-lg border border-ink/5 bg-surface/80 p-3">Tabele: <strong>{telemetry.structuralTelemetry.tableCount}</strong></div>
              <div className="rounded-lg border border-ink/5 bg-surface/80 p-3">Znaki nietypowe: <strong>{telemetry.structuralTelemetry.unsupportedCharactersCount}</strong></div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-surface/60 p-4">
          <h3 className="text-sm font-bold text-ink">Trzy profile heurystyczne CVelocity</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
            Te profile grupują mierzone cechy dokumentu. Ich liczby nie są wynikami ani prawdopodobieństwami z konkretnych zewnętrznych ATS.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {telemetry.systemVulnerabilities.map((profileResult, index) => {
              const label = HEURISTIC_PROFILE_LABELS[index] ?? {
                name: `Profil regułowy ${index + 1}`,
                category: 'wewnętrzna kombinacja cech CVelocity',
              };
              return (
                <div key={profileResult.systemId} className="space-y-3 rounded-2xl border border-ink/5 bg-surface/60 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-ink">{label.name}</p>
                      <p className="text-[11px] text-ink-faint">{label.category}</p>
                    </div>
                    <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-extrabold text-on-brand">{profileResult.passProbability}%</span>
                  </div>
                  {profileResult.criticalRisks.length > 0 && (
                    <ul className="space-y-1.5">
                      {profileResult.criticalRisks.map((risk) => (
                        <li key={risk} className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-muted">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" /> {risk}
                        </li>
                      ))}
                    </ul>
                  )}
                  {profileResult.complianceReasons.length > 0 && (
                    <ul className="space-y-1.5">
                      {profileResult.complianceReasons.map((reason) => (
                        <li key={reason} className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-muted">
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" /> {reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`rounded-3xl border p-6 ${consensus.careerFitAdvice.isRealisticFit ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5'}`}>
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-brand/10 p-3 text-brand-fg"><Compass className="h-6 w-6" /></div>
          <div className="flex-1 space-y-2">
            <h2 className="text-base font-bold text-ink">Ocena dopasowania profilu według reguł CVelocity</h2>
            <p className="text-sm leading-relaxed text-ink-muted">{consensus.careerFitAdvice.verdict}</p>
            <div className="rounded-xl border border-ink/5 bg-surface/80 p-3 text-xs text-ink">
              <strong>Rekomendowany plan działania:</strong> {consensus.careerFitAdvice.actionablePlan}
            </div>
            {!consensus.careerFitAdvice.isRealisticFit && consensus.careerFitAdvice.suggestedAlternativeRoles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {consensus.careerFitAdvice.suggestedAlternativeRoles.map((roleName) => (
                  <span key={roleName} className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-surface px-3 py-1 text-xs font-semibold text-ink">
                    <ArrowRight className="h-3 w-3 text-brand-fg" /> {roleName}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
            <Award className="h-5 w-5 text-brand-fg" /> Oceny modułów CVelocity
          </h2>
          <span className="hidden text-xs text-ink-faint sm:inline">Kliknij moduł, aby zobaczyć jego reguły i zastrzeżenia</span>
        </div>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-5">
          {consensus.engines.map((engine) => {
            const isSelected = engine.id === selectedEngineId;
            const style = getStatusColor(engine.status);
            return (
              <motion.button
                key={engine.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedEngineId(engine.id)}
                className={`relative flex flex-col items-center justify-between rounded-2xl border p-4 text-center transition-all ${isSelected ? 'border-brand bg-surface-raised ring-2 ring-brand/30' : 'border-ink/10 bg-surface/60'}`}
              >
                <span className="font-mono text-2xl font-black text-ink">{engine.score}%</span>
                <div className="mt-2 w-full">
                  <div className="truncate text-xs font-bold text-ink" title={engine.name}>{engine.name}</div>
                  <div className="truncate text-[10px] text-ink-faint" title={engine.component}>{engine.component}</div>
                </div>
                <span className={`mt-2 block w-full rounded-full py-0.5 text-[9px] font-extrabold ${style.badge}`}>{style.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {activeEngine && (
        <motion.div
          key={activeEngine.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-ink/10 bg-surface-raised p-6 shadow-card-glass sm:p-8"
        >
          <div className="flex flex-col gap-4 border-b border-ink/5 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-ink">{activeEngine.name}</h3>
              <p className="mt-1 text-xs text-ink-muted">Kategoria reguły: <strong>{activeEngine.category}</strong></p>
            </div>
            <div className="text-right">
              <span className="block text-xs text-ink-faint">Wynik modułu CVelocity</span>
              <span className="font-mono text-2xl font-black text-brand-fg">{activeEngine.score}%</span>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-ink/5 bg-surface/50 p-2.5 font-mono text-xs text-ink-muted">
            <strong>Kryteria i wagi:</strong> {activeEngine.weightsFocus}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
              <h4 className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Pozytywne sygnały</h4>
              <ul className="space-y-2 text-xs text-ink-muted">
                {activeEngine.keyStrengths.map((strength) => <li key={strength}>• {strength}</li>)}
              </ul>
            </div>
            <div className="space-y-3 rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4">
              <h4 className="flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-400"><AlertTriangle className="h-4 w-4" /> Zastrzeżenia reguły</h4>
              {activeEngine.penaltiesAndFlags.length > 0 ? (
                <ul className="space-y-2 text-xs text-ink-muted">
                  {activeEngine.penaltiesAndFlags.map((flag) => <li key={flag} className="flex gap-2"><XCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />{flag}</li>)}
                </ul>
              ) : <p className="text-xs text-ink-muted">Brak zastrzeżeń naliczonych przez ten moduł.</p>}
            </div>
          </div>

          {activeEngine.proposals?.length > 0 && (
            <div className="mt-6 space-y-2 rounded-2xl border border-brand/20 bg-surface/80 p-4">
              <span className="flex items-center gap-1.5 text-xs font-bold text-brand-fg"><Lightbulb className="h-4 w-4" /> Propozycje zmian</span>
              <ul className="space-y-1.5 text-xs text-ink-muted">
                {activeEngine.proposals.map((proposal) => <li key={proposal}>→ {proposal}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-ink/5 bg-surface p-3.5">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-fg" />
            <p className="text-xs leading-relaxed text-ink-muted">{activeEngine.recommendation}</p>
          </div>
        </motion.div>
      )}

      <div className="space-y-4 border-t border-ink/5 pt-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-fg"><BookOpen className="h-4 w-4" /><span>Praktyki redakcyjne</span></div>
          <h2 className="mt-1 text-xl font-bold text-ink">Przykłady poprawy czytelności CV</h2>
          <p className="text-xs text-ink-muted">To wskazówki redakcyjne CVelocity, nie reguły gwarantujące akceptację przez konkretny ATS.</p>
        </div>

        <div className="space-y-3">
          {consensus.globalBestPractices.map((practice, index) => {
            const isOpen = openPracticeIdx === index;
            return (
              <div key={practice.title} className="overflow-hidden rounded-2xl border border-ink/10 bg-surface/60">
                <button onClick={() => setOpenPracticeIdx(isOpen ? null : index)} className="flex w-full items-center justify-between p-4 text-left text-sm font-semibold text-ink hover:bg-surface-raised/50">
                  <span className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand/10 font-mono text-xs font-bold text-brand-fg">{index + 1}</span>{practice.title}</span>
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-3 border-t border-ink/5 bg-surface-raised/40 px-4 pb-4 pt-3 text-xs">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 p-3"><span className="mb-1 block text-[10px] font-extrabold uppercase text-rose-600">Mniej czytelnie</span><p className="font-mono text-[11px] text-ink-muted">{practice.badExample}</p></div>
                        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3"><span className="mb-1 block text-[10px] font-extrabold uppercase text-emerald-600">Czytelniej</span><p className="font-mono text-[11px] text-ink-muted">{practice.goodExample}</p></div>
                      </div>
                      <p className="rounded-xl border border-ink/5 bg-surface/50 p-2.5 text-xs italic text-ink-muted"><strong>Dlaczego:</strong> {practice.explanation}</p>
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
