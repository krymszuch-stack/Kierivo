import React from 'react';
import { ChevronDown } from 'lucide-react';
import { ApplicationStatus } from '../../types';
import { Tooltip } from '../../components/ui/Tooltip';
import { STATUS_TOOLTIPS } from './trackerStatusConfig';

// Typ mieszka w `src/types`, bo czyta go też silnik „następnego kroku".
// Re-eksport, żeby wywołania `from './StatusSelect'` dalej działały.
export type { ApplicationStatus };

export interface StatusSelectProps {
  status: ApplicationStatus;
  onChange: (newStatus: ApplicationStatus) => void;
  className?: string;
}

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  'Do wysłania': {
    label: 'Do wysłania',
    bg: 'bg-warning-soft',
    text: 'text-warning-fg',
    border: 'border-warning/30',
    dot: 'bg-warning',
  },
  Wysłana: {
    label: 'Wysłana',
    bg: 'bg-sunken',
    text: 'text-muted',
    border: 'border-line',
    dot: 'bg-muted',
  },
  Rozmowa: {
    label: 'Rozmowa',
    bg: 'bg-brand-50',
    text: 'text-brand-fg',
    border: 'border-brand-200',
    dot: 'bg-brand-600',
  },
  Oferta: {
    label: 'Oferta',
    bg: 'bg-success-soft',
    text: 'text-success-fg',
    border: 'border-success/30',
    dot: 'bg-success',
  },
  Odrzucona: {
    label: 'Odrzucona',
    bg: 'bg-danger-soft',
    text: 'text-danger-fg',
    border: 'border-danger/30',
    dot: 'bg-danger',
  },
};

export const StatusSelect: React.FC<StatusSelectProps> = ({
  status,
  onChange,
  className = '',
}) => {
  const current = STATUS_CONFIG[status] || STATUS_CONFIG.Wysłana;
  const tooltipText = `${current.label}: ${STATUS_TOOLTIPS[status] || ''}`;

  return (
    <Tooltip content={tooltipText} side="top">
      <div className={`relative inline-flex items-center ${className}`}>
        <select
          value={status}
          onChange={(e) => onChange(e.target.value as ApplicationStatus)}
          aria-label={`Zmień status aplikacji (aktualnie: ${current.label})`}
          className={`appearance-none rounded-xl border px-3 py-1.5 pr-7 font-mono text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer ${current.bg} ${current.text} ${current.border}`}
        >
          <optgroup label="Etap przygotowania">
            <option value="Do wysłania" title={STATUS_TOOLTIPS['Do wysłania']}>
              Do wysłania
            </option>
          </optgroup>
          <optgroup label="Złożona aplikacja">
            <option value="Wysłana" title={STATUS_TOOLTIPS.Wysłana}>
              Wysłana
            </option>
          </optgroup>
          <optgroup label="W toku rekrutacji">
            <option value="Rozmowa" title={STATUS_TOOLTIPS.Rozmowa}>
              Rozmowa
            </option>
          </optgroup>
          <optgroup label="Faza końcowa (Zakończone)">
            <option value="Oferta" title={STATUS_TOOLTIPS.Oferta}>
              Oferta
            </option>
            <option value="Odrzucona" title={STATUS_TOOLTIPS.Odrzucona}>
              Odrzucona
            </option>
          </optgroup>
        </select>

        <ChevronDown className={`pointer-events-none absolute right-2 h-3.5 w-3.5 ${current.text}`} />
      </div>
    </Tooltip>
  );
};
