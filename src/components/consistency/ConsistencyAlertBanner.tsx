import React from 'react';
import { AlertTriangle, Clock, Zap, Calendar, MapPin, Layers, Sparkles, AlertCircle } from 'lucide-react';
import { ConsistencyAlert } from '../../lib/consistencyGuard';
import { formatDecimalPl } from '../../lib/pluralFormat';

export interface ConsistencyAlertBannerProps {
  alerts: ConsistencyAlert[];
  onDismiss?: (alertId: string) => void;
  className?: string;
}

export const ConsistencyAlertBanner: React.FC<ConsistencyAlertBannerProps> = ({
  alerts,
  className = '',
}) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {alerts.map((alert) => {
        const isDateMismatch = alert.type === 'DATE_MISMATCH';
        const isSkillContradiction = alert.type === 'SKILL_CONTRADICTION';
        const isCareerGap = alert.type === 'CAREER_GAP';
        const isLocationConflict = alert.type === 'LOCATION_CONFLICT';
        const isOverlapping = alert.type === 'OVERLAPPING_EXPERIENCE';
        const isMissingMetrics = alert.type === 'MISSING_METRICS';
        const isDanger = alert.severity === 'ALERT';

        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 rounded-xl border p-3.5 shadow-xs transition-all animate-fadeIn ${
              isDanger
                ? 'border-danger/40 bg-danger-soft/60'
                : 'border-warning/40 bg-warning-soft/60'
            }`}
            role="alert"
          >
            <div
              className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${
                isDanger
                  ? 'bg-danger/20 text-danger-fg'
                  : 'bg-warning/20 text-warning-fg'
              }`}
            >
              {isDateMismatch && <Clock className="h-4 w-4" />}
              {isSkillContradiction && <Zap className="h-4 w-4" />}
              {isCareerGap && <Calendar className="h-4 w-4" />}
              {isLocationConflict && <MapPin className="h-4 w-4" />}
              {isOverlapping && <Layers className="h-4 w-4" />}
              {isMissingMetrics && <Sparkles className="h-4 w-4" />}
              {!isDateMismatch &&
                !isSkillContradiction &&
                !isCareerGap &&
                !isLocationConflict &&
                !isOverlapping &&
                !isMissingMetrics && <AlertTriangle className="h-4 w-4" />}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <span>{alert.title}</span>
                  {alert.claimId && (
                    <span className="rounded bg-sunken px-1.5 py-0.2 font-mono text-[10px] text-muted">
                      {alert.claimId}
                    </span>
                  )}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                    isDanger
                      ? 'bg-danger/20 text-danger-fg'
                      : 'bg-warning/20 text-warning-fg'
                  }`}
                >
                  {alert.type}
                </span>
              </div>

              <p className="text-xs leading-relaxed text-ink/90">{alert.message}</p>

              {alert.details && (
                <div className="mt-2 rounded-lg bg-surface/80 p-2 text-[11px] font-mono text-muted space-y-0.5 border border-line">
                  {alert.details.gapMonths !== undefined && (
                    <div className="flex items-center justify-between">
                      <span>Okres przerwy:</span>
                      <span className="font-bold text-warning-fg">
                        ~{alert.details.gapMonths} mies. ({alert.details.gapStart} – {alert.details.gapEnd})
                      </span>
                    </div>
                  )}
                  {alert.details.conflictingCompany && (
                    <div className="flex items-center justify-between">
                      <span>Konflikt z firmą:</span>
                      <span className="font-bold text-danger-fg">
                        {alert.details.conflictingCompany} {alert.details.conflictingLocation ? `(${alert.details.conflictingLocation})` : ''}
                      </span>
                    </div>
                  )}
                  {alert.details.suggestedFormula && (
                    <div className="pt-1 text-[11px] text-brand-fg not-italic font-sans">
                      <span className="font-bold block">Rekomendowana formuła Google X-Y-Z:</span>
                      <span className="italic text-ink/80">{alert.details.suggestedFormula}</span>
                    </div>
                  )}
                  {alert.details.differenceYears !== undefined && alert.details.gapMonths === undefined && (
                    <div className="flex items-center justify-between">
                      <span>Różnica w latach:</span>
                      <span className="font-bold text-warning-fg">
                        {formatDecimalPl(alert.details.differenceYears, 2)} lat (&gt; 0,5 roku)
                      </span>
                    </div>
                  )}
                  {alert.details.sourceDurationYears !== undefined && (
                    <div className="flex items-center justify-between">
                      <span>Czas w MasterVault:</span>
                      <span>{formatDecimalPl(alert.details.sourceDurationYears, 2)} lat</span>
                    </div>
                  )}
                  {alert.details.claimedDurationYears !== undefined && (
                    <div className="flex items-center justify-between">
                      <span>Czas w projekcji:</span>
                      <span>{formatDecimalPl(alert.details.claimedDurationYears, 2)} lat</span>
                    </div>
                  )}
                  {alert.details.claimedTags && alert.details.claimedTags.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1">
                      <span className="text-subtle">Tagi:</span>
                      {alert.details.claimedTags.map((t, idx) => (
                        <span key={idx} className="rounded bg-sunken px-1 text-[10px]">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
