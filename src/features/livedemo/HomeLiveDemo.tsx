import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MousePointer2, ArrowRight, FlaskConical } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ScoreRing } from '../../components/ui/ScoreRing';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { runQuickAtsCheck, type QuickCheckResult } from '../../lib/quickAtsCheck';
import { scoreCanonicalAts, type CanonicalAtsScore } from '../../lib/canonicalAts';
import type { NavTabId } from '../../lib/navigation';
import {
  buildDurations,
  phaseAt,
  typedCharCount,
  typedText,
  scoreTone,
  finalStaticState,
  type DemoPhase,
  type DemoScoreTone,
} from '../../lib/demoTimeline';
import { EXAMPLE_CV, EXAMPLE_JD, EXAMPLE_ROLE_TITLE } from './demoScenario';

export interface HomeLiveDemoProps {
  onNavigate: (tab: NavTabId) => void;
  className?: string;
}

interface DemoComputation {
  quick: QuickCheckResult;
  canonical: CanonicalAtsScore;
}

type DemoComputationState =
  | { status: 'ready'; data: DemoComputation }
  | { status: 'failed'; message: string };

/**
 * Liczy wynik demo prawdziwym silnikiem — dokładnie tym, co uruchamia się po
 * kliknięciu „Sprawdź dopasowanie” w pełnym narzędziu. Raz na zamontowanie,
 * synchronicznie, bez sieci (komentarz w quickAtsCheck.ts: cała ścieżka jest
 * lokalna). Komponent nie ma gdzie podstawić własnej liczby: albo silnik
 * policzył, albo demo nie wyświetla żadnej.
 */
function computeDemo(): DemoComputationState {
  try {
    const quick = runQuickAtsCheck(EXAMPLE_CV, EXAMPLE_JD, { jobTitle: EXAMPLE_ROLE_TITLE });
    const canonical = scoreCanonicalAts(quick.vault, EXAMPLE_JD, EXAMPLE_ROLE_TITLE);
    return { status: 'ready', data: { quick, canonical } };
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Nie udało się policzyć przykładu.',
    };
  }
}

const TONE_CLASS: Record<DemoScoreTone, string> = {
  high: 'text-emerald-500',
  mid: 'text-blue-500',
  low: 'text-amber-500',
};

/** Etykiety i wagi identyczne z rozbiciem kanonicznym w AtsLabView. */
const PILLARS: Array<{ key: keyof CanonicalAtsScore['components']; label: string }> = [
  { key: 'skills', label: 'Umiejętności (40%)' },
  { key: 'experience', label: 'Staż i świeżość (25%)' },
  { key: 'structure', label: 'Struktura (20%)' },
  { key: 'formal', label: 'Formalia (15%)' },
];

/** Pozycja „ręki” (w % kontenera) dla każdej fazy — imituje ruch kursorem. */
const CURSOR_POS: Record<DemoPhase, { x: number; y: number; visible: boolean }> = {
  idle: { x: 50, y: 86, visible: true },
  'typing-cv': { x: 25, y: 30, visible: true },
  'typing-jd': { x: 75, y: 30, visible: true },
  press: { x: 50, y: 55, visible: true },
  computing: { x: 50, y: 55, visible: false },
  result: { x: 88, y: 70, visible: false },
  hold: { x: 88, y: 70, visible: false },
};

const RESULT_PHASES: DemoPhase[] = ['result', 'hold'];

