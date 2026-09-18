import React from 'react';
import { LucideIcon, Check } from 'lucide-react';
import { motion } from 'motion/react';

export interface StepItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  estimatedTime?: string;
  isRequired?: boolean;
}

export interface StepIndicatorProps {
  steps: StepItem[];
  activeStep: number;
  onStepClick: (index: number) => void;
  className?: string;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  activeStep,
  onStepClick,
  className = '',
}) => {
  const current = steps[activeStep];

  return (
    <div className={`w-full ${className}`}>
      {/* Progress Track (Desktop) */}
      <div className="relative mb-6 hidden md:block">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-line" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-brand-600 transition-all duration-500 ease-out"
          style={{
            width: `${(activeStep / Math.max(1, steps.length - 1)) * 100}%`,
          }}
        />

        <div className="relative z-10 flex justify-between">
          {steps.map((step, idx) => {
            const isCompleted = idx < activeStep;
            const isCurrent = idx === activeStep;
            const Icon = step.icon;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onStepClick(idx)}
                className="group flex flex-col items-center focus-visible:outline-none max-w-[110px]"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-xs font-bold transition-all duration-300 ${
                    isCompleted
                      ? 'border-brand-600 bg-brand-600 text-on-brand shadow-xs'
                      : isCurrent
                      ? 'border-brand-600 bg-elevated text-brand-fg ring-4 ring-brand-500/20 shadow-raised'
                      : 'border-line bg-surface text-muted group-hover:border-brand-300'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4 stroke-[3]" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>

                <div className="mt-2 text-center">
                  <span className="block font-mono text-[10px] text-muted">
                    Krok {idx + 1}
                  </span>
                  <span
                    className={`block font-sans text-xs font-bold transition-colors leading-tight ${
                      isCurrent ? 'text-brand-fg' : 'text-muted group-hover:text-ink'
                    }`}
                  >
                    {step.label}
                  </span>
                  <div className="mt-1 flex flex-col items-center gap-0.5">
                    <span
                      className={`inline-block rounded-full px-1.5 py-0.2 text-[9px] font-semibold leading-tight ${
                        step.isRequired
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                          : 'bg-sunken text-muted'
                      }`}
                    >
                      {step.isRequired ? 'Wymagana' : 'Opcjonalna'}
                    </span>
                    {step.estimatedTime && (
                      <span className="font-mono text-[9px] text-subtle">
                        {step.estimatedTime}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Step Counter & Progress */}
      <div className="md:hidden mb-4 rounded-xl border border-line bg-surface p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 font-mono text-xs font-bold text-brand-600">
              {activeStep + 1}
            </span>
            <span className="text-xs font-bold text-ink">{current?.label}</span>
          </div>
          <span className="font-mono text-[11px] text-muted">
            Krok {activeStep + 1} z {steps.length}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted pt-1 border-t border-line/60">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              current?.isRequired
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                : 'bg-sunken text-muted'
            }`}
          >
            {current?.isRequired ? 'Sekcja wymagana' : 'Sekcja opcjonalna'}
          </span>
          {current?.estimatedTime && (
            <span className="font-mono text-[10px] text-subtle">
              czas: {current.estimatedTime}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
