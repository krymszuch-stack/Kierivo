import React from 'react';
import { FileText, SearchCheck, Send } from 'lucide-react';
import { NavTabId } from '../lib/navigation';

interface LandingViewProps {
  onNavigate: (tab: NavTabId) => void;
  /** Realne narzędzie QuickAtsCheck, a nie makieta marketingowa. */
  atsSlot: React.ReactNode;
}

const STEPS = [
  { icon: FileText, label: 'Dodaj swoje CV' },
  { icon: SearchCheck, label: 'Wklej ofertę' },
  { icon: Send, label: 'Wybierz dokument do wysłania' },
];

/**
 * Pierwszy ekran ma prowadzić prosto do działania. Szczegóły bety, zasad i
 * limitów są dostępne w dedykowanych miejscach, więc nie powtarzamy ich nad
 * narzędziem, które użytkownik przyszedł uruchomić.
 */
export const LandingView: React.FC<LandingViewProps> = ({ atsSlot }) => (
  <div className="space-y-6 pb-10" data-testid="beta-landing">
    {atsSlot}

    <ol className="grid gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-3 sm:gap-0 sm:p-2" aria-label="Trzy kroki pracy z CV">
      {STEPS.map(({ icon: Icon, label }, index) => (
        <li key={label} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-ink sm:border-r sm:border-line last:border-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-mono text-xs font-bold text-brand-fg">
            {index + 1}
          </span>
          <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>{label}</span>
        </li>
      ))}
    </ol>
  </div>
);
