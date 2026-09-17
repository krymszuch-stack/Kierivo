import React from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileSearch,
  FileText,
  FolderCheck,
  Heart,
  Lock,
  ScanSearch,
  Send,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import type { MasterVault } from '../types';
import type { NavTabId, NavSectionId } from '../lib/navigation';
import { Card } from '../components/ui/Card';
import { HomeLiveDemo } from '../features/livedemo/HomeLiveDemo';

interface HomeViewProps {
  vault: MasterVault;
  onNavigate: (tab: NavTabId) => void;
  onOpenAdvisor: (question?: string) => void;
  /**
   * Powody zamknięcia sekcji (z useUnlocks). Kafelek celujący w zamkniętą
   * sekcję ma obowiązek powiedzieć o tym ZANIM ktoś kliknie — toast po
   * kliknięciu to nie kontrola dostępu, tylko zaskoczenie (reguła 2).
   */
  lockReasons?: Partial<Record<NavSectionId, string>>;
  actionSlot?: React.ReactNode;
  questionsSlot?: React.ReactNode;
}

const STEPS: Array<{
  id: string;
  number: string;
  title: string;
  description: string;
  action: string;
  target: NavTabId;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'profile', number: '01', title: 'Dodaj swoje fakty', description: 'Wgraj CV albo uzupełnij profil po swojemu. To jest Twoja baza, nie generator bajek.', action: 'Otwórz profil', target: 'profil', icon: FileText },
  { id: 'match', number: '02', title: 'Wklej ogłoszenie', description: 'Porównaj ofertę z tym, co naprawdę masz w CV. Luki są informacją, nie powodem do dopisywania fikcji.', action: 'Sprawdź dopasowanie', target: 'aplikuj', icon: FileSearch },
  { id: 'send', number: '03', title: 'Przygotuj wersję do wysłania', description: 'Wybierz prosty dokument, obejrzyj go przed eksportem i zapisz aplikację, gdy faktycznie ją wyślesz.', action: 'Przygotuj dokument', target: 'profil', icon: Send },
];

const FEATURES: Array<{
  title: string;
  description: string;
  action: string;
  target: NavTabId;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { title: 'Jedno CV, wiele ofert', description: 'Master Vault trzyma Twoje potwierdzone doświadczenie, a nie kolekcję plików „final_final2”.', action: 'Otwórz profil', target: 'profil', icon: FolderCheck },
  { title: 'Własny audyt, bez magii', description: 'Sprawdza układ, nagłówki, tabele, znaki i dopasowanie słów. To wskazówka techniczna, nie decyzja rekrutera.', action: 'Otwórz audyt ATS', target: 'ats-lab', icon: ScanSearch },
  { title: 'Aplikacje w jednym miejscu', description: 'Zapisuj te CV, które rzeczywiście wysłałeś, z liczbą wersji i etapem. Bez wymyślonych rozmów i statusów.', action: 'Zobacz moje aplikacje', target: 'pipeline', icon: BriefcaseBusiness },
];

interface TileProps {
  number?: string;
  title: string;
  description: string;
  action: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Uzupełniane, gdy cel kafelka jest sekcją zamkniętą — kafelek mówi o tym wprost. */
  lockReason?: string;
  onClick: () => void;
}

