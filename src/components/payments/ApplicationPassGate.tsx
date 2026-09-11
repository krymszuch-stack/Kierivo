import React from 'react';
import { IS_BETA } from '../../lib/betaConfig';

/**
 * Bramka funkcji dostępnej w Karnecie Aplikacyjnym.
 *
 * W trakcie trwania bezpłatnej bety testerzy mają zapewniony pełny dostęp
 * do podstawowego przepływu bez konieczności zakupu karnetu (zakupy są wyłączone).
 * Ewentualne operacje kosztowe AI nadal egzekwują limity na backendzie.
 */
export interface ApplicationPassGateProps {
  hasActivePass: boolean;
  pitch: string;
  onBuyPass?: () => void;
  children: React.ReactNode;
}

export const ApplicationPassGate: React.FC<ApplicationPassGateProps> = ({
  hasActivePass,
  pitch,
  onBuyPass,
  children,
}) => {
  if (hasActivePass || IS_BETA) return <>{children}</>;

  return (
    <section
      role="note"
      aria-label="Funkcja dostępna w Karnecie Aplikacyjnym"
      className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900/60"
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-fg">
        Bezpłatna Beta
      </p>
      <h2 className="mt-1.5 text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
        Teleprompter Live HUD
      </h2>
      <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {pitch}
      </p>
      <p className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
        Funkcja jest udostępniona testerom bezpłatnej wersji beta bez konieczności zakupu płatnego karnetu.
      </p>
    </section>
  );
};
