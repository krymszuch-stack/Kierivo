import React from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileSearch,
  FileText,
  FolderCheck,
  Heart,
  ScanSearch,
  Send,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { MasterVault } from '../types';
import type { NavTabId } from '../lib/navigation';

interface HomeViewProps {
  vault: MasterVault;
  onNavigate: (tab: NavTabId) => void;
  onOpenAdvisor: (question?: string) => void;
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
  { id: 'profile', number: '01', title: 'Dodaj swoje fakty', description: 'Wgraj CV albo uzupełnij profil po swojemu. To jest Twoja baza, nie generator bajek.', action: 'Otwórz Profil', target: 'profil', icon: FileText },
  { id: 'match', number: '02', title: 'Wklej ogłoszenie', description: 'Porównaj ofertę z tym, co naprawdę masz w CV. Luki są informacją, nie powodem do dopisywania fikcji.', action: 'Sprawdź dopasowanie', target: 'aplikuj', icon: FileSearch },
  { id: 'send', number: '03', title: 'Przygotuj wersję do wysłania', description: 'Wybierz prosty dokument, obejrzyj go przed eksportem i zapisz aplikację, gdy faktycznie ją wyślesz.', action: 'Zobacz generator CV', target: 'profil', icon: Send },
];

const FEATURES: Array<{
  title: string;
  description: string;
  action: string;
  target: NavTabId;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { title: 'Jedno CV, wiele ofert', description: 'Master Vault trzyma Twoje potwierdzone doświadczenie, a nie kolekcję plików „final_final2”.', action: 'Poznaj Profil', target: 'profil', icon: FolderCheck },
  { title: 'Własny audyt, bez magii', description: 'Sprawdza układ, nagłówki, tabele, znaki i dopasowanie słów. To wskazówka techniczna, nie decyzja rekrutera.', action: 'Otwórz Audyt ATS', target: 'ats-lab', icon: ScanSearch },
  { title: 'Aplikacje w jednym miejscu', description: 'Zapisuj te CV, które rzeczywiście wysłałeś, z liczbą wersji i etapem. Bez wymyślonych rozmów i statusów.', action: 'Zobacz moje aplikacje', target: 'pipeline', icon: BriefcaseBusiness },
];

export const HomeView: React.FC<HomeViewProps> = ({ vault, onNavigate, onOpenAdvisor, actionSlot, questionsSlot }) => {
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
            <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-fg"><Heart className="h-3.5 w-3.5" aria-hidden="true" />CV bez zadęcia. I bez bajek.</p>
            <h1 className="max-w-xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-5xl">Wiesz, co umiesz. <span className="text-brand-fg">Pomóżmy to dobrze pokazać.</span></h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted sm:text-base">Kierivo porządkuje Twoje prawdziwe doświadczenie, porównuje CV z ofertą i pomaga przygotować spokojną, czytelną wersję do wysłania. Bez obiecywania pracy za trzy kliknięcia :)</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={() => onNavigate(hasStarted ? 'aplikuj' : 'profil')} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-on-brand shadow-raised transition-transform hover:scale-[1.02] hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{hasStarted ? 'Sprawdź ofertę' : 'Dodaj swoje CV'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
              <button type="button" onClick={() => onNavigate('porady')} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><Sparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />Zobacz, jak to działa</button>
            </div>
            <p className="mt-4 text-[11px] text-subtle">Konto jest opcjonalne. Przydaje się dopiero, gdy chcesz synchronizować dane między urządzeniami.</p>
          </div>
          <div className="min-h-64 border-t border-line bg-sunken lg:min-h-full lg:border-l lg:border-t-0"><img src="/home/hero-candidate.png" alt="Osoba przygotowująca CV przy biurku" className="h-full min-h-64 w-full object-cover" /></div>
        </div>
      </section>

      {(actionSlot || questionsSlot) && <section className="space-y-4" aria-label="Twój następny krok">{actionSlot}{questionsSlot}</section>}

      <section aria-labelledby="how-it-works">
        <div className="mb-5 max-w-2xl"><p className="text-label font-bold uppercase tracking-[0.14em] text-brand-fg">Bez instrukcji obsługi wielkości encyklopedii</p><h2 id="how-it-works" className="mt-2 text-2xl font-extrabold tracking-tight text-ink">Trzy ruchy i masz kontrolę nad swoim CV.</h2></div>
        <div className="grid gap-3 md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return <motion.button key={step.id} type="button" whileHover={{ y: -2 }} onClick={() => onNavigate(step.target)} className="group cursor-pointer rounded-2xl border border-line bg-surface p-5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <div className="flex items-center justify-between"><span className="font-mono text-xs font-bold text-brand-fg">{step.number}</span><Icon className="h-5 w-5 text-muted transition-transform group-hover:scale-110 group-hover:text-brand-600" aria-hidden="true" /></div>
              <h3 className="mt-7 text-base font-bold text-ink">{step.title}</h3><p className="mt-2 min-h-14 text-xs leading-relaxed text-muted">{step.description}</p><span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-brand-fg">{step.action}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
            </motion.button>;
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-sunken p-5 sm:p-8" aria-labelledby="why-kierivo">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="max-w-2xl"><p className="text-label font-bold uppercase tracking-[0.14em] text-brand-fg">Po co to wszystko?</p><h2 id="why-kierivo" className="mt-2 text-2xl font-extrabold tracking-tight text-ink">Żeby mniej zgadywać, a więcej pokazać.</h2><p className="mt-2 text-sm leading-relaxed text-muted">Nie zastępujemy rekrutera, nie wysyłamy aplikacji za Ciebie i nie wpisujemy cudzych umiejętności. Dajemy Ci lepszy porządek, kontekst i chwilę oddechu przed kliknięciem „wyślij”.</p></div><button type="button" onClick={() => onOpenAdvisor()} className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><WandSparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />Pytania? Otwórz FAQ Doradcy</button></div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return <button key={feature.title} type="button" onClick={() => onNavigate(feature.target)} className="rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><Icon className="h-5 w-5 text-brand-600" aria-hidden="true" /><h3 className="mt-4 text-sm font-bold text-ink">{feature.title}</h3><p className="mt-1.5 text-xs leading-relaxed text-muted">{feature.description}</p><span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-fg">{feature.action}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span></button>;
          })}
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
