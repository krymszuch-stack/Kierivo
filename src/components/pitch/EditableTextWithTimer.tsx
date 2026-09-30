import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
  Clock,
  Mic,
  Activity,
  Edit3,
} from 'lucide-react';
import { ElevatorPitchOutput } from '../../types';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { showToast } from '../../store/useToastStore';

export type PitchVariant = '1-liner' | '30s' | '90s';

export interface EditableTextWithTimerProps {
  pitchData: ElevatorPitchOutput;
  /**
   * Czy profil zawiera zawodowe dane, z których generator ułożył szkic.
   */
  verifiedFromVault?: boolean;
  className?: string;
}

export const EditableTextWithTimer: React.FC<EditableTextWithTimerProps> = ({
  pitchData,
  verifiedFromVault = true,
  className = '',
}) => {
  const [activeVariant, setActiveVariant] = useState<PitchVariant>('30s');

  // Teksty edytowalne per wariant
  const [customTexts, setCustomTexts] = useState<Record<PitchVariant, string>>({
    '1-liner': pitchData.oneLiner,
    '30s': pitchData.thirtySeconds,
    '90s': pitchData.ninetySeconds,
  });

  // Aktualizacja tekstów przy zmianie wejściowego pitchData
  useEffect(() => {
    setCustomTexts({
      '1-liner': pitchData.oneLiner,
      '30s': pitchData.thirtySeconds,
      '90s': pitchData.ninetySeconds,
    });
  }, [pitchData]);

  const targetDurationSec =
    activeVariant === '1-liner' ? 10 : activeVariant === '30s' ? 30 : 90;

  // Stan timera ćwiczeniowego
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Reset timera przy zmianie wariantu
  const handleSelectVariant = (variant: PitchVariant) => {
    setActiveVariant(variant);
    setIsRunning(false);
    setSecondsElapsed(0);
  };

  const handleToggleTimer = () => {
    setIsRunning((prev) => !prev);
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setSecondsElapsed(0);
  };

  const currentText = customTexts[activeVariant];
  const wordCount = currentText.trim().split(/\s+/).filter(Boolean).length;
  const currentWpm = secondsElapsed > 0 ? Math.round((wordCount / (secondsElapsed / 60))) : 0;
  const progressPercent = Math.min(100, Math.round((secondsElapsed / targetDurationSec) * 100));
  const isOverTime = secondsElapsed > targetDurationSec;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentText);
      setCopied(true);
      showToast('Skopiowano treść pitcha do schowka', {
        message: `Wariant ${activeVariant} (${wordCount} słów)`,
        variant: 'success',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Schowek potrafi odmówić (uprawnienia, http, ukryta karta) — milczenie
      // wyglądałoby jak skopiowanie.
      showToast('Nie udało się skopiować', {
        message: 'Zaznacz tekst pitcha i skopiuj go ręcznie.',
        variant: 'error',
      });
    }
  };

  return (
    <div className={`rounded-3xl border border-line bg-elevated p-5 shadow-raised space-y-5 ${className}`}>
      {/* 1. Nawigacja Wariantów Pitcha */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-sunken border border-line">
          <button
            type="button"
            onClick={() => handleSelectVariant('1-liner')}
            className={`rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
              activeVariant === '1-liner'
                ? 'bg-ink text-surface shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            ⚡ Jedno zdanie (~10s)
          </button>
          <button
            type="button"
            onClick={() => handleSelectVariant('30s')}
            className={`rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
              activeVariant === '30s'
                ? 'bg-brand-600 text-on-brand shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            🎯 30 Sekund (Standard)
          </button>
          <button
            type="button"
            onClick={() => handleSelectVariant('90s')}
            className={`rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
              activeVariant === '90s'
                ? 'bg-ink text-surface shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            📖 90 Sekund (Pogłębiony)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {verifiedFromVault ? (
            <Chip variant="brand" size="sm">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Na bazie Twojego MasterVault
            </Chip>
          ) : (
            <Chip variant="neutral" size="sm">
              Brak danych do szkicu — uzupełnij profil
            </Chip>
          )}
        </div>
      </div>

      {/* 2. Pasek Timera i Statystyk Mowy */}
      <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Czas i Stan */}
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 font-mono text-base font-extrabold shadow-inner ${
                isOverTime
                  ? 'bg-error-soft text-error-fg border border-error/30'
                  : isRunning
                  ? 'bg-brand-500/15 text-brand-700 border border-brand-500/30 animate-pulse'
                  : 'bg-sunken text-ink border border-line'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>
                {Math.floor(secondsElapsed / 60)}:
                {(secondsElapsed % 60).toString().padStart(2, '0')}
              </span>
              <span className="text-xs font-normal text-muted">/ {targetDurationSec}s</span>
            </div>

            {/* Przyciski Timera */}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant={isRunning ? 'secondary' : 'primary'}
                size="sm"
                icon={isRunning ? Pause : Play}
                onClick={handleToggleTimer}
              >
                {isRunning ? 'Pauza' : 'Rozpocznij Mowę'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={RotateCcw}
                onClick={handleResetTimer}
                title="Zresetuj czas"
              />
            </div>
          </div>

          {/* Statystyki Mowy */}
          <div className="flex items-center gap-4 text-xs font-mono text-muted">
            <div className="flex items-center gap-1.5">
              <Edit3 className="h-3.5 w-3.5 text-muted" />
              <span>Słów: <strong className="text-ink">{wordCount}</strong></span>
            </div>

            {secondsElapsed > 2 && (
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-brand-600" />
                <span>
                  Tempo:{' '}
                  <strong
                    className={
                      currentWpm >= 110 && currentWpm <= 150
                        ? 'text-success-fg'
                        : 'text-warning-fg'
                    }
                  >
                    {currentWpm} WPM
                  </strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Pasek Postępu Czasowego */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-sunken">
          <div
            style={{ width: `${progressPercent}%` }}
            className={`h-full transition-all duration-300 ${
              isOverTime ? 'bg-error' : 'bg-brand-600'
            }`}
          />
        </div>
      </div>

      {/* 3. Edytowalne Pole Tekstowe (EditableText) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-mono text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>Skrypt Wypowiedzi (Edytuj i dostosuj):</span>
          </label>

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={copied ? Check : Copy}
            onClick={handleCopy}
          >
            {copied ? 'Skopiowano!' : 'Kopiuj treść'}
          </Button>
        </div>

        <textarea
          rows={activeVariant === '1-liner' ? 3 : activeVariant === '30s' ? 6 : 10}
          value={currentText}
          onChange={(e) =>
            setCustomTexts((prev) => ({
              ...prev,
              [activeVariant]: e.target.value,
            }))
          }
          className="w-full rounded-2xl border border-line bg-surface p-4 font-sans text-xs sm:text-sm text-ink leading-relaxed shadow-inner placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all resize-y"
          placeholder="Wpisz treść swojego elevator pitch..."
        />
      </div>

      {/* 4. Metryki z MasterVault użyte w pitchu */}
      {pitchData.metricsUsed && pitchData.metricsUsed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-line text-[11px] font-mono text-muted">
          <span>Użyte twarde metryki:</span>
          {pitchData.metricsUsed.map((m, idx) => (
            <span
              key={idx}
              className="rounded-md border border-brand-500/20 bg-brand-500/10 px-2 py-0.5 font-bold text-brand-700"
            >
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
