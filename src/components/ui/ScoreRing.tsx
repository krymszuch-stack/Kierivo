import React from 'react';
import { FileQuestion } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * Pierścień wyniku — jedyny egzemplarz geometrii, którą wcześniej kopiowano
 * inline przy każdej metryce (konsensus ATS, telemetria, kokpit).
 *
 * Komponenty:
 * - `ResultScoreRing`: prezentuje mierzony wynik liczbowy (w tym realny wynik 0% z pełnym pierścieniem)
 * - `EmptyStateScoreRing`: prezentuje stan pusty (profil bez danych) z przerywaną obwódką i statusem „Brak danych”
 * - `ScoreRing`: uniwersalny wrapper delegujący do ResultScoreRing lub EmptyStateScoreRing na podstawie właściwości `isEmpty`.
 */

export interface ScoreRingProps {
  /** Wynik 0–100. Wartości spoza zakresu są przycinane. */
  value: number;
  /** Rozmiar w px (kwadrat). Default 176 = dotychczasowy h-44 w-44. */
  size?: number;
  /** Grubość pierścienia w jednostkach viewBox (100×100). */
  stroke?: number;
  /** Etykieta pod liczbą, np. „Mediana filtrów". */
  label?: string;
  suffix?: string;
  className?: string;
  /** Jeśli true, renderuje EmptyStateScoreRing zamiast wyniku liczbowego. */
  isEmpty?: boolean;
}

export interface EmptyStateScoreRingProps {
  /** Rozmiar w px (kwadrat). Default 176. */
  size?: number;
  /** Grubość pierścienia w jednostkach viewBox (100×100). */
  stroke?: number;
  /** Etykieta pod tekstem statusu. */
  label?: string;
  /** Tekst statusu w środku pierścienia. Domyślnie „Brak danych”. */
  message?: string;
  className?: string;
}

/** Kolor łuku — token brandowy; tor zostaje neutralny z powierzchni. */
const TRACK_CLASS = 'text-surface-sunken';
const BAR_CLASS = 'text-brand';
const TRANSITION = 'stroke-dashoffset 700ms cubic-bezier(0.19, 1, 0.22, 1)';

export const ResultScoreRing: React.FC<ScoreRingProps> = ({
  value,
  size = 176,
  stroke = 8,
  label,
  suffix = '%',
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));
  // Obwód okręgu r=42 w viewBox 100 — niezależny od rozmiaru renderowania.
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (circumference * clamped) / 100;

  return (
    <div
      role="img"
      aria-label={label ? `${label}: ${clamped}${suffix}` : `Wynik: ${clamped}${suffix}`}
      className={`relative flex flex-col items-center justify-center ${className}`}
    >
      <div className="relative flex items-center justify-center">
        {/* Rozmiar sterowany stylem, bo skala viewBox jest stała (100×100). */}
        <svg
          style={{ width: size, height: size }}
          className="-rotate-90 transform"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="currentColor"
            strokeWidth={stroke}
            fill="transparent"
            className={TRACK_CLASS}
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="currentColor"
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${BAR_CLASS} ${shouldReduceMotion ? '' : 'transition-all'}`}
            style={{ transition: shouldReduceMotion ? 'none' : TRANSITION }}
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center px-2 text-center">
          <span className="text-4xl font-black tracking-tight text-ink font-mono sm:text-5xl">
            {clamped}
            {suffix}
          </span>
          {label && (
            <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const EmptyStateScoreRing: React.FC<EmptyStateScoreRingProps> = ({
  size = 176,
  stroke = 6,
  label,
  message = 'Brak danych',
  className = '',
}) => {
  return (
    <div
      role="img"
      aria-label={label ? `${label}: ${message}` : message}
      className={`relative flex flex-col items-center justify-center ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <svg
          style={{ width: size, height: size }}
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="transparent"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeDasharray="4 4"
            className="text-ink/20 dark:text-ink/30"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center px-4 text-center">
          <FileQuestion className="h-6 w-6 text-ink-muted/70 mb-1" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            {message}
          </span>
          {label && (
            <span className="mt-1 text-[10px] font-medium tracking-wide text-ink-faint">
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const ScoreRing: React.FC<ScoreRingProps> = ({ isEmpty = false, ...props }) => {
  if (isEmpty) {
    return <EmptyStateScoreRing size={props.size} stroke={props.stroke} label={props.label} className={props.className} />;
  }
  return <ResultScoreRing {...props} />;
};
