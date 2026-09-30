import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  CheckCircle2,
  XCircle,
  Copy,
  Plus,
  Wrench,
  Code2,
  Package,
  Briefcase,
  TrendingUp,
  Sparkles,
  HeartPulse,
  Globe,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../store/useToastStore';
import { starTemplateForExample, starTemplateForVerb } from './starTemplate';

export interface StarVerb {
  verb: string;
  industry: 'medical' | 'tech' | 'logistics' | 'mgmt' | 'sales' | 'it' | 'general';
  category: string;
  exampleSnippet: string;
}

export interface StarExample {
  title: string;
  industry: 'medical' | 'tech' | 'logistics' | 'mgmt' | 'sales' | 'it' | 'general';
  bad: string;
  good: string;
  breakdown: {
    action: string;
    tool: string;
    result: string;
  };
}

const STAR_VERBS: StarVerb[] = [
  // Medycyna & Zdrowie & Opieka
  {
    verb: 'Przeprowadziłem procedury diagnostyczne',
    industry: 'medical',
    category: 'Diagnostyka & Leczenie',
    exampleSnippet: 'Przeprowadziłem 200+ procedur diagnostycznych na oddziale, skracając czas oczekiwania pacjentów o 25% przy 100% zgodności z procedurami NFZ.',
  },
  {
    verb: 'Wdrożyłem procedurę triage (segregacji)',
    industry: 'medical',
    category: 'Organizacja & Szpital',
    exampleSnippet: 'Wdrożyłem zmodernizowaną procedurę triage na SOR, co skróciło czas pierwszego kontaktu z personelem o 15 minut.',
  },
  {
    verb: 'Zabezpieczyłem i ustabilizowałem stan',
    industry: 'medical',
    category: 'Ratownictwo & Ostry dyżur',
    exampleSnippet: 'Zabezpieczyłem parametry życiowe i przeprowadziłem 40+ udanych interwencji w zespole ratownictwa medycznego.',
  },
  {
    verb: 'Nadzorowałem opiekę pooperacyjną',
    industry: 'medical',
    category: 'Pielęgniarstwo & Opieka',
    exampleSnippet: 'Nadzorowałem proces rekonwalescencji 150+ pacjentów po zabiegach chirurgicznych z wynikiem 0 zakażeń szpitalnych.',
  },
  {
    verb: 'Skoordynowałem dyżur medyczny',
    industry: 'medical',
    category: 'Zarządzanie personelem',
    exampleSnippet: 'Skoordynowałem pracę 8-osobowego zespołu pielęgniarskiego podczas dyżurów o wzmożonym ruchu na izbie przyjęć.',
  },

  // Techniczne / Monter / Spawacz / Utrzymanie Ruchu
  {
    verb: 'Zdiagnozowałem i usunąłem',
    industry: 'tech',
    category: 'Diagnostyka i serwis',
    exampleSnippet: 'Zdiagnozowałem i usunąłem 120+ awarii pieców kondensacyjnych Vaillant, uzyskując 98% napraw za 1. wizytą.',
  },
  {
    verb: 'Zmontowałem i podłączyłem',
    industry: 'tech',
    category: 'Montaż & Instalacje',
    exampleSnippet: 'Zmontowałem i podłączyłem rozdzielnice elektryczne 400V (SEP E+D) w 15 halach produkcyjnych.',
  },
  {
    verb: 'Wykonałem spawy w metodzie',
    industry: 'tech',
    category: 'Spawalnictwo (TIG/MIG/MAG)',
    exampleSnippet: 'Wykonałem spawy doczołowe rurociągów ciśnieniowych metodą TIG 141 (UDT) ze wskaźnikiem defektów rentgenowskich < 1.2%.',
  },
  {
    verb: 'Skróciłem czas przestoju linii',
    industry: 'tech',
    category: 'Utrzymanie ruchu',
    exampleSnippet: 'Skróciłem czas przestoju awaryjnego linii produkcyjnej o 30% dzięki wdrożeniu planu prewencyjnego TPM.',
  },
  {
    verb: 'Przeprowadziłem próby ciśnieniowe',
    industry: 'tech',
    category: 'Odbiory techniczne',
    exampleSnippet: 'Przeprowadziłem próby szczelności i ciśnieniowe 45 instalacji gazowych zakończone protokołem odbioru bez uwag.',
  },

  // Magazyn & Logistyka
  {
    verb: 'Zoptymalizowałem rozmieszczenie w WMS',
    industry: 'logistics',
    category: 'Gospodarka magazynowa',
    exampleSnippet: 'Zoptymalizowałem alokację strefy szybkiej rotacji w systemie SAP WMS, skracając ścieżkę kompletacji o 22%.',
  },
  {
    verb: 'Obsługiwałem wózek wysokiego składu',
    industry: 'logistics',
    category: 'Operacje wózkowe (UDT)',
    exampleSnippet: 'Obsługiwałem wózek wysokiego składu (UDT II WJO) osiągając średnio 45 pobrań/h przy 0 błędach kompletacji.',
  },
  {
    verb: 'Zredukowałem wskaźnik uszkodzeń towaru',
    industry: 'logistics',
    category: 'Jakość i BHP',
    exampleSnippet: 'Zredukowałem wskaźnik uszkodzeń paletowych o 40% poprzez standaryzację zabezpieczeń ładunku folią stretch.',
  },
  {
    verb: 'Skoordynowałem załadunek i odprawę',
    industry: 'logistics',
    category: 'Spedycja i transport',
    exampleSnippet: 'Skoordynowałem odprawę i załadunek 30+ zestawów TIR dziennie zgodnie z harmonogramem okien czasowych (Time Slot).',
  },

  // Zarządzanie, Biuro & Finanse
  {
    verb: 'Wynegocjowałem obniżenie cen',
    industry: 'mgmt',
    category: 'Zakupy & Finanse',
    exampleSnippet: 'Wynegocjowałem rabat 14% na kluczowe komponenty od dostawców, co przyniosło 180 000 zł rocznych oszczędności.',
  },
  {
    verb: 'Wdrożyłem elektroniczny obieg dokumentów',
    industry: 'mgmt',
    category: 'Optymalizacja procesów',
    exampleSnippet: 'Wdrożyłem system obiegu faktur i umów, skracając czas akceptacji z 7 dni do 24 godzin.',
  },
  {
    verb: 'Zreorganizowałem procedury i zadania',
    industry: 'mgmt',
    category: 'Operacje i organizacja',
    exampleSnippet: 'Zreorganizowałem strukturę raportowania w 10-osobowym dziale, eliminując 6 godzin zbędnych spotkań tygodniowo.',
  },

  // Sprzedaż & Obsługa Klienta
  {
    verb: 'Zwiększyłem konwersję sprzedażową',
    industry: 'sales',
    category: 'Sprzedaż B2B',
    exampleSnippet: 'Zrealizowałem 125% rocznego planu sprzedaży B2B, pozyskując 18 nowych klientów kluczowych.',
  },
  {
    verb: 'Podniosłem wskaźnik satysfakcji (CSAT)',
    industry: 'sales',
    category: 'Obsługa klienta',
    exampleSnippet: 'Podniosłem wskaźnik zadowolenia klientów (CSAT) z 82% do 96% poprzez wdrożenie procedury szybkiej reakcji do 15 minut.',
  },

  // IT & Software
  {
    verb: 'Zaprojektowałem i wdrożyłem',
    industry: 'it',
    category: 'Architektura & Rozwój',
    exampleSnippet: 'Zaprojektowałem i wdrożyłem architekturę mikroserwisów w Go i PostgreSQL obsługującą 50k req/min.',
  },
  {
    verb: 'Zoptymalizowałem zapytania i indeksy',
    industry: 'it',
    category: 'Bazy danych & Wydajność',
    exampleSnippet: 'Zoptymalizowałem zapytania SQL w bazie PostgreSQL, redukując średni czas odpowiedzi API z 450ms do 85ms.',
  },
  {
    verb: 'Zautomatyzowałem proces wdrożeń (CI/CD)',
    industry: 'it',
    category: 'DevOps & Automatyzacja',
    exampleSnippet: 'Zautomatyzowałem potok CI/CD w GitHub Actions, skracając czas wydania nowej wersji z 2 godzin do 8 minut.',
  },

  // Formuły Uniwersalne dla każdego stanowiska
  {
    verb: 'Zrealizowałem projekt w terminie i budżecie',
    industry: 'general',
    category: 'Uniwersalne formuły',
    exampleSnippet: 'Zrealizowałem kluczowy projekt wdrożeniowy 2 tygodnie przed terminem przy zachowaniu 100% założeń budżetowych.',
  },
  {
    verb: 'Zredukowałem czas realizacji zadań o',
    industry: 'general',
    category: 'Uniwersalne formuły',
    exampleSnippet: 'Zoptymalizowałem codzienny schemat pracy, redukując czas obsługi pojedynczego zlecenia o 30%.',
  },
  {
    verb: 'Osiągnąłem zerowy wskaźnik błędów / reklamacji',
    industry: 'general',
    category: 'Uniwersalne formuły',
    exampleSnippet: 'Obsłużyłem 300+ zadań bez ani jednej reklamacji jakościowej w całym kwartale.',
  },
];

