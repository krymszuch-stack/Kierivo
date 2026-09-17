import React from 'react';
import { Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { useEntitlements } from '../../store/useEntitlements';
import { Tooltip } from './Tooltip';
import {
  formatModelQuotaFeedback,
  getModelGracefulDegradationNotice,
  DegradationFeature,
} from '../../lib/modelQuotaFeedback';

export interface ModelQuotaCounterProps {
  /**
   * Wariant wyświetlania:
   * - 'badge': Kompaktowa pigułka (np. do Topbar lub nagłówków kart)
   * - 'banner': Blok z ramką i informacją o łagodnym wygaszaniu
   * - 'inline': Lekki tekst do wstawienia pod przyciskiem lub inputem
   */
  variant?: 'badge' | 'banner' | 'inline';
  /** Opcjonalne powiązanie z konkretną funkcją dla dedykowanych komunikatów wygaszania. */
  feature?: DegradationFeature;
  /** Opcjonalne nadpisanie liczby operacji (przydatne w testach lub podglądzie). */
  overrideRemaining?: number;
  /** Opcjonalna akcja po kliknięciu (np. nawigacja do cennika/zakresu bety). */
  onClick?: () => void;
  className?: string;
}

export const ModelQuotaCounter: React.FC<ModelQuotaCounterProps> = ({
  variant = 'badge',
  feature = 'general',
  overrideRemaining,
  onClick,
  className = '',
}) => {
  const { usage } = useEntitlements();
  const remaining = overrideRemaining !== undefined ? overrideRemaining : usage.aiUses;
  const feedback = formatModelQuotaFeedback(remaining);
  const degradation = getModelGracefulDegradationNotice(feature);

  // Wariant: Kompaktowy Badge (do Topbar i nagłówków)
  if (variant === 'badge') {
    const badgeColorClasses = feedback.isExhausted
      ? 'border-warning/40 bg-warning-soft text-warning-fg'
      : feedback.isLow
        ? 'border-warning/50 bg-warning-soft text-warning-fg'
        : 'border-brand-200/80 bg-brand-50/80 text-brand-fg dark:border-brand-800/60 dark:bg-brand-950/40';

    return (
      <Tooltip
        content={`${feedback.label}. ${feedback.details}`}
        side="top"
      >
        <button
          type="button"
          onClick={onClick}
          aria-label={feedback.label}
          className={`group inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all duration-[var(--duration-fast)] ${badgeColorClasses} ${
            onClick ? 'cursor-pointer hover:border-brand-400 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40' : 'cursor-default'
          } ${className}`}
        >
          <Sparkles
            className={`h-3.5 w-3.5 shrink-0 ${
              feedback.isExhausted ? 'text-warning-fg' : 'text-brand-600'
            }`}
            aria-hidden="true"
          />
          <span className="font-mono text-[11px] font-bold">
            {feedback.shortBadge}
          </span>
          <span className="hidden md:inline text-[11px] font-medium opacity-90">
            {feedback.isExhausted ? 'limit wyczerpany' : 'analiz AI'}
          </span>
        </button>
      </Tooltip>
    );
  }

  // Wariant: Banner informacyjny z łagodnym wygaszaniem (graceful degradation)
  if (variant === 'banner') {
    if (feedback.isExhausted) {
      return (
        <section
          aria-live="polite"
          className={`rounded-2xl border border-warning/40 bg-warning-soft p-4 text-xs text-ink shadow-xs ${className}`}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning-fg" aria-hidden="true" />
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-ink">{degradation.title}</h4>
                <span className="font-mono text-[10px] uppercase font-bold rounded px-1.5 py-0.5 bg-surface text-muted border border-line">
                  Limit 0/{feedback.maxDaily}
                </span>
              </div>
              <p className="text-muted leading-relaxed">{degradation.message}</p>
              <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-line bg-surface p-2 text-[11px] font-medium text-ink">
                <RefreshCw className="h-3.5 w-3.5 text-brand-600 shrink-0" aria-hidden="true" />
                <span>
                  <strong>Tryb regułowy aktywny:</strong> {degradation.fallbackDescription}
                </span>
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (feedback.isLow) {
      return (
        <div
          className={`flex items-center justify-between gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2 text-xs text-ink ${className}`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-warning-fg shrink-0" aria-hidden="true" />
            <span>
              <strong>Uwaga:</strong> {feedback.label}.
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted">odnowienie o 00:00</span>
        </div>
      );
    }

    return (
      <div
        className={`flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-muted ${className}`}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-brand-600 shrink-0" aria-hidden="true" />
          <span className="text-ink font-medium">{feedback.label}</span>
        </div>
        <span className="font-mono text-[10px] text-subtle">0 zł · Public Pre-Beta</span>
      </div>
    );
  }

  // Wariant: Inline (zwięzły tekst pod przyciskiem lub polem)
  return (
    <div className={`flex items-center gap-1.5 text-[11px] ${feedback.isExhausted ? 'text-warning-fg font-semibold' : 'text-muted'} ${className}`}>
      <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{feedback.label}</span>
    </div>
  );
};
