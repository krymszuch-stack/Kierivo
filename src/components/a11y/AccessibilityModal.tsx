import React from 'react';
import {
  Eye,
  Type,
  Maximize2,
  Sparkles,
  ZapOff,
  RotateCcw,
  SunMedium,
  Check,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { useAccessibility, TextScale } from '../../providers/AccessibilityProvider';

export interface AccessibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccessibilityModal: React.FC<AccessibilityModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    setHighContrast,
    setTextScale,
    setDyslexicSpacing,
    setEnhancedFocus,
    setReducedMotion,
    resetA11y,
    isAnyEnabled,
  } = useAccessibility();

  const textScaleOptions: Array<{ id: TextScale; label: string; hint: string }> = [
    { id: 'normal', label: 'Standardowy', hint: '100% bazy' },
    { id: 'large', label: 'Duży (+20%)', hint: 'Lepsza czytelność' },
    { id: 'huge', label: 'Bardzo duży (+35%)', hint: 'Dla słabowidzących' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ułatwienia Dostępności (WCAG 2.1)"
      description="Dostosuj kontrast, rozmiar czcionek i czytelność interfejsu pod swoje potrzeby wzrokowe."
      size="md"
    >
      <div className="space-y-5">
        {/* 1. Tryb wysokiego kontrastu */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-2">
          <div className="flex items-center gap-2.5 text-ink font-bold text-sm mb-1">
            <SunMedium className="h-4 w-4 text-brand-600" />
            <span>Tryb wysokiego kontrastu (WCAG AAA)</span>
          </div>
          <Toggle
            checked={settings.highContrast}
            onChange={setHighContrast}
            label="Maksymalny kontrast (Czerń / Żółty / Biel)"
            description="Wyłącza rozpraszające przezroczystości i cienie, stosując wyraźne obramowania i wysoki kontrast kolorystyczny."
          />
        </div>

        {/* 2. Rozmiar czcionek */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
          <div className="flex items-center gap-2.5 text-ink font-bold text-sm">
            <Type className="h-4 w-4 text-brand-600" />
            <span>Rozmiar czcionek i interfejsu</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {textScaleOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTextScale(opt.id)}
                aria-pressed={settings.textScale === opt.id}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  settings.textScale === opt.id
                    ? 'border-brand-500 bg-brand-500/10 text-brand-600 font-bold'
                    : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                <span className="text-xs font-semibold">{opt.label}</span>
                <span className="text-[10px] opacity-75 mt-0.5">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Dodatkowe ułatwienia czytelności */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
          <div className="flex items-center gap-2.5 text-ink font-bold text-sm">
            <Sparkles className="h-4 w-4 text-brand-600" />
            <span>Czytelność tekstu i nawigacja</span>
          </div>

          <Toggle
            checked={settings.dyslexicSpacing}
            onChange={setDyslexicSpacing}
            label="Zwiększone odstępy tekstu (Interlinia & Światło)"
            description="Zwiększa odstępy między literami, słowami i wierszami ułatwiając czytanie dłuższych fragmentów CV."
          />

          <div className="border-t border-line pt-3">
            <Toggle
              checked={settings.enhancedFocus}
              onChange={setEnhancedFocus}
              label="Wyrazisty wskaźnik fokusu klawiatury"
              description="Dodaje gruby, 4-pikselowy obrys wokół aktywnego pola podczas poruszania się klawiszem Tab."
            />
          </div>

          <div className="border-t border-line pt-3">
            <Toggle
              checked={settings.reducedMotion}
              onChange={setReducedMotion}
              label="Zatrzymaj animacje (Zmniejszony ruch)"
              description="Wyłącza płynne przejścia i animacje dla osób z nadwrażliwością wzrokową lub błędnikową."
            />
          </div>
        </div>

        {/* Stopka: Reset i Zamknij */}
        <div className="flex items-center justify-between pt-2 border-t border-line">
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={resetA11y}
            disabled={!isAnyEnabled}
          >
            Przywróć domyślne
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Gotowe
          </Button>
        </div>
      </div>
    </Modal>
  );
};
