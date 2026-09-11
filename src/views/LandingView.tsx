import React from 'react';
import { ArrowRight, CheckCircle2, Cloud, FileSearch, FlaskConical, ShieldCheck } from 'lucide-react';
import { NavTabId } from '../lib/navigation';
import { FREE_BETA_LABEL, FREE_BETA_PRICE_PLN } from '../lib/beta';

interface LandingViewProps {
  onNavigate: (tab: NavTabId) => void;
  /** Realne narzędzie QuickAtsCheck, a nie makieta marketingowa. */
  atsSlot: React.ReactNode;
}

const ATS_ANCHOR = 'sprawdz-cv';
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26440]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F19]';
const SURFACE = 'rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl';

const betaCapabilities = [
  {
    title: 'Profil i dokument',
    body: 'Budujesz Master Vault, wklejasz albo importujesz CV w ramach limitu i przygotowujesz dokument z własnych danych.',
  },
  {
    title: 'Audyt CVelocity',
    body: 'Dostajesz własny wynik CVelocity oraz rozbicie na pokrycie fraz, umiejętności, strukturę i formatowanie.',
  },
  {
    title: 'Oferta i pipeline',
    body: 'Dopasowujesz CV do konkretnego ogłoszenia, zapisujesz aplikację i śledzisz jej status.',
  },
  {
    title: 'Tryb lokalny lub konto',
    body: 'Bez konta dane robocze zostają w tej przeglądarce. Konto chmurowe jest opcjonalne tam, gdzie Supabase jest skonfigurowany.',
  },
];

export const LandingView: React.FC<LandingViewProps> = ({ onNavigate, atsSlot }) => {
  const scrollToAts = () => {
    document.getElementById(ATS_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-16 pb-10" data-testid="beta-landing">
      <section className="pt-6">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#F26440]/50 to-transparent" />
        <div className="grid gap-10 pt-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-lg border border-[#F26440]/40 bg-[#F26440]/10 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#F6A18C]">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              {FREE_BETA_LABEL} · {FREE_BETA_PRICE_PLN} zł
            </span>
            <h1 className="mt-6 max-w-[19ch] text-balance text-[2.3rem] font-bold leading-none tracking-tight text-slate-50 sm:text-5xl lg:text-6xl">
              Sprawdź CV bez udawania zewnętrznego ATS.
            </h1>
            <p className="mt-6 max-w-[52ch] text-pretty text-base leading-relaxed text-slate-400 sm:text-lg">
              CVelocity mierzy cechy Twojego dokumentu i dopasowanie do ogłoszenia własnymi regułami.
              Wynik nie pochodzi z systemu rekrutacyjnego pracodawcy i nie jest gwarancją rozmowy ani zatrudnienia.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={scrollToAts}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#F26440] px-5 py-3 text-sm font-bold text-white shadow-[0_0_25px_rgba(242,100,64,0.35)] hover:bg-[#F26440]/90 ${FOCUS_RING}`}
              >
                Sprawdź CV za darmo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('pricing')}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-3 text-sm font-bold text-slate-200 hover:border-slate-600 ${FOCUS_RING}`}
              >
                Zobacz zakres bety
              </button>
            </div>

            <p className="mt-4 max-w-[48ch] font-mono text-[11px] leading-relaxed text-slate-500">
              Bez karty i bez aktywnych zakupów. Limity funkcji AI nadal egzekwuje serwer.
            </p>
          </div>

          <aside className={`${SURFACE} p-6`} aria-label="Najważniejsze zasady bety">
            <div className="flex items-center gap-2 text-slate-100">
              <ShieldCheck className="h-5 w-5 text-[#F26440]" aria-hidden="true" />
              <h2 className="font-bold">Co tester powinien wiedzieć</h2>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-slate-300">
              {[
                'Cena bety: 0 zł.',
                'Nie ma checkoutu, triala ani zakupu Karnetu.',
                'Po limicie importu pliku można wkleić tekst CV.',
                'Funkcje poza zakresem są oznaczone jako niedostępne.',
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section id={ATS_ANCHOR} className="scroll-mt-24">
        <div className="mb-5">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F26440]">Realne narzędzie</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-50">Zacznij od szybkiego sprawdzenia</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            To wynik modelu CVelocity. Pokazuje sygnały w dokumencie, nie decyzję konkretnego ATS ani rekrutera.
          </p>
        </div>
        {atsSlot}
      </section>

      <section>
        <div className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-[#F26440]" aria-hidden="true" />
          <h2 className="text-2xl font-bold text-slate-50">Co działa w bezpłatnej becie</h2>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {betaCapabilities.map((item) => (
            <div key={item.title} className={`${SURFACE} p-5`}>
              <h3 className="font-bold text-slate-100">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={`${SURFACE} p-6`}>
          <div className="flex items-center gap-2 text-slate-100">
            <Cloud className="h-5 w-5 text-[#F26440]" aria-hidden="true" />
            <h2 className="font-bold">Lokalnie a chmura</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            W trybie lokalnym dane profilu są przechowywane w pamięci tej przeglądarki. Po świadomym
            użyciu konta chmurowego CVelocity synchronizuje vault z Supabase. Nie opisujemy więc całego
            produktu jako „100% client-side”.
          </p>
        </div>

        <div className={`${SURFACE} p-6`}>
          <h2 className="font-bold text-slate-100">Doradca w tej becie</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Doradca jest regułowy i lokalny. Otrzymuje tylko pytanie wpisane przez użytkownika albo
            wybrany szybki prompt. Nie czyta automatycznie Master Vaultu ani zapisanych aplikacji i nie
            wysyła rozmowy do modelu AI.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
        <h2 className="font-bold text-amber-200">Poza zakresem obecnej bety</h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-100/80">
          Aktywna sprzedaż Pro, płatne szablony, Karnet Aplikacyjny i zakup Telepromptera są wyłączone.
          Nie ma obejścia przez „demo checkout”. Jeśli funkcja wymaga dawnego płatnego uprawnienia,
          nowy tester zobaczy informację o niedostępności zamiast wezwania do zapłaty.
        </p>
      </section>
    </div>
  );
};
