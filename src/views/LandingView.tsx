import React from 'react';
import { FileText, SearchCheck, Send, ShieldCheck, Sparkles, FolderCheck } from 'lucide-react';
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
    <section className="rounded-3xl border border-line bg-elevated p-5 sm:p-7">
      <p className="text-label font-bold uppercase tracking-wider text-brand-fg">Zacznij od swojego CV</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">Jedno miejsce na CV, ofertę i dokument do wysłania.</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">CVelocity porównuje wpisaną treść CV z ofertą, pomaga uporządkować fakty w profilu i przygotować dokument. Nie jest zewnętrznym ATS, nie wysyła aplikacji za Ciebie i nie obiecuje decyzji rekrutera.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="flex gap-2 text-xs text-muted"><ShieldCheck className="h-4 w-4 shrink-0 text-brand-fg" />Pracujesz na swoich danych — bez wymyślonych doświadczeń.</div>
        <div className="flex gap-2 text-xs text-muted"><Sparkles className="h-4 w-4 shrink-0 text-brand-fg" />Widzisz CV zanim wybierzesz wygląd i eksport.</div>
        <div className="flex gap-2 text-xs text-muted"><FolderCheck className="h-4 w-4 shrink-0 text-brand-fg" />Konto jest opcjonalne; służy do synchronizacji między urządzeniami.</div>
      </div>
    </section>

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

    <figure className="overflow-hidden rounded-3xl border border-line bg-surface shadow-xs">
      <img
        src="/onboarding/cv-start-storyboard.png"
        alt="Trzy kroki: dodanie CV, sprawdzenie oferty i wybór dokumentu do wysłania"
        className="block w-full"
      />
      <figcaption className="flex items-center gap-2 px-4 py-3 text-xs text-muted">
        <span aria-hidden="true">☕</span>
        Trzy ruchy, zero rytuałów korporacyjnych: dodaj CV, sprawdź ofertę, wybierz dokument.
      </figcaption>
    </figure>

    {atsSlot}
  </div>
);