export const HomeLiveDemo: React.FC<HomeLiveDemoProps> = ({ onNavigate, className = '' }) => {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [inViewport, setInViewport] = useState(false);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState(0);

  const computation = useMemo(() => computeDemo(), []);
  const durations = useMemo(
    () => buildDurations(EXAMPLE_CV.length, EXAMPLE_JD.length),
    []
  );

  // Start dopiero, gdy demo jest widoczne: pętla timerów działa wyłącznie na
  // ekranie, więc nie dokłada pracy off-screenowi (np. w tle karty przeglądarki).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => setInViewport(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion || !inViewport || paused) return;
    const interval = window.setInterval(() => setClock((t) => t + 40), 40);
    return () => window.clearInterval(interval);
  }, [reducedMotion, inViewport, paused]);

  const { phase, elapsed } = useMemo(
    () => (reducedMotion ? finalStaticState(durations) : phaseAt(clock, durations)),
    [reducedMotion, clock, durations]
  );

  const showsResult = computation.status === 'ready' && RESULT_PHASES.includes(phase);
  const isTyping = phase === 'typing-cv' || phase === 'typing-jd';

  const cvVisible = typedCharCount(
    EXAMPLE_CV.length, phase, elapsed, 'typing-cv'
  );
  const jdVisible = typedCharCount(
    EXAMPLE_JD.length, phase, elapsed, 'typing-jd'
  );

  const cursor = CURSOR_POS[phase];
  const canonical = computation.status === 'ready' ? computation.data.canonical : null;
  const quick = computation.status === 'ready' ? computation.data.quick : null;
  const tone = canonical ? scoreTone(canonical.score) : null;
  const ariaSummary = canonical
    ? `Animacja pokazująca działanie narzędzia: wklejenie przykładowego CV i ogłoszenia oraz wynik ${canonical.score}% dopasowania wyliczony przez silnik aplikacji.`
    : 'Animacja pokazująca działanie narzędzia na danych przykładowych.';

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl border border-line bg-elevated shadow-raised ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Nagłówek ramki demo — podpis kontroluje, że to scena, nie prawdziwy formularz. */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
        <span className="inline-flex items-center gap-2 text-meta font-bold uppercase tracking-[0.14em] text-brand-fg">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
          Podgląd działania
        </span>
        <span className="text-meta text-subtle">dane przykładowe</span>
      </div>

      <div
        role="img"
        aria-label={ariaSummary}
        className="relative min-h-[22rem] p-4"
      >
        {/* Ręka-kursor: czysto wizualny akcent ruchu, aria-hidden. */}
        {cursor.visible && !reducedMotion && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute z-10 text-brand-600"
            style={{ left: 0, top: 0 }}
            animate={{ x: `${cursor.x}%`, y: `${cursor.y}%` }}
            transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
          >
            <MousePointer2 className="h-4 w-4 -scale-x-100 drop-shadow" fill="currentColor" />
          </motion.span>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="relative h-28 overflow-hidden rounded-xl border border-line bg-sunken p-2">
            <span className="text-meta font-bold uppercase tracking-wider text-subtle">Twoje CV</span>
            <p className="mt-1 font-mono text-[10px] leading-snug text-muted">
              {phase === 'idle' ? '▼ wklej tekst CV' : typedText(EXAMPLE_CV, cvVisible)}
              {isTyping && phase === 'typing-cv' && (
                <span className="animate-pulse text-brand-600" aria-hidden="true">▌</span>
              )}
            </p>
          </div>
          <div className="relative h-28 overflow-hidden rounded-xl border border-line bg-sunken p-2">
            <span className="text-meta font-bold uppercase tracking-wider text-subtle">Ogłoszenie</span>
            <p className="mt-1 font-mono text-[10px] leading-snug text-muted">
              {phase === 'idle' ? '▼ wklej treść oferty' : typedText(EXAMPLE_JD, jdVisible)}
              {isTyping && phase === 'typing-jd' && (
                <span className="animate-pulse text-brand-600" aria-hidden="true">▌</span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            variant="primary"
            size="md"
            tabIndex={-1}
            loading={phase === 'computing'}
            className="pointer-events-none"
          >
            Sprawdź dopasowanie
          </Button>
        </div>

        <div className="mt-3">
          <AnimatePresence mode="wait">
            {computation.status === 'failed' && (
              <motion.p
                key="failed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-line bg-sunken p-3 text-center text-xs text-muted"
              >
                Nie udało się policzyć przykładu na tym urządzeniu: {computation.message}
              </motion.p>
            )}

            {showsResult && canonical && quick && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.19, 1, 0.22, 1] }}
                className="rounded-xl border border-line bg-surface p-3"
              >
                <div className="flex items-center gap-3">
                  <ScoreRing
                    value={canonical.score}
                    size={104}
                    stroke={9}
                    label="Dopasowanie"
                  />
                  <div className="grid flex-1 grid-cols-2 gap-1.5">
                    {PILLARS.map((pillar) => {
                      const value = canonical.components[pillar.key];
                      return (
                        <div
                          key={pillar.key}
                          className="rounded-lg border border-ink/5 bg-surface/60 px-2 py-1.5 text-center"
                        >
                          <span className="block text-[10px] leading-tight text-ink-faint">{pillar.label}</span>
                          <span className={`block font-mono text-sm font-bold ${TONE_CLASS[scoreTone(value)]}`}>
                            {value}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {quick.missingSkills.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">Brakuje:</span>
                    {quick.missingSkills.slice(0, 4).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md border border-danger/30 bg-danger-soft px-1.5 py-0.5 font-mono text-[10px] text-danger-fg"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-meta leading-snug text-subtle">
          Wynik liczy ten sam silnik co w aplikacji. To wskazówka do redakcji CV, nie ocena zewnętrznego ATS.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={ArrowRight}
          iconPosition="right"
          onClick={() => onNavigate('aplikuj')}
          className="shrink-0"
        >
          Wypróbuj na własnym CV
        </Button>
      </div>
    </div>
  );
};
