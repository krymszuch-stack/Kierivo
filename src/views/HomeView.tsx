/**
 * HomeView — strona główna Kierivo (Public Pre-Beta).
 *
 * Zasady:
 * - wyłącznie tokeny z src/styles/tokens.css (surface / elevated / ink / muted /
 *   line / brand-* / violet / success / warning), zero zaszytych kolorów,
 *   poprawny wygląd w trybie jasnym i ciemnym;
 * - jeden <h2>, sekcje z nagłówkami, animacje tylko na CSS;
 * - żadnych nowych zależności.
 *
 * Podmiana 1:1 — zachowuje pełną kompatybilność z App.tsx oraz testami kontraktowymi.
 */

import type { ReactNode } from 'react';
import type { MasterVault } from '../types';
import type { NavTabId, NavSectionId } from '../lib/navigation';

export type HomeViewProps = {
  /** Główne wezwanie do działania — wejście w przepływ profilu / CV. */
  onStart?: () => void;
  /** Przejście do widoku planów / informacji o cenie. */
  onViewPricing?: () => void;
  /** Dane profilu użytkownika przekazywane z App.tsx */
  vault?: MasterVault;
  /** Nawigacja po głównych zakładkach aplikacji */
  onNavigate?: (tab: NavTabId) => void;
  /** Otwarcie modalnego doradcy */
  onOpenAdvisor?: (question?: string) => void;
  /** Powody zablokowania poszczególnych sekcji (np. pipeline bez profilu) */
  lockReasons?: Partial<Record<NavSectionId, string>>;
  /** Sloty na rekomendacje następnego kroku i pytania uzupełniające */
  actionSlot?: ReactNode;
  questionsSlot?: ReactNode;
};

/* ------------------------------------------------------------------ dane */

const STEPS = [
  {
    n: '01',
    title: 'Zbuduj profil w Master Vault',
    body: 'Wklej treść CV albo zaimportuj plik. Historia zatrudnienia, projekty, umiejętności i uprawnienia trafiają do jednego uporządkowanego miejsca.',
    target: 'profil' as NavTabId,
  },
  {
    n: '02',
    title: 'Wklej konkretne ogłoszenie',
    body: 'Kierivo porównuje profil z tą jedną ofertą: wykryte frazy, brakujące wymagania, pokrycie umiejętności, sygnały strukturalne.',
    target: 'aplikuj' as NavTabId,
  },
  {
    n: '03',
    title: 'Wyślij i prowadź proces',
    body: 'Zapisujesz aplikację ze snapshotem dokumentu i przesuwasz ją przez własne statusy — od wysłanej do decyzji.',
    target: 'pipeline' as NavTabId,
  },
] as const;

const PILLARS = [
  {
    title: 'Master Vault',
    body: 'Jedno źródło faktów o Twojej karierze. Raz uporządkowane, używane przy każdej kolejnej aplikacji.',
    target: 'profil' as NavTabId,
    icon: (
      <>
        <path d="M4 7.5 12 3.5l8 4v9L12 20.5l-8-4v-9Z" />
        <path d="M12 11.5 4 7.5m8 4 8-4m-8 4v9" />
      </>
    ),
  },
  {
    title: 'Dopasowanie do oferty',
    body: 'Pokrycie umiejętności, brakujące wymagania i rekomendacje redakcyjne dla tego jednego ogłoszenia.',
    target: 'aplikuj' as NavTabId,
    icon: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M20.5 20.5 15.7 15.7M11 8v6m-3-3h6" />
      </>
    ),
  },
  {
    title: 'Walidator spójności',
    body: 'Sprawdza przekazane fakty względem Master Vaultu, żeby dokument nie zaczął żyć własnym życiem.',
    target: 'aplikuj' as NavTabId,
    icon: (
      <>
        <path d="M12 3.5l7 2.5v6c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-2.5Z" />
        <path d="m8.8 12 2.2 2.2 4.2-4.4" />
      </>
    ),
  },
  {
    title: 'Pipeline aplikacji',
    body: 'Własne statusy procesu i snapshot wysłanego dokumentu, odseparowany od późniejszych zmian profilu.',
    target: 'pipeline' as NavTabId,
    icon: (
      <>
        <path d="M4 6h16M4 12h10M4 18h6" />
        <circle cx="18" cy="15.5" r="3" />
      </>
    ),
  },
] as const;

