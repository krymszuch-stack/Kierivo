import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { TopProblem } from '../../lib/quickAtsCheck';
import { getTopProblemLabel } from '../../lib/quickOnboardingPresentation';

interface QuickCheckFindingsProps {
  problems: TopProblem[];
}

/** Renderuje tylko ustalenia zwrócone przez analizę, bez dopisywania porad domyślnych. */
export const QuickCheckFindings: React.FC<QuickCheckFindingsProps> = ({ problems }) => (
  <section aria-labelledby="quick-check-findings-title" className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h4 id="quick-check-findings-title" className="text-sm font-bold uppercase tracking-wide font-mono text-ink">
        Wnioski z tej analizy ({problems.length})
      </h4>
      <span className="text-[11px] text-muted">Wymogi, umiejętności i struktura</span>
    </div>

    {problems.length > 0 ? (
      <div className="grid grid-cols-1 gap-3">
        {problems.map((problem, idx) => {
          const isCritical = problem.severity === 'critical';
          const isWarning = problem.severity === 'warning';

          return (
            <div
              key={problem.id || idx}
              className={`flex items-start gap-3.5 rounded-2xl border p-4 transition-colors ${
                isCritical
                  ? 'border-danger/40 bg-danger-soft/60 text-danger-fg'
                  : isWarning
                  ? 'border-warning/40 bg-warning-soft/60 text-ink'
                  : 'border-line bg-surface text-ink'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isCritical ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-danger/20 text-danger-fg">
                    <AlertCircle className="h-4 w-4" />
                  </span>
                ) : isWarning ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-warning/20 text-warning-fg">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-fg">
                    <Info className="h-4 w-4" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                    Punkt #{idx + 1}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase ${
                      isCritical
                        ? 'bg-danger text-white'
                        : isWarning
                        ? 'bg-warning/30 text-warning-fg'
                        : 'bg-sunken text-muted'
                    }`}
                  >
                    {getTopProblemLabel(problem)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-bold text-ink">{problem.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{problem.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <p role="status" className="rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed text-muted">
        Analiza nie zwróciła dodatkowych ustaleń dla sprawdzonych danych. Brak wpisów nie potwierdza kompletności CV ani wyniku zewnętrznego systemu ATS.
      </p>
    )}
  </section>
);
