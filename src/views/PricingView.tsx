import React from 'react';
import { CheckCircle2, FlaskConical, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { useEntitlements, FREE_DAILY_AI_USES, FREE_MONTHLY_IMPORTS } from '../store/useEntitlements';
import { FREE_BETA_LABEL, FREE_BETA_PRICE_PLN } from '../lib/beta';

const included = [
  'Tworzenie i edycja Master Vault',
  'Wklejanie treści CV i lokalne scalanie z profilem',
  'Audyt Kierivo: słowa/frazy, umiejętności, struktura i formatowanie',
  'Dopasowanie CV do konkretnego ogłoszenia i lista wykrytych luk',
  'Podgląd dokumentu oraz podstawowy eksport',
  'Pipeline aplikacji i podstawowe przygotowanie do rozmowy',
  'Opcjonalne konto i synchronizacja chmurowa tam, gdzie Supabase jest skonfigurowany',
];

const unavailable = [
  'Zakup planu Pro lub okresu próbnego',
  'Zakup pojedynczych szablonów premium',
  'Zakup Karnetu Aplikacyjnego',
  'Teleprompter Live HUD dla nowych testerów',
  'Funkcje oznaczone w aplikacji jako planowane lub poza zakresem bety',
];

export const PricingView: React.FC = () => {
  const { usage, source } = useEntitlements();

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8" data-testid="beta-scope-view">
      <PageHeader
        title="Bezpłatna beta Kierivo"
        description="W tej wersji nie sprzedajemy planów, szablonów ani Karnetu. Tester może wykonać podstawowy przepływ bez karty i bez checkoutu."
        badge={FREE_BETA_LABEL.toUpperCase()}
      />

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-brand-200 bg-brand-50 p-6 sm:p-8">
          <div className="flex items-center gap-2 text-brand-fg">
            <FlaskConical className="h-5 w-5" aria-hidden="true" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">Cena podczas bety</span>
          </div>
          <div className="mt-4 font-mono text-6xl font-black text-ink">
            {FREE_BETA_PRICE_PLN} zł
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Brak subskrypcji, triala i płatnego odblokowania. Jeżeli funkcja jest poza zakresem,
            aplikacja ma o tym powiedzieć wprost zamiast prowadzić do nieczynnej kasy.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-success/30 bg-success-soft px-3 py-2 text-xs font-semibold text-success-fg">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Podstawowy przepływ nie wymaga płatności
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-fg" aria-hidden="true" />
            <h2 className="text-lg font-bold text-ink">Co naprawdę obejmuje beta</h2>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {included.map((item) => (
              <li key={item} className="flex gap-2.5 rounded-xl border border-line/70 bg-elevated p-3 text-sm text-ink">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-fg" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-line bg-surface p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-fg" aria-hidden="true" />
            <h2 className="text-base font-bold text-ink">Limity techniczne bety</h2>
          </div>
          <div className="mt-4 space-y-3 text-sm text-muted">
            <p>
              Import pliku: do <strong className="text-ink">{FREE_MONTHLY_IMPORTS}</strong> na miesiąc w
              obecnym limicie. Aktualnie pozostało: <strong className="text-ink">{usage.importUses}</strong>.
              Po wyczerpaniu nadal można wkleić tekst CV bez płatności.
            </p>
            <p>
              Operacje AI po stronie serwera: do <strong className="text-ink">{FREE_DAILY_AI_USES}</strong> na
              dobę dla darmowego konta. Aktualnie pozostało: <strong className="text-ink">{usage.aiUses}</strong>.
              Serwer jest ostatecznym źródłem prawdy o limicie.
            </p>
            <p className="text-xs text-subtle">
              Źródło aktualnego licznika UI: {source === 'server' ? 'serwer' : 'lokalna podpowiedź do czasu synchronizacji'}.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-warning/30 bg-warning-soft p-6">
          <div className="flex items-center gap-2 text-warning-fg">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            <h2 className="text-base font-bold">Czego beta nie sprzedaje ani nie obiecuje</h2>
          </div>
          <ul className="mt-4 space-y-2.5 text-sm text-ink">
            {unavailable.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-elevated p-6 text-sm leading-relaxed text-muted">
        <h2 className="font-bold text-ink">Jak czytać wynik ATS w Kierivo</h2>
        <p className="mt-2">
          Wynik 0–100 jest własną oceną Kierivo wyliczaną z cech dokumentu i treści ogłoszenia.
          Nie pochodzi z Workday, Greenhouse, Lever, Taleo ani innego zewnętrznego ATS. Nie przewiduje
          decyzji rekrutera i nie gwarantuje zaproszenia na rozmowę ani zatrudnienia.
        </p>
      </section>
    </div>
  );
};