const FAQ = [
  {
    q: 'Ile to kosztuje?',
    a: 'Public Pre-Beta PB-2026.09 jest bezpłatna — 0 zł. Nie ma checkoutu, subskrypcji Pro ani płatnego okresu próbnego. Funkcje poza zakresem są oznaczane jako niedostępne, a nie prowadzą do martwej kasy.',
  },
  {
    q: 'Co dzieje się z moimi danymi?',
    a: 'W trybie lokalnym profil roboczy zostaje w pamięci tej przeglądarki. Jeśli świadomie włączysz konto w chmurze, vault jest synchronizowany z bazą przypisaną do Ciebie i chronioną politykami dostępu.',
  },
  {
    q: 'Czy Kierivo dopisuje fakty, których nie podałem?',
    a: 'Nie. Pracuje na treści, którą wprowadzisz, a walidator spójności zgłasza rozbieżności między dokumentem a Master Vaultem.',
  },
  {
    q: 'Czy wynik oznacza, że przejdę filtr ATS?',
    a: 'Nie. To szacowany wynik przejścia filtra ATS wyliczony na podstawie reguł Kierivo. Nie mamy dostępu do prywatnych konfiguracji rekrutera w Workday, Greenhouse, Lever czy Taleo i nie obiecujemy zaproszenia na rozmowę.',
  },
  {
    q: 'Czym jest Doradca w interfejsie?',
    a: 'Obecnie lokalnym modułem regułowym, nie czatem LLM. Dostaje wyłącznie Twoje pytanie lub wybrany szybki prompt — nie czyta sam Master Vaultu ani zapisanych aplikacji.',
  },
] as const;

const KEYWORDS = [
  { label: 'zarządzanie projektem', hit: true },
  { label: 'Excel / raportowanie', hit: true },
  { label: 'obsługa klienta B2B', hit: true },
  { label: 'SAP', hit: false },
  { label: 'angielski B2', hit: true },
  { label: 'budżetowanie', hit: false },
] as const;

/* ------------------------------------------------------- małe komponenty */

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

 function PrimaryCta({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-brand-600 px-5 text-sm font-semibold text-on-brand shadow-raised transition duration-fast hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 motion-safe:hover:-translate-y-0.5"
    >
      {children}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 transition-transform duration-fast motion-safe:group-hover:translate-x-0.5"
        aria-hidden="true"
      >
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </svg>
    </button>
  );
}

function GhostCta({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-line-strong bg-elevated px-5 text-sm font-semibold text-ink transition duration-fast hover:border-brand-400 hover:text-brand-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-label uppercase tracking-[0.18em] text-brand-fg">{children}</p>
  );
}

