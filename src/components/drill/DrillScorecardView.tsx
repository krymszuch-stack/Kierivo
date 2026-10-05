import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Award,
  Sparkles,
  TrendingUp,
  User,
  Users,
  BookOpen,
  Check,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { DrillScorecard } from '../../lib/drillEngine';
import { Chip } from '../ui/Chip';

export interface DrillScorecardViewProps {
  scorecard: DrillScorecard;
  referenceNotes?: string;
  className?: string;
}

export const DrillScorecardView: React.FC<DrillScorecardViewProps> = ({
  scorecard,
  referenceNotes,
  className = '',
}) => {
  const { structure, metrics, ownership, suggestions } = scorecard;

  if (structure.scorePercent === null) {
    return (
      <div role="status" className={`rounded-2xl border border-dashed border-line bg-surface p-6 text-center ${className}`}>
        <h4 className="text-sm font-bold text-ink">Brak tekstu odpowiedzi</h4>
        <p className="mt-1 text-xs text-muted">
          Bez tekstu nie ma sygnałów do pokazania. Samo nagranie nie jest transkrybowane ani analizowane.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Wynik całościowy pozostaje nieobliczany; poniżej pokazujemy wykryte sygnały. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-line bg-surface p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-brand-600" />
            <h4 className="text-sm font-extrabold text-ink uppercase tracking-wider font-mono">
              Wskaźniki odpowiedzi — Mock Drill
            </h4>
          </div>
          <p className="text-xs text-muted">
            Proste wzorce wskazują słowa i liczby. Nie mierzą jakości ani prawdziwości odpowiedzi.
          </p>
        </div>

        <div role="status" className="max-w-xs rounded-xl border border-line bg-sunken px-3 py-2 text-right">
          <span className="block text-xs font-bold text-ink">Ocena całościowa: nie jest mierzona</span>
          <span className="block text-[10px] text-muted">
            Wskaźniki tekstowe nie są skalibrowanym wynikiem jakości.
          </span>
        </div>
      </div>

      {/* 2. Trzy filary oceny: Structure (STAR), Metrics, Ownership ("I" vs "We") */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Filar 1: Structure (STAR?) */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider text-muted">
              1. Struktura (STAR)
            </span>
            <span className="font-mono text-xs font-bold text-ink">
              {structure.detectedElementsCount}/4
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <div
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-mono font-semibold ${
                structure.hasSituation ? 'bg-success-soft text-success-fg' : 'bg-sunken text-muted'
              }`}
            >
              {structure.hasSituation ? <Check className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              <span>S — Sytuacja</span>
            </div>

            <div
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-mono font-semibold ${
                structure.hasTask ? 'bg-success-soft text-success-fg' : 'bg-sunken text-muted'
              }`}
            >
              {structure.hasTask ? <Check className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              <span>T — Zadanie</span>
            </div>

            <div
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-mono font-semibold ${
                structure.hasAction ? 'bg-success-soft text-success-fg' : 'bg-sunken text-muted'
              }`}
            >
              {structure.hasAction ? <Check className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              <span>A — Działanie</span>
            </div>

            <div
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-mono font-semibold ${
                structure.hasResult ? 'bg-success-soft text-success-fg' : 'bg-sunken text-muted'
              }`}
            >
              {structure.hasResult ? <Check className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              <span>R — Rezultat</span>
            </div>
          </div>
        </div>

        {/* Filar 2: Metrics (✔️/❌) */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider text-muted">
              2. Metryki Liczbowe
            </span>
            <span
              className={`font-mono text-xs font-bold ${
                metrics.hasMetrics ? 'text-success-fg' : 'text-warning-fg'
              }`}
            >
              {metrics.hasMetrics ? '✔️ Obecne' : '❌ Brak'}
            </span>
          </div>

          <div className="pt-1">
            {metrics.hasMetrics ? (
              <div className="flex flex-wrap gap-1">
                {metrics.detectedMetrics.map((m, idx) => (
                  <span
                    key={idx}
                    className="rounded bg-success-soft px-2 py-0.5 font-mono text-[11px] font-bold text-success-fg"
                  >
                    {m}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-muted block leading-snug">
                Brak wykrytych liczb, procentów (%) lub jednostek czasowych/finansowych.
              </span>
            )}
          </div>
        </div>

        {/* Wzmianki językowe nie dowodzą samodzielnego wkładu. */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-2">
          <div>
            <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider text-muted">
              3. Wzmianki o wkładzie własnym i zespołu
            </span>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[10px] font-mono text-muted">
              <span className="flex items-center gap-0.5">
                <User className="h-3 w-3 text-brand-600" />
                <span>Formy pierwszej osoby: {ownership.iCount}</span>
              </span>
              <span className="flex items-center gap-0.5">
                <Users className="h-3 w-3 text-subtle" />
                <span>Formy grupowe: {ownership.weCount}</span>
              </span>
            </div>

            <span className="text-[10px] text-muted block leading-tight">
              To liczba rozpoznanych słów, nie ocena faktycznego wkładu.
            </span>
          </div>
        </div>
      </div>

      {/* 3. Twoja Notatka ze Ściągi (Model Reference Notes) */}
      {referenceNotes && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-brand-700">
            <BookOpen className="h-4 w-4" />
            <h5 className="text-xs font-bold uppercase tracking-wider font-mono">
              Twoja Notatka ze Ściągi Rekrutacyjnej (odniesienie: Master Vault)
            </h5>
          </div>
          <p className="text-xs text-ink/90 font-mono leading-relaxed pl-6">
            {referenceNotes}
          </p>
        </div>
      )}

      {/* 4. Sugestie Ulepszeń */}
      <div className="rounded-xl border border-line bg-surface p-4 space-y-2">
        <div className="flex items-center gap-2 text-ink">
          <Lightbulb className="h-4 w-4 text-warning" />
          <h5 className="text-xs font-bold uppercase tracking-wider font-mono">
            Sugestie Ulepszeń Odpowiedzi
          </h5>
        </div>
        <ul className="space-y-1.5 pl-6 list-disc text-xs text-ink/90">
          {suggestions.map((sug, idx) => (
            <li key={idx} className="leading-relaxed">
              {sug}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