const STAR_EXAMPLES: StarExample[] = [
  {
    title: 'Lekarz / Pielęgniarka / Ratownik Medyczny',
    industry: 'medical',
    bad: 'Obsługa pacjentów na oddziale, wykonywanie badań, wypisywanie recept i dyżury.',
    good: 'Przeprowadziłem 250+ procedur diagnostyczno-leczniczych, skracając czas oczekiwania pacjentów o 20% przy 100% zgodności ze standardami akredytacyjnymi NFZ.',
    breakdown: {
      action: 'Przeprowadziłem 250+ procedur diagnostycznych',
      tool: 'oddział szpitalny, procedury akredytacyjne NFZ',
      result: 'skrócenie czasu o 20%, 100% zgodności',
    },
  },
  {
    title: 'Monter / Serwisant instalacji grzewczych i gazowych',
    industry: 'tech',
    bad: 'Naprawa pieców gazowych i wykonywanie przeglądów rocznych u klientów.',
    good: 'Zdiagnozowałem i naprawiłem 150+ kotłów gazowych kondensacyjnych (Vaillant, Viessmann), uzyskując wskaźnik 96% napraw przy 1. wizycie i 0 reklamacji protokołów SEP/F-Gaz.',
    breakdown: {
      action: 'Zdiagnozowałem i naprawiłem 150+ kotłów',
      tool: 'kotły kondensacyjne Vaillant/Viessmann, uprawnienia SEP/F-Gaz',
      result: '96% First-Time Fix, 0 reklamacji protokołów',
    },
  },
  {
    title: 'Operator wózka widłowego / Magazynier',
    industry: 'logistics',
    bad: 'Rozładunek towaru, praca na magazynie wysokiego składu, skanowanie paczek.',
    good: 'Obsługiwałem wózek Reach Truck (UDT) w systemie SAP WMS, realizując średnio 50 pobrań palet/h przy wskaźniku bezbłędności 99.8%.',
    breakdown: {
      action: 'Obsługiwałem wózek Reach Truck (UDT)',
      tool: 'system SAP WMS, skaner radiowy',
      result: '50 pobrań/h, 99.8% dokładności kompletacji',
    },
  },
  {
    title: 'Doradca Klienta / Sprzedawca',
    industry: 'sales',
    bad: 'Obsługa klientów w salonie, doradzanie produktów, wystawianie faktur.',
    good: 'Wynegocjowałem i sfinalizowałem 45 umów handlowych, osiągając 120% realizacji planu sprzedaży kwartalnej ze wskaźnikiem zadowolenia klientów (CSAT) 97%.',
    breakdown: {
      action: 'Wynegocjowałem i sfinalizowałem 45 umów',
      tool: 'system CRM, standardy obsługi klienta',
      result: '120% planu sprzedaży, 97% CSAT',
    },
  },
  {
    title: 'Kierownik Zespołu / Koordynator Biurowy',
    industry: 'mgmt',
    bad: 'Zarządzanie pracownikami, delegowanie zadań i nadzór nad terminami.',
    good: 'Zreorganizowałem obieg zadań i dokumentów w 10-osobowym zespole, skracając średni czas realizacji zleceń z 5 dni do 48 godzin.',
    breakdown: {
      action: 'Zreorganizowałem obieg zadań i dokumentów',
      tool: 'narzędzia do zarządzania projektami, standaryzacja procedur',
      result: 'skrócenie czasu z 5 dni do 48h w 10-osobowym zespole',
    },
  },
  {
    title: 'Programista Frontend / Fullstack',
    industry: 'it',
    bad: 'Tworzenie komponentów w React i poprawianie błędów w aplikacji.',
    good: 'Zoptymalizowałem ładowanie kluczowych modułów aplikacji w React 19 / TypeScript, redukując wskaźnik LCP z 3.4s do 1.1s i podnosząc konwersję w koszyku o 8.5%.',
    breakdown: {
      action: 'Zoptymalizowałem ładowanie modułów',
      tool: 'React 19, TypeScript, Vite',
      result: 'LCP 3.4s -> 1.1s, +8.5% konwersji',
    },
  },
];