/** Makieta wyniku dopasowania — statyczna, poglądowa, bez wykresów z biblioteki. */
 function MatchPanel() {
  const coverage = 78;
  return (
    <figure className="rounded-2xl border border-line bg-elevated p-5 shadow-floating sm:p-6">
      <figcaption className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-label uppercase tracking-[0.16em] text-subtle">
            Przykładowy wynik
          </p>
          <p className="mt-1 text-base font-semibold text-ink">
            Logistyka · Kraków
          </p>
        </div>
        <span className="shrink-0 rounded-sm bg-brand-50 px-2 py-1 font-mono text-meta uppercase tracking-[0.14em] text-brand-fg">
          Przykład
        </span>
      </figcaption>

      <div className="mt-6 flex items-center gap-5">
        <div
          className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(var(--color-brand-500) ${coverage}%, var(--color-sunken) ${coverage}% 100%)`,
          }}
          role="img"
          aria-label={`Pokrycie umiejętności ${coverage} procent`}
        >
          <div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-elevated">
            <span className="font-mono text-xl font-semibold text-ink">{coverage}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Pokrycie umiejętności z ogłoszenia</p>
           <p className="mt-1 text-sm text-muted">
             W przykładzie 14 z 18 wymagań ma potwierdzenie. Cztery pozostałe wskazujemy poniżej —
             razem z tym, gdzie w CV ich brakuje.
           </p>
        </div>
      </div>

      <div className="mt-6 space-y-3 border-t border-line pt-5">
        <p className="font-mono text-label uppercase tracking-[0.16em] text-subtle">
          Brakujące wymagania
        </p>
        <ul className="space-y-2">
          {['SAP (moduł MM)', 'Budżetowanie kosztów transportu', 'Uprawnienia UDT'].map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-ink">
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-sm bg-warning-soft text-warning-fg"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3 w-3">
                  <path d="M12 7v6.5M12 17h.01" strokeLinecap="round" />
                </svg>
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 space-y-3 border-t border-line pt-5">
        <p className="font-mono text-label uppercase tracking-[0.16em] text-subtle">Wykryte frazy</p>
        <ul className="flex flex-wrap gap-2">
          {KEYWORDS.map((k) => (
            <li
              key={k.label}
              className={[
                'rounded-sm border px-2.5 py-1 font-mono text-meta',
                k.hit
                  ? 'border-transparent bg-success-soft text-success-fg'
                  : 'border-dashed border-line-strong text-subtle',
              ].join(' ')}
            >
              {k.hit ? '✓ ' : '– '}
              {k.label}
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

/* --------------------------------------------------------------- widok */

export function HomeView({
  onStart,
  onViewPricing,
  vault,
  onNavigate,
  onOpenAdvisor,
  lockReasons,
  actionSlot,
  questionsSlot,
}: HomeViewProps) {
  const hasStarted = Boolean(vault?.personalInfo?.fullName || (vault?.history && vault.history.length > 0));

  const handleStart = () => {
    if (onStart) {
      onStart();
    } else if (onNavigate) {
      onNavigate('aplikuj');
    }
  };

  const handlePricing = () => {
    if (onViewPricing) {
      onViewPricing();
    } else if (onNavigate) {
      onNavigate('pricing');
    }
  };

  const handleStepClick = (target: NavTabId) => {
    if (onNavigate) {
      onNavigate(target);
    } else if (onStart) {
      onStart();
    } else {
      return;
    }
  };

  return (
    <div className="bg-surface text-ink">
      {/* ---------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{
            background:
              'radial-gradient(closest-side, color-mix(in oklab, var(--color-brand-500) 22%, transparent), transparent)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center lg:gap-14 lg:pb-24 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-elevated/80 px-3 py-1 font-mono text-meta uppercase tracking-[0.16em] text-muted backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-violet" aria-hidden="true" />
              Public Pre-Beta · 0 zł
            </p>

            <h2 className="mt-5 text-[2.25rem] font-bold leading-[1.02] tracking-[-0.03em] text-ink sm:text-display-md lg:text-[3.5rem] m-0">
              Jedno CV, jedno ogłoszenie,
              <br className="hidden sm:block" />{' '}
              <span className="text-brand-fg">zero zgadywania</span>.
            </h2>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Kierivo porządkuje fakty o Twojej karierze, porównuje je z konkretną ofertą i pokazuje
              czarno na białym, czego w dokumencie brakuje. Potem prowadzi cały proces aplikacyjny w
              jednym miejscu.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <PrimaryCta onClick={handleStart}>
                {hasStarted ? 'Sprawdź dopasowanie do oferty' : 'Sprawdź swoje CV — bezpłatnie'}
              </PrimaryCta>
              <button
                type="button"
                onClick={() => document.getElementById('jak-to-dziala')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold text-ink transition duration-fast hover:text-brand-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              >
                Zobacz, jak to działa
              </button>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-subtle">
              <li>Bez karty płatniczej</li>
              <li>Profil może zostać w tej przeglądarce</li>
              <li>Wklejenie treści CV jest bezpłatne</li>
            </ul>
          </div>

          <div className="lg:pl-4">
            <MatchPanel />
          </div>
        </div>
      </section>

      {/* ------------------------------- sloty operacyjne (rekomendacje) */}
      {(actionSlot || questionsSlot) && (
        <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-6 space-y-4" aria-label="Twój następny krok">
          {actionSlot}
          {questionsSlot}
        </section>
      )}

      {/* -------------------------------------------------- jak to działa */}
      <section id="jak-to-dziala" className="border-t border-line bg-sunken/60 scroll-mt-16">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 lg:py-20 lg:pl-4">
          <SectionLabel>Jak to działa</SectionLabel>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-[-0.02em] text-ink sm:text-display-sm">
            Trzy ruchy i masz kontrolę nad swoim CV.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Trzy kroki od bałaganu w plikach do prowadzonego procesu
          </p>

          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li
                key={s.n}
                role="button"
                tabIndex={0}
                onClick={() => handleStepClick(s.target)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleStepClick(s.target);
                  }
                }}
                className="group cursor-pointer rounded-lg border border-line bg-elevated p-6 transition duration-ui hover:border-brand-400 motion-safe:hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-label tracking-[0.2em] text-brand-fg">{s.n}</span>
                  <span className="font-mono text-meta text-subtle group-hover:text-brand-fg transition-colors">
                    Otwórz →
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-ink group-hover:text-brand-fg transition-colors">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

       {/* ------------------------------------------------------- filary */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 lg:py-20 lg:pl-4">
          <SectionLabel>Co dostajesz</SectionLabel>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-[-0.02em] text-ink sm:text-display-sm">
            Cztery rzeczy, które robi Public Pre-Beta
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {PILLARS.map((p) => {
              const isLocked = p.target === 'pipeline' ? !!lockReasons?.pipeline : false;
              return (
                <article
                  key={p.title}
                  role="button"
                  tabIndex={isLocked ? -1 : 0}
                  onClick={() => !isLocked && handleStepClick(p.target)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isLocked) {
                      e.preventDefault();
                      handleStepClick(p.target);
                    }
                  }}
                  className={`rounded-lg border border-line bg-elevated p-6 transition duration-ui ${
                    isLocked ? 'opacity-85' : 'cursor-pointer hover:border-brand-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-md bg-brand-50 text-brand-fg">
                      <Icon>{p.icon}</Icon>
                    </span>
                    {isLocked && (
                      <span className="rounded bg-sunken px-2 py-0.5 font-mono text-meta text-subtle">
                        {lockReasons?.pipeline}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-ink">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

       {/* --------------------------------------------- zaufanie i dane */}
      <section className="border-t border-line bg-sunken/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-20 sm:px-6 lg:grid-cols-2 lg:py-20 lg:pl-4">
          <div>
            <SectionLabel>Dane i uczciwość</SectionLabel>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-display-sm">
              Wiesz, gdzie leżą Twoje dane i czego wynik nie obiecuje
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Kierivo ma dwa tryby. Lokalny trzyma profil roboczy w pamięci tej przeglądarki. Konto w
              chmurze — jeśli je włączysz — synchronizuje vault z bazą przypisaną do Ciebie i
              chronioną politykami dostępu.
            </p>
            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-elevated p-5">
                <dt className="text-sm font-semibold text-ink">Tryb lokalny</dt>
                <dd className="mt-2 text-sm text-muted">
                  Profil nie opuszcza przeglądarki. Bez konta, bez rejestracji.
                </dd>
              </div>
              <div className="rounded-lg border border-line bg-elevated p-5">
                <dt className="text-sm font-semibold text-ink">Konto w chmurze</dt>
                <dd className="mt-2 text-sm text-muted">
                  Świadomie włączona synchronizacja, dostęp tylko dla właściciela vaultu.
                </dd>
              </div>
            </dl>
          </div>

          <aside className="rounded-lg border border-warning/40 bg-warning-soft/60 p-6">
            <p className="font-mono text-label uppercase tracking-[0.16em] text-warning-fg">
              Czego nie obiecujemy
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink">
              <li>
                Wynik Kierivo to <strong className="font-semibold">szacowany wynik przejścia filtra ATS</strong>{' '}
                — oparty na analizie zgodności z ofertą, a nie wynik z systemów Workday, Greenhouse, Lever czy Taleo.
              </li>
              <li>
                Nie mamy dostępu do prywatnej konfiguracji rekrutera i nie gwarantujemy przejścia
                filtra, zaproszenia na rozmowę ani zatrudnienia.
              </li>
              <li>
                „Brak wykrytych rozbieżności” dotyczy zakresu, który faktycznie trafił do walidatora,
                a nie całego dokumentu.
              </li>
              <li>
                Doradca w interfejsie jest lokalnym modułem regułowym, nie czatem LLM, i nie czyta
                sam Twojego vaultu.
              </li>
            </ul>
          </aside>
        </div>
      </section>

       {/* ---------------------------------------------------------- FAQ */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-6 lg:py-20 lg:pl-4">
          <SectionLabel>Częste pytania</SectionLabel>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-display-sm">
            Najczęściej zadawane pytania
          </h2>

          <div className="mt-8 divide-y divide-line border-y border-line">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink transition duration-fast hover:text-brand-fg">
                  {item.q}
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-sm border border-line text-muted transition-transform duration-ui group-open:rotate-45"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <div className="mt-3 pr-10 text-sm leading-relaxed text-muted space-y-2">
                  <p>{item.a}</p>
                  {item.q.includes('Doradca') && onOpenAdvisor && (
                    <button
                      type="button"
                      onClick={() => onOpenAdvisor(item.q)}
                      className="cursor-pointer font-semibold text-brand-fg hover:underline"
                    >
                      Otwórz pytania Doradcy
                    </button>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

       {/* -------------------------------------------------- domknięcie */}
      <section className="border-t border-line bg-sunken/60">
        <div className="relative mx-auto max-w-6xl overflow-hidden px-5 py-20 text-center sm:px-6 lg:py-24 lg:pl-4">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-[-30%] mx-auto h-[420px] w-[720px] rounded-full opacity-50 blur-3xl"
            style={{
              background:
                'radial-gradient(closest-side, color-mix(in oklab, var(--color-violet) 20%, transparent), transparent)',
            }}
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-2xl font-bold tracking-[-0.02em] text-ink sm:text-display-sm">
              Sprawdź, jak Twoje CV wygląda przy jednym konkretnym ogłoszeniu
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted">
              Public Pre-Beta jest bezpłatna. Wklej treść CV, wklej ofertę i zobacz wynik w kilka
              minut.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCta onClick={handleStart}>Sprawdź swoje CV — bezpłatnie</PrimaryCta>
              <GhostCta onClick={handlePricing}>
                Ograniczenia darmowej wersji
              </GhostCta>
            </div>
            <p className="mt-6 font-mono text-meta uppercase tracking-[0.16em] text-subtle">
              PB-2026.09 · cena 0 zł · bez płatności
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomeView;
