import React from 'react';
import { AtsCheckResult } from '../../types';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { CanonicalAtsScore } from '../../lib/canonicalAts';
import { buildGapMetrics } from './gapAnalysisData';

export interface GapAnalysisProps {
  result: AtsCheckResult;
  canonicalResult?: CanonicalAtsScore;
  className?: string;
}

/**
 * Jeden wiersz analizy luk. `value === undefined` znaczy „ta warstwa nie
 * przeliczyła się dla tej oferty" i pokazujemy brak danych, a nie liczbę.
 * Wcześniej w tym miejscu stały stałe 75/80/85/70 — użytkownik widział konkretne
 * procenty, których nikt nie policzył (reguła 1).
 */
const GapRow: React.FC<{ label: string; value?: number }> = ({ label, value }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-xs font-semibold">
      <span className="text-ink">{label}</span>
      {value === undefined ? (
        <span className="font-mono text-muted">brak danych</span>
      ) : (
        <span className="font-mono font-bold text-ink">{value}%</span>
      )}
    </div>
    {value !== undefined && (
      <ProgressBar
        value={value}
        max={100}
        showLabel={false}
        barColor={
          value >= 80 ? 'bg-success' : value >= 60 ? 'bg-warning' : 'bg-danger'
        }
      />
    )}
  </div>
);

export const GapAnalysis: React.FC<GapAnalysisProps> = ({
  result,
  canonicalResult,
  className = '',
}) => {
  const metrics = buildGapMetrics(result, canonicalResult);

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
          {canonicalResult ? 'Składniki kanonicznej oceny dopasowania' : 'Diagnostyka zapisanej migawki'}
        </h4>
        <p className="text-[11px] text-subtle">
          {canonicalResult
            ? 'Te same składowe, które tworzą wynik główny. Wymiary bez danych są pominięte w wyniku.'
            : 'Wartości z historycznego symulatora; nie są ponownie liczone jako kanoniczny wynik.'}
        </p>
      </div>

      <div className="space-y-3.5 rounded-2xl border border-line bg-surface p-4">
        {metrics.map(({ label, value }) => <GapRow key={label} label={label} value={value} />)}
      </div>
    </div>
  );
};
