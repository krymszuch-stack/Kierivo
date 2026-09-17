import React from 'react';
import { ShieldCheck, Lightbulb, Sparkles, AlertTriangle, HelpCircle } from 'lucide-react';
import { AtsCheckResult } from '../../types';
import { type CanonicalAtsScore } from '../../lib/canonicalAts';
import { ScoreRing } from './ScoreRing';
import { GapAnalysis } from './GapAnalysis';
import { DealbreakerList } from './DealbreakerList';
import { Card } from '../../components/ui/Card';
import { Tooltip } from '../../components/ui/Tooltip';

export interface AtsSimulatorViewProps {
  result: AtsCheckResult;
  canonicalResult?: CanonicalAtsScore;
  onAddToVault?: (item: string) => void;
  className?: string;
}

function clampScore(value: number | undefined): number {
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
}

export const AtsSimulatorView: React.FC<AtsSimulatorViewProps> = ({
  result,
  canonicalResult,
  onAddToVault,
  className = '',
}) => {
  /**
   * Pokazujemy wyłącznie cechy, które Kierivo rzeczywiście liczy z CV i
   * ogłoszenia. Wcześniej te same liczby były podpisane nazwami zewnętrznych
   * produktów ATS, mimo że nie mieliśmy ani ich API, ani benchmarku na ich
   * produkcyjnych parserach.
   */
  const dimensionScores = [
    {
      name: 'Pokrycie fraz z ogłoszenia',
      score: clampScore(result.keywordCoverageScore),
      desc: 'Dopasowanie wykrytych słów i fraz do treści oferty',
    },
    {
      name: 'Pokrycie umiejętności twardych',
      score: clampScore(result.layer2Nlp?.hardSkillsCoverage ?? result.keywordCoverageScore),
      desc: 'Obecność wymaganych kompetencji i narzędzi w treści CV',
    },
    {
      name: 'Struktura dokumentu',
      score: clampScore(result.structureScore),
      desc: 'Nagłówki, sekcje i układ możliwy do odczytu maszynowego',
    },
    {
      name: 'Czytelność formatowania',
      score: clampScore(result.formattingScore),
      desc: 'Format dokumentu oceniany przez reguły Kierivo',
    },
  ];

  const mainScore = canonicalResult ? canonicalResult.score : clampScore(result.overallScore);

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-xs">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-ink">Szacowany wynik przejścia filtra ATS</h3>
            <Tooltip
              content="Systemy ATS (Applicant Tracking System) to oprogramowanie rekrutacyjne wstępnie weryfikujące zgodność CV przed przeczytaniem go przez człowieka. Szacujemy szanse Twojego dokumentu na podstawie słów kluczowych, uprawnień i czytelności formatu."
              side="top"
            >
              <button
                type="button"
                aria-label="Czym jest szacowany wynik filtra ATS?"
                className="inline-flex items-center justify-center text-muted hover:text-ink cursor-help transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
          <p className="text-xs text-muted">
            Szacowana ocena dopasowania na podstawie treści CV i ogłoszenia. Nie jest wynikiem
            żadnego zewnętrznego systemu ATS ani gwarancją przejścia rekrutacji.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-4">
          <Card tone="raised" className="flex flex-col items-center justify-center text-center p-6 space-y-4">
            <ScoreRing
              score={mainScore}
              size={150}
              label={canonicalResult ? 'Szacowany wynik' : 'Wynik dopasowania'}
            />

            {canonicalResult && canonicalResult.state !== 'SCORABLE' && (
              <div className="w-full rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-center">
                <span className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {canonicalResult.state === 'INSUFFICIENT_CV'
                    ? 'Uzupełnij profil zawodowy'
                    : canonicalResult.state === 'INSUFFICIENT_JD'
                    ? 'Zbyt krótka treść ogłoszenia'
                    : 'Brak wykrytych wymagań'}
                </span>
                <p className="text-[10px] text-ink-muted mt-1 leading-relaxed">
                  {canonicalResult.reason}
                </p>
              </div>
            )}

            <div className="w-full border-t border-line/60 pt-3">
              <span className="font-mono text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                Wagi poszczególnych kryteriów
              </span>
              <p className="font-mono text-[10px] text-subtle leading-tight">
                {canonicalResult
                  ? 'Umiejętności: 40% · Doświadczenie i staż: 25% · Układ dokumentu: 20% · Wymogi formalne: 15%'
                  : (result.layer3Scoring?.formulaBreakdown || 'Wymagania twarde (50%) + Doświadczenie (25%) + Tytuł roli (25%)')}
              </p>
            </div>

            {canonicalResult && (
              <div className="w-full grid grid-cols-2 gap-2 pt-3 border-t border-line/60">
                <div className="rounded-xl border border-line/60 bg-surface p-2 text-center">
                  <span className="block text-[10px] text-muted">Umiejętności (40%)</span>
                  <span className={`font-mono text-xs font-bold ${
                    canonicalResult.components.skills >= 75 ? 'text-success-fg' : canonicalResult.components.skills >= 50 ? 'text-brand-fg' : 'text-danger-fg'
                  }`}>
                    {canonicalResult.components.skills}%
                  </span>
                </div>
                <div className="rounded-xl border border-line/60 bg-surface p-2 text-center">
                  <span className="block text-[10px] text-muted">Staż i świeżość (25%)</span>
                  <span className={`font-mono text-xs font-bold ${
                    canonicalResult.components.experience >= 75 ? 'text-success-fg' : canonicalResult.components.experience >= 50 ? 'text-brand-fg' : 'text-danger-fg'
                  }`}>
                    {canonicalResult.components.experience}%
                  </span>
                </div>
                <div className="rounded-xl border border-line/60 bg-surface p-2 text-center">
                  <span className="block text-[10px] text-muted">Struktura (20%)</span>
                  <span className={`font-mono text-xs font-bold ${
                    canonicalResult.components.structure >= 75 ? 'text-success-fg' : canonicalResult.components.structure >= 50 ? 'text-brand-fg' : 'text-danger-fg'
                  }`}>
                    {canonicalResult.components.structure}%
                  </span>
                </div>
                <div className="rounded-xl border border-line/60 bg-surface p-2 text-center">
                  <span className="block text-[10px] text-muted">Formalia (15%)</span>
                  <span className={`font-mono text-xs font-bold ${
                    canonicalResult.components.formal >= 75 ? 'text-success-fg' : canonicalResult.components.formal >= 50 ? 'text-brand-fg' : 'text-danger-fg'
                  }`}>
                    {canonicalResult.components.formal}%
                  </span>
                </div>
              </div>
            )}
          </Card>

          <Card tone="raised" className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Składowe wyniku Kierivo
            </h4>
            <p className="text-[11px] text-subtle">
              Szczegółowe kryteria wyliczone z analizy Twojego CV i ogłoszenia o pracę.
            </p>

            <div className="space-y-2">
              {dimensionScores.map((dimension) => (
                <div
                  key={dimension.name}
                  className="flex items-center justify-between rounded-xl border border-line/60 bg-surface p-2.5 text-xs"
                >
                  <div className="pr-3">
                    <span className="font-bold text-ink">{dimension.name}</span>
                    <span className="block font-mono text-[10px] text-muted">{dimension.desc}</span>
                  </div>
                  <span className={`font-mono text-xs font-bold ${
                    dimension.score >= 80 ? 'text-success-fg' : dimension.score >= 60 ? 'text-warning-fg' : 'text-danger-fg'
                  }`}>
                    {dimension.score}%
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-7 space-y-5">
          <GapAnalysis result={result} />

          <DealbreakerList
            missingItems={canonicalResult?.missingRequirements?.length ? canonicalResult.missingRequirements : (result.missingHardSkills || [])}
            onAddToVault={onAddToVault}
          />
        </div>
      </div>

      {result.recommendations && result.recommendations.length > 0 && (
        <Card tone="raised" className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-warning-fg" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
              Rekomendacje optymalizacji dokumentu
            </h4>
          </div>

          <div className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 rounded-xl border border-line/60 bg-surface p-3 text-xs leading-relaxed text-ink"
              >
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