/** Jedyny kafelek strony startowej: jedna definicja wyglądu dla kroków i cech. */
const Tile: React.FC<TileProps> = ({ number, title, description, action, icon: Icon, lockReason, onClick }) => (
  <Card
    tone="raised"
    spotlight
    onClick={onClick}
    whileHover={{ y: -2 }}
    className="group"
  >
    <div className="flex items-center justify-between">
      {number
        ? <span className="font-mono text-xs font-bold text-brand-fg">{number}</span>
        : <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" />}
      {number && <Icon className="h-5 w-5 text-muted transition-transform duration-150 group-hover:scale-110 group-hover:text-brand-600" aria-hidden="true" />}
    </div>
    <h3 className="mt-7 text-base font-bold text-ink">{title}</h3>
    <p className="mt-2 min-h-14 text-xs leading-relaxed text-muted">{description}</p>
    <div className="mt-5 flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1 text-meta font-semibold text-brand-fg">
        {action}
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
      {lockReason && (
        <span
          className="inline-flex items-center gap-1 text-meta text-subtle"
          title={lockReason}
        >
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Zamknięte
        </span>
      )}
    </div>
    {lockReason && <p className="mt-1.5 text-meta leading-snug text-subtle">{lockReason}</p>}
  </Card>
);

export const HomeView: React.FC<HomeViewProps> = ({ vault, onNavigate, onOpenAdvisor, lockReasons, actionSlot, questionsSlot }) => {
  const hasStarted = Boolean(vault.personalInfo.fullName || vault.history.length);

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-14">
      <section className="overflow-hidden rounded-3xl border border-line bg-elevated">
        <div className="grid items-stretch lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative isolate flex flex-col justify-center overflow-hidden p-6 sm:p-10 lg:p-12">
            <img
              src="/brand/kierivo-motif.svg"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.08] dark:opacity-[0.04]"
            />
            <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-meta font-bold text-brand-fg"><Heart className="h-3.5 w-3.5" aria-hidden="true" />CV bez zadęcia. I bez bajek.</p>
            <h1 className="max-w-xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-5xl">Wiesz, co umiesz. <span className="text-brand-fg">Pomóżmy to dobrze pokazać.</span></h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted sm:text-base">Kierivo porządkuje Twoje prawdziwe doświadczenie, porównuje CV z ofertą i pomaga przygotować spokojną, czytelną wersję do wysłania. Bez obiecywania pracy za trzy kliknięcia :)</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={() => onNavigate(hasStarted ? 'aplikuj' : 'profil')} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-on-brand shadow-raised transition-transform hover:scale-[1.02] hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{hasStarted ? 'Sprawdź ofertę' : 'Dodaj swoje CV'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
              <button type="button" onClick={() => onNavigate('porady')} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><Sparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />Zobacz, jak to działa</button>
            </div>
            <p className="mt-4 text-meta text-subtle">Konto jest opcjonalne. Przydaje się dopiero, gdy chcesz synchronizować dane między urządzeniami.</p>
          </div>
          <div className="flex items-center border-t border-line bg-sunken p-4 sm:p-6 lg:border-l lg:border-t-0">
            {/* Demo liczone prawdziwym silnikiem na danych przykładowych —
                zamiast zdjęcia stockowego (i tak niczego nie dowodziło). */}
            <HomeLiveDemo onNavigate={onNavigate} className="w-full" />
          </div>
        </div>
      </section>

      {(actionSlot || questionsSlot) && <section className="space-y-4" aria-label="Twój następny krok">{actionSlot}{questionsSlot}</section>}

      <section aria-labelledby="how-it-works">
        <div className="mb-5 max-w-2xl"><p className="text-label font-bold uppercase tracking-[0.14em] text-brand-fg">Bez instrukcji obsługi wielkości encyklopedii</p><h2 id="how-it-works" className="mt-2 text-2xl font-extrabold tracking-tight text-ink">Trzy ruchy i masz kontrolę nad swoim CV.</h2></div>
        <div className="grid gap-3 md:grid-cols-3">
          {STEPS.map((step) => (
            <Tile
              key={step.id}
              number={step.number}
              title={step.title}
              description={step.description}
              action={step.action}
              icon={step.icon}
              onClick={() => onNavigate(step.target)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-sunken p-5 sm:p-8" aria-labelledby="why-kierivo">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="max-w-2xl"><p className="text-label font-bold uppercase tracking-[0.14em] text-brand-fg">Po co to wszystko?</p><h2 id="why-kierivo" className="mt-2 text-2xl font-extrabold tracking-tight text-ink">Żeby mniej zgadywać, a więcej pokazać.</h2><p className="mt-2 text-sm leading-relaxed text-muted">Nie zastępujemy rekrutera, nie wysyłamy aplikacji za Ciebie i nie wpisujemy cudzych umiejętności. Dajemy Ci lepszy porządek, kontekst i chwilę oddechu przed kliknięciem „wyślij”.</p></div><button type="button" onClick={() => onOpenAdvisor()} className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><WandSparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />Pytania? Otwórz FAQ Doradcy</button></div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <Tile
              key={feature.title}
              title={feature.title}
              description={feature.description}
              action={feature.action}
              icon={feature.icon}
              lockReason={feature.target === 'pipeline' ? lockReasons?.pipeline : undefined}
              onClick={() => onNavigate(feature.target)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-line py-5 text-xs text-muted" aria-label="Zasady działania Kierivo">
        <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success-fg" aria-hidden="true" />Twoje fakty zostają Twoimi faktami.</span>
        <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success-fg" aria-hidden="true" />Wynik dopasowania jest własną analizą aplikacji.</span>
        <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success-fg" aria-hidden="true" />Przed eksportem zawsze widzisz dokument.</span>
      </section>
    </div>
  );
};