interface StarHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIndustry?: string;
  onApplySnippet?: (snippetText: string) => void;
}

export const StarHelperModal: React.FC<StarHelperModalProps> = ({
  isOpen,
  onClose,
  initialIndustry = 'all',
  onApplySnippet,
}) => {
  const [activeIndustry, setActiveIndustry] = useState<string>(initialIndustry);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'verbs' | 'examples'>('verbs');

  const [prevInitialIndustry, setPrevInitialIndustry] = useState(initialIndustry);
  if (initialIndustry !== prevInitialIndustry) {
    setPrevInitialIndustry(initialIndustry);
    if (initialIndustry && initialIndustry !== 'general') {
      setActiveIndustry(initialIndustry);
    }
  }

  const industries = [
    { id: 'all', label: 'Wszystkie branże', icon: Sparkles },
    { id: 'medical', label: 'Medycyna & Zdrowie', icon: HeartPulse },
    { id: 'tech', label: 'Techniczne & Produkcja', icon: Wrench },
    { id: 'logistics', label: 'Magazyn & Logistyka', icon: Package },
    { id: 'sales', label: 'Sprzedaż & Klient', icon: TrendingUp },
    { id: 'mgmt', label: 'Zarządzanie & Biuro', icon: Briefcase },
    { id: 'it', label: 'IT & Inżynieria', icon: Code2 },
    { id: 'general', label: 'Uniwersalne formuły', icon: Globe },
  ];

  const filteredVerbs = STAR_VERBS.filter((v) => {
    const matchesIndustry = activeIndustry === 'all' || v.industry === activeIndustry;
    const matchesSearch =
      v.verb.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.exampleSnippet.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesIndustry && matchesSearch;
  });

  const filteredExamples = STAR_EXAMPLES.filter((ex) => {
    const matchesIndustry = activeIndustry === 'all' || ex.industry === activeIndustry;
    const matchesSearch =
      ex.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.good.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesIndustry && matchesSearch;
  });

  const handleCopyOrInsert = (text: string) => {
    if (onApplySnippet) {
      onApplySnippet(text);
      onClose();
    } else {
      navigator.clipboard.writeText(text);
      showToast('Skopiowano do schowka', {
        message: 'Wklej wzorzec do pola osiągnięcia.',
        variant: 'success',
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Słowniczek STAR i Bank Czasowników Sprawczych"
      size="xl"
    >
      <div className="space-y-5 text-ink">
        <p className="rounded-xl border border-warning-500/30 bg-warning-500/5 p-3 text-xs text-muted">
          Poniższe zdania są fikcyjnymi przykładami. Liczby, narzędzia i uprawnienia nie pochodzą z Twojego profilu.
          Przyciski wstawiają wyłącznie szablon do uzupełnienia własnymi, sprawdzonymi danymi.
        </p>
        {/* Formuła STAR — prosty schemat */}
        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4">
          <div className="flex items-center gap-2 font-bold text-xs text-brand-fg uppercase tracking-wider mb-2">
            <BookOpen className="h-4 w-4" />
            Złota Formuła Osiągnięcia STAR (Dla każdego zawodu)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-xl border border-line bg-surface p-2.5">
              <span className="font-bold text-brand-600 block">1. Czasownik sprawczy</span>
              <p className="text-muted text-[11px] mt-0.5">
                Co dokładnie zrobiłeś (np. <em>Zdiagnozowałem, Wdrożyłem, Zmontowałem, Wynegocjowałem</em>).
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-2.5">
              <span className="font-bold text-brand-600 block">2. Środowisko / Metoda</span>
              <p className="text-muted text-[11px] mt-0.5">
                W jakim kontekście (np. <em>oddział NFZ, system WMS, uprawnienia SEP, CRM, projekt</em>).
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-2.5">
              <span className="font-bold text-brand-600 block">3. Twarda metryka / Rezultat</span>
              <p className="text-muted text-[11px] mt-0.5">
                Mierzalny efekt (np. <em>skrócenie czasu o 25%, 0 reklamacji, 200+ pacjentów/zleceń</em>).
              </p>
            </div>
          </div>
        </div>

        {/* Przełącznik Zakładek & Wyszukiwarka */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-sunken rounded-xl border border-line w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('verbs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'verbs'
                  ? 'bg-surface text-brand-600 shadow-xs font-bold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Bank Czasowników ({filteredVerbs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('examples')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'examples'
                  ? 'bg-surface text-brand-600 shadow-xs font-bold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Wzorce Przed / Po ({filteredExamples.length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj czasownika lub frazy..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-line bg-surface text-ink focus:border-brand-500 focus-visible:outline-none"
            />
          </div>
        </div>

        {/* Filtry Branżowe */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {industries.map((ind) => {
            const Icon = ind.icon;
            const isSelected = activeIndustry === ind.id;
            return (
              <button
                key={ind.id}
                type="button"
                onClick={() => setActiveIndustry(ind.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                  isSelected
                    ? 'border-brand-500 bg-brand-500/10 text-brand-600 font-bold'
                    : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{ind.label}</span>
              </button>
            );
          })}
        </div>

        {/* Lista Czasowników */}
        {activeTab === 'verbs' && (
          <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
            {filteredVerbs.length === 0 ? (
              <p className="text-center py-8 text-xs text-muted">
                Brak czasowników pasujących do filtra.
              </p>
            ) : (
              filteredVerbs.map((v, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-line bg-surface p-3 transition-colors hover:border-brand-500/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-ink font-mono">{v.verb}</span>
                    <span className="rounded-md bg-sunken px-2 py-0.5 text-[10px] font-semibold text-muted border border-line">
                      {v.category}
                    </span>
                  </div>

                  <p className="text-xs text-muted leading-relaxed italic bg-sunken/40 rounded-lg p-2 border border-line/40">
                    &bdquo;{v.exampleSnippet}&rdquo;
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Copy}
                      onClick={() => handleCopyOrInsert(starTemplateForVerb(v.verb))}
                      className="text-[11px] h-7 px-2.5"
                    >
                      Kopiuj szablon
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                      onClick={() => handleCopyOrInsert(starTemplateForVerb(v.verb))}
                      className="text-[11px] h-7 px-2.5"
                    >
                      {onApplySnippet ? 'Wstaw do osiągnięcia' : 'Użyj wzorca'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Przykłady Przed / Po */}
        {activeTab === 'examples' && (
          <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
            {filteredExamples.length === 0 ? (
              <p className="text-center py-8 text-xs text-muted">
                Brak przykładów pasujących do filtra.
              </p>
            ) : (
              filteredExamples.map((ex, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-line bg-surface p-3.5 space-y-2.5"
                >
                  <div className="font-bold text-xs text-ink">{ex.title}</div>

                  {/* Przed i Po */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-danger-500/30 bg-danger-500/5 p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-danger-fg font-bold text-[11px]">
                        <XCircle className="h-3.5 w-3.5" />
                        Przed (Zwykły opis obowiązków):
                      </div>
                      <p className="text-muted text-[11px] line-through decoration-danger-500/50">
                        {ex.bad}
                      </p>
                    </div>

                    <div className="rounded-lg border border-success-500/30 bg-success-500/5 p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-success-fg font-bold text-[11px]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Po (Mocna formuła STAR):
                      </div>
                      <p className="text-ink font-medium text-[11px] leading-relaxed">
                        {ex.good}
                      </p>
                    </div>
                  </div>

                  {/* Rozbicie na składowe */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-muted border-t border-line/50">
                    <span className="font-bold text-brand-600">Akcja:</span> {ex.breakdown.action}
                    <span className="text-line-strong">•</span>
                    <span className="font-bold text-brand-600">Narzędzie/Środowisko:</span> {ex.breakdown.tool}
                    <span className="text-line-strong">•</span>
                    <span className="font-bold text-brand-600">Rezultat:</span> {ex.breakdown.result}
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                      onClick={() => handleCopyOrInsert(starTemplateForExample())}
                      className="text-[11px] h-7 px-2.5"
                    >
                      {onApplySnippet ? 'Wstaw ten wzorzec' : 'Skopiuj wzorzec'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
