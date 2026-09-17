import React from 'react';
import { motion } from 'motion/react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ElementType;
  badge?: string;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  variant?: 'pill' | 'underline';
  className?: string;
}

export function Tabs<T extends string = string>({
  items,
  active,
  onChange,
  variant = 'pill',
  className = '',
}: TabsProps<T>) {
  if (variant === 'underline') {
    // overflow-x-auto zamiast rozjechania: 7 zakładek w RealtimeLivePreview ma
    // min-content ~650 px i bez tego rozpychało kartę modala poza viewport 375 px,
    // ucinając początek toolbara edytora CV (E2E: scripts/e2e-quick-onboarding.mjs).
    // Kontener przewijany ma zerowe minimum, więc pasek przewija się wewnątrz
    // rodzica zamiast go poszerzać. Dotyczy wszystkich użyć underline (reguła 4).
    return (
      <div
        role="tablist"
        className={`flex w-full items-center gap-4 overflow-x-auto border-b border-line ${className}`}
      >
        {items.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`relative pb-3 pt-2 text-xs font-semibold transition-colors focus-visible:outline-none ${
                isActive ? 'text-brand-fg font-bold' : 'text-muted hover:text-ink'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="rounded-full bg-brand-50 px-1.5 py-px font-mono text-[9px] font-bold text-brand-fg">
                    {tab.badge}
                  </span>
                )}
              </span>

              {isActive && (
                <motion.div
                  layoutId="tab-underline-indicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600"
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={`inline-flex w-full items-center gap-1 rounded-2xl border border-line bg-sunken p-1 ${className}`}
    >
      {items.map((tab) => {
        const isActive = tab.id === active;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
              isActive ? 'text-brand-fg font-bold' : 'text-muted hover:text-ink'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="tab-highlight"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className="absolute inset-0 rounded-xl bg-surface border border-line/60 shadow-xs"
              />
            )}

            <span className="relative z-10 flex items-center gap-1.5">
              {Icon && <Icon className="h-3.5 w-3.5" />}
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="rounded-full bg-brand-50 px-1.5 py-px font-mono text-[9px] font-bold text-brand-fg">
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
