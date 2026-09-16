import React from 'react';
import {
  CheckCircle2,
  FlaskConical,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Zap,
  Bot,
  FileText,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { useEntitlements, FREE_DAILY_AI_USES, FREE_MONTHLY_IMPORTS } from '../store/useEntitlements';
import { FREE_BETA_LABEL, FREE_BETA_PRICE_PLN } from '../lib/beta';

const includedInBeta = [
  'Tworzenie i nielimitowana edycja profilu Master Vault',
  'Wklejanie treści CV i lokalne scalanie z faktami',
  'Audyt Kierivo: słowa kluczowe, gęstość fraz, struktura i formatowanie',
  'Dopasowanie CV do ogłoszenia i wykrywanie luk kompetencyjnych',
  'Hybrydowy silnik PDF (zgodność z filtrami ATS + layout human-first)',
  'Nowość: Weryfikator AI 360° z potrójną pętlą sprawdzającą',
  'Nowość: Trener Rozmowy STAR z symulacją i oceną odpowiedzi (Azure gpt-4o)',
  'Pipeline aplikacji i audyt osi czasu z formułą Google X-Y-Z',
  'Opcjonalna synchronizacja chmurowa tam, gdzie wdrożono bazę danych',
];

const unavailableInBeta = [
  'Zakup planu Pro lub płatnego okresu próbnego',
  'Zakup pojedynczych szablonów premium',
  'Zakup płatnego Karnetu Aplikacyjnego',
  'Teleprompter Live HUD dla nowych testerów',
  'Funkcje oznaczone w aplikacji jako planowane lub poza zakresem bety',
];

export const PricingView: React.FC = () => {
  const { usage, source } = useEntitlements();

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8" data-testid="beta-scope-view">
      <PageHeader
        title="Architektura komercyjna i Bezpłatna Beta"
        description="W tej wersji nie pobieramy opłat, nie sprzedajemy abonamentów ani nie prosimy o kartę. Tester może zrealizować pełny cykl aplikacyjny bezpłatnie w ramach dobowych limitów Azure."
        badge={FREE_BETA_LABEL.toUpperCase()}
      />

      {/* Główny baner bezpłatnej bety */}
      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-brand-200 bg-brand-50/70 dark:bg-brand-950/20 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-brand-fg">
              <FlaskConical className="h-5 w-5" aria-hidden="true" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider">Cena podczas bety</span>
            </div>
            <div className="mt-4 font-mono text-6xl font-black text-ink">
              {FREE_BETA_PRICE_PLN} zł
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Brak subskrypcji, triala i płatnego odblokowania. Dzięki puli kredytów Azure OpenAI wdrożyliśmy
              aż <strong>25 darmowych operacji AI na dobę</strong> dla każdego aktywnego testera.
            </p>
          </div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-success/30 bg-success-soft px-3.5 py-2 text-xs font-semibold text-success-fg">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Pełny przepływ i asystenci AI bez karty płatniczej</span>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-fg" aria-hidden="true" />
            <h2 className="text-lg font-bold text-ink">Co w pełni obejmuje bezpłatna beta</h2>
          </div>
          <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {includedInBeta.map((item) => (
              <li key={item} className="flex gap-2.5 rounded-xl border border-line/70 bg-elevated p-3 text-xs leading-relaxed text-ink">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-fg" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Trzy filary architektury komercyjnej */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Trzy filary oferty Kierivo</h2>
          <p className="text-xs text-muted">
            Docelowa architektura komercyjna. W obecnej fazie testów beta wszystkie funkcje są udostępnione bezpłatnie w ramach dobowych limitów.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {/* Filar 1: Bezpłatna Beta (Aktywna) */}
          <div className="relative flex flex-col rounded-3xl border-2 border-brand-500 bg-surface p-6 shadow-sm ring-1 ring-brand-500/20">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-grad px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-brand shadow-xs">
              Aktualnie aktywny dla każdego
            </div>
            <div className="flex items-center gap-2 text-brand-fg">
              <Bot className="h-5 w-5" />
              <h3 className="font-sans text-base font-bold text-ink">Bezpłatna Beta</h3>
            </div>
            <p className="mt-1 text-xs text-muted min-h-[32px]">
              Dla testerów szukających pracy i weryfikujących skuteczność swojego CV.
            </p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-mono text-4xl font-black text-ink">0 zł</span>
              <span className="text-xs text-muted">/ bez limitu czasu bety</span>
            </div>
            <ul className="mt-6 flex-1 space-y-2.5 text-xs text-ink">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-fg mt-0.5" />
                <span><strong>25 zapytań AI / dobę</strong> (Azure gpt-4o)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-fg mt-0.5" />
                <span>Trener Rozmowy STAR & symulator pytań</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-fg mt-0.5" />
                <span>Potrójny weryfikator CV 360°</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-fg mt-0.5" />
                <span>Audyt osi czasu i luk zawodowych</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-fg mt-0.5" />
                <span>Do 3 importów plików / miesiąc</span>
              </li>
            </ul>
            <div className="mt-6 rounded-xl border border-success/30 bg-success-soft py-2 text-center text-xs font-bold text-success-fg">
              ✓ Aktywne w Twojej przeglądarce
            </div>
          </div>

          {/* Filar 2: Karnet Aplikacyjny (Planowany) */}
          <div className="flex flex-col rounded-3xl border border-line bg-surface p-6 shadow-xs">
            <div className="flex items-center gap-2 text-muted">
              <FileText className="h-5 w-5" />
              <h3 className="font-sans text-base font-bold text-ink">Karnet Aplikacyjny</h3>
            </div>
            <p className="mt-1 text-xs text-muted min-h-[32px]">
              Jednorazowy pakiet dopasowań bez comiesięcznych subskrypcji.
            </p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-mono text-4xl font-black text-ink">19 zł</span>
              <span className="text-xs text-muted">/ pakiet 10 aplikacji (planowane)</span>
            </div>
            <ul className="mt-6 flex-1 space-y-2.5 text-xs text-muted">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-fg mt-0.5" />
                <span>10 kompletnych pakietów aplikacyjnych (CV + List)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-fg mt-0.5" />
                <span>Zaawansowany auto-balancing bloków A4 PDF</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-fg mt-0.5" />
                <span>Dopasowanie słów kluczowych pod konkretne ATS</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-fg mt-0.5" />
                <span>Brak automatycznego odnawiania subskrypcji</span>
              </li>
            </ul>
            <div className="mt-6 rounded-xl border border-line bg-elevated py-2 text-center text-xs font-medium text-muted">
              W cenie Bety (0 zł podczas programu)
            </div>
          </div>

          {/* Filar 3: Plan Pro (Planowany) */}
          <div className="flex flex-col rounded-3xl border border-line bg-surface p-6 shadow-xs">
            <div className="flex items-center gap-2 text-muted">
              <Zap className="h-5 w-5" />
              <h3 className="font-sans text-base font-bold text-ink">Plan Pro</h3>
            </div>
            <p className="mt-1 text-xs text-muted min-h-[32px]">
              Dla aktywnych kandydatów wysyłających dziesiątki aplikacji.
            </p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-mono text-4xl font-black text-ink">39 zł</span>
              <span className="text-xs text-muted">/ miesiąc (planowane)</span>
            </div>
            <ul className="mt-6 flex-1 space-y-2.5 text-xs text-muted">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-fg mt-0.5" />
                <span>Nielimitowane analizy AI i nielimitowany import plików</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-fg mt-0.5" />
                <span>Teleprompter Live HUD podczas wideorozmów</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-fg mt-0.5" />
                <span>Zaawansowane szablony branżowe PDF</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-fg mt-0.5" />
                <span>Priorytetowe przetwarzanie w chmurze</span>
              </li>
            </ul>
            <div className="mt-6 rounded-xl border border-line bg-elevated py-2 text-center text-xs font-medium text-muted">
              W cenie Bety (0 zł podczas programu)
            </div>
          </div>
        </div>
      </section>

      {/* Sekcja limitów technicznych i transparentności */}
      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-line bg-surface p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-fg" aria-hidden="true" />
            <h2 className="text-base font-bold text-ink">Limity techniczne w obecnej wersji</h2>
          </div>
          <div className="mt-4 space-y-3 text-sm text-muted">
            <p>
              Operacje AI: do <strong className="text-ink">{FREE_DAILY_AI_USES}</strong> zapytań na
              dobę na użytkownika (Azure OpenAI gpt-4o Poland Central). Aktualnie pozostało dziś:{' '}
              <strong className="text-ink font-mono">{usage.aiUses}</strong>.
            </p>
            <p>
              Import pliku: do <strong className="text-ink">{FREE_MONTHLY_IMPORTS}</strong> na miesiąc w
              obecnym limicie. Aktualnie pozostało: <strong className="text-ink font-mono">{usage.importUses}</strong>.
              Wklejanie tekstu CV jest nielimitowane i bezpłatne.
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
            {unavailableInBeta.map((item) => (
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
