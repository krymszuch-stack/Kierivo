import React, { useRef, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export interface ScrollContinuationHintProps {
  /** Etykieta wskaźnika, np. „Więcej analizy niżej ↓” lub „Kolejna sekcja: Oceny modułów”. */
  label?: string;
  /** Opcjonalne ID sekcji docelowej do płynnego przewinięcia po kliknięciu. */
  targetId?: string;
  /** Dodatkowe klasy CSS. */
  className?: string;
  /** Czy wskaźnik ma być zawsze widoczny z pominięciem IntersectionObserver. */
  alwaysVisible?: boolean;
}

/**
 * ScrollContinuationHint — jednolity komponent wskaźnika kontynuacji przewijania.
 *
 * Renderuje się na granicy głównych kart i sekcji widoków wynikowych, eliminując
 * efekt „fałszywego dna strony” (false bottom) i łącząc sekcje w spójną całość.
 */
export const ScrollContinuationHint: React.FC<ScrollContinuationHintProps> = ({
  label = 'Więcej analizy niżej ↓',
  targetId,
  className = '',
  alwaysVisible = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(alwaysVisible);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (alwaysVisible || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px 50px 0px',
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [alwaysVisible]);

  const handleClick = () => {
    if (!targetId || typeof document === 'undefined') return;
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  };

  const content = (
    <>
      <span className="truncate max-w-[240px]">{label}</span>
      <ChevronDown className="h-3.5 w-3.5 text-brand shrink-0 transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
    </>
  );

  return (
    <div
      ref={containerRef}
      role="presentation"
      className={`relative my-1 flex items-center justify-center py-2 select-none transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      {/* Poświata/cień gradientowy likwidujący czystą białą przestrzeń */}
      <div
        className="pointer-events-none absolute inset-x-4 -top-3 h-8 bg-gradient-to-b from-transparent via-brand/[0.04] to-transparent blur-xs dark:via-brand/[0.08]"
        aria-hidden="true"
      />

      {/* Subtelna linia-separator z zanikaniem ku krawędziom */}
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-line/80 to-transparent" />
      </div>

      {/* Centralna pigułka z małą etykietą */}
      {targetId ? (
        <button
          type="button"
          onClick={handleClick}
          className="group relative z-10 flex cursor-pointer items-center gap-1.5 rounded-full border border-line/80 bg-surface/95 px-3.5 py-1 text-[11px] font-semibold text-ink-muted shadow-xs backdrop-blur-xs transition-all hover:border-brand/50 hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
          title={`Przewiń do sekcji: ${label}`}
          aria-label={`Przewiń do sekcji: ${label}`}
        >
          {content}
        </button>
      ) : (
        <div
          className="relative z-10 flex items-center gap-1.5 rounded-full border border-line/80 bg-surface/95 px-3.5 py-1 text-[11px] font-medium text-ink-muted shadow-xs backdrop-blur-xs"
          aria-hidden="true"
        >
          {content}
        </div>
      )}
    </div>
  );
};
