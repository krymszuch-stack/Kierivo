import React from 'react';
import { ShieldCheck, Lightbulb, Sparkles } from 'lucide-react';
import { AtsCheckResult } from '../../types';
import { ScoreRing } from './ScoreRing';
import { GapAnalysis } from './GapAnalysis';
import { DealbreakerList } from './DealbreakerList';
import { Card } from '../../components/ui/Card';

export interface AtsSimulatorViewProps {
  result: AtsCheckResult;
  onAddToVault?: (item: string) => void;
  className?: string;
}

function clampScore(value: number | undefined): number {
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
}

export const AtsSimulatorView: React.FC<AtsSimulatorViewProps> = ({
  result,
  onAddToVault,
  className = '',
}) => {
  /**
   * Pokazujemy wyłącznie cechy, które CVelocity rzeczywiście liczy z CV i
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
      desc: 'Format dokumentu oceniany przez reguły CVelocity',
    },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-xs">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-ink">Audyt CVelocity: zgodność z ofertą</h3>
          <p className="text-xs text-muted">
            Własna ocena regułowa CVelocity na podstawie treści CV i ogłoszenia. To nie jest wynik
            żadnego zewnętrznego systemu ATS ani gwarancja przejścia rekrutacji.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-4">
          <Card tone="raised" className="flex flex-col items-center justify-center text-center p-6 space-y-4">
            <ScoreRing score={result.overallScore} size={150} />

            <div className="w-full border-t border-line/60 pt-3">
              <span className="font-mono text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                Rozbicie algebry ważonej
              </span>
              <p className="font-mono text-[10px] text-subtle leading-tight">
                {result.layer3Scoring?.formulaBreakdown || 'Score = (3.0 × Hard Skills) + (1.5 × Recency) + (1.5 × Title)'}
              </p>
            </div>
          </Card>

          <Card tone="raised" className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Składowe wyniku CVelocity
            </h4>
            <p className="text-[11px] text-subtle">
              Każda liczba poniżej pochodzi z reguł uruchamianych przez CVelocity. Nie podszywamy ich
              pod ocenę konkretnego produktu ATS.
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
            missingItems={result.missingHardSkills || []}
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
