import React from 'react';
import { Lock, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { pluralPl } from '../../lib/pluralFormat';

export interface ConsistencyLockBadgeProps {
  isConsistent: boolean;
  claimsCount?: number;
  alertCount?: number;
  label?: string;
  tooltipText?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'icon-only' | 'pill';
  className?: string;
}

export const ConsistencyLockBadge: React.FC<ConsistencyLockBadgeProps> = ({
  isConsistent,
  claimsCount,
  alertCount = 0,
  label = 'spójność potwierdzona',
  tooltipText,
  size = 'md',
  variant = 'badge',
  className = '',
}) => {
  const isVerified = isConsistent && alertCount === 0;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  // „claimy" to żargon wewnętrzny wyciekający do UI — dla użytkownika to fakty z Vaultu.
  const defaultTooltip = isVerified
    ? `🔒 Spójność potwierdzona (${claimsCount && claimsCount > 0 ? `${claimsCount} zweryfikowanych faktów z Vaultu` : 'brak wykrytych rozbieżności z MasterVault'})`
    : `⚠️ Wykryto ${alertCount} ${pluralPl(alertCount, 'rozbieżność', 'rozbieżności', 'rozbieżności')} lub sprzeczności danych względem MasterVault`;

  if (variant === 'icon-only') {
    return (
      <span
        title={tooltipText || defaultTooltip}
        className={`inline-flex items-center justify-center rounded-full p-1 transition-colors ${
          isVerified
            ? 'bg-success-soft text-success-fg hover:bg-success-soft/80'
            : 'bg-warning-soft text-warning-fg hover:bg-warning-soft/80'
        } ${className}`}
      >
        {isVerified ? (
          <Lock className={iconSizes[size]} aria-label="Spójność potwierdzona" />
        ) : (
          <AlertTriangle className={iconSizes[size]} aria-label="Wykryto niezgodność" />
        )}
      </span>
    );
  }

  return (
    <div
      title={tooltipText || defaultTooltip}
      className={`inline-flex items-center rounded-full font-medium transition-all ${
        isVerified
          ? 'border border-success/30 bg-success-soft text-success-fg shadow-xs'
          : 'border border-warning/30 bg-warning-soft text-warning-fg shadow-xs'
      } ${sizeClasses[size]} ${className}`}
    >
      {isVerified ? (
        <>
          <Lock className={`${iconSizes[size]} shrink-0 text-success-fg`} />
          <span className="font-semibold">{label}</span>
          {claimsCount !== undefined && (
            <span className="opacity-75 font-mono text-[10px]">({claimsCount})</span>
          )}
        </>
      ) : (
        <>
          <AlertTriangle className={`${iconSizes[size]} shrink-0 text-warning-fg animate-pulse`} />
          <span className="font-semibold">
            {/* „1 rozbieżności" łamało odmianę — liczebnik wymaga doboru formy. */}
            {alertCount > 0 ? `${alertCount} ${pluralPl(alertCount, 'rozbieżność', 'rozbieżności', 'rozbieżności')}` : 'wymaga weryfikacji'}
          </span>
        </>
      )}
    </div>
  );
};
