import React from 'react';
import { Tooltip } from '../ui/Tooltip';

/**
 * Kafelek pojedynczego benefitu wykrytego w ogłoszeniu.
 *
 * Komponent jest czysto prezentacyjny: wykrywanie benefitów i ich wycena
 * zostają w `src/lib/commuteCalculator.ts`, żeby dało się je testować bez DOM-u
 * (`AGENTS.md`). Tutaj jest wyłącznie układ i stan wizualny.
 *
 * Stan „brak" nie znika i nie chudnie — ma tę samą wysokość co „zapewnione",
 * bo przy przełączaniu ofert siatka inaczej podskakiwała.
 */
import { BrandBenefitLogo } from './BrandBenefitLogo';
import type { BadgeKey } from '../icons/HandDrawnBadges';

export interface BenefitBadgeCardProps {
  /** Rysowana odznaka z `HandDrawnBadges` lub klucz. */
  icon?: React.ComponentType<{ className?: string }>;
  benefitKey?: BadgeKey;
  brandKey?: string;
  label: string;
  /** Krótka wartość pod etykietą — np. „ok. 150 zł" albo „do negocjacji". */
  value: string;
  /** Treść dymka: skąd wzięło się rozpoznanie lub założenie. */
  hint: string;
  provided: boolean;
}

export const BenefitBadgeCard: React.FC<BenefitBadgeCardProps> = ({
  icon: Icon,
  benefitKey,
  brandKey,
  label,
  value,
  hint,
  provided,
}) => (
  <Tooltip content={hint}>
    <div
      className={`flex min-h-[4.5rem] items-center gap-3 rounded-xl border p-3 transition-all duration-200 ease-out ${
        provided
          ? 'border-[#155EEF]/30 bg-slate-900/80 text-white shadow-[0_0_15px_rgba(242,100,64,0.08)]'
          : 'border-line bg-slate-900/30 text-subtle opacity-60 grayscale hover:opacity-90 hover:grayscale-0'
      }`}
    >
      {benefitKey ? (
        <BrandBenefitLogo benefitKey={benefitKey} brandKey={brandKey} className="h-10 w-10 shrink-0" />
      ) : Icon ? (
        <Icon className="h-10 w-10 shrink-0" />
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-bold">{label}</p>
        <p className="truncate font-mono text-[10px] opacity-80">{value}</p>
      </div>

      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${
          provided ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-slate-600'
        }`}
      />
    </div>
  </Tooltip>
);
