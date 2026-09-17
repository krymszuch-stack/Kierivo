import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { trackProductInsight } from '../lib/productInsights';

export interface Article {
  id: string;
  title: string;
  category: 'ats' | 'interview' | 'trades' | 'career';
  categoryLabel: string;
  readTime: string;
  snippet: string;
  imageSrc: string;
  badge?: string;
  content: {
    lead: string;
    sections: {
      heading: string;
      body: string;
      keyTakeaways?: string[];
    }[];
  };
}

const ARTICLES: Article[] = [
  {
    id: 'ats-optymalizacja-2026',
    title: 'CV czytelne dla parserów: struktura przed ozdobnikami',
    category: 'ats',
    categoryLabel: 'Filtry ATS & Algorytmy',
    readTime: '4 min czytania',
    badge: 'Kluczowe',
    imageSrc: '/blog/ats-structure.png',
    snippet: 'Praktyczna checklista: prosty układ, standardowe sekcje i słownictwo zgodne z Twoim prawdziwym doświadczeniem.',
    content: {
      lead: 'Różne systemy rekrutacyjne odczytują dokumenty inaczej. Nie ma uniwersalnej gwarancji przejścia, ale prosty, logiczny układ ogranicza ryzyko błędnego odczytu.',
      sections: [
        {
          heading: '1. Jednokolumnowy, czysty układ bez tabel i grafik',
          body: 'Standardowe nagłówki sekcji (Doświadczenie, Umiejętności, Edukacja) i jedna czytelna kolejność treści ułatwiają odczyt zarówno człowiekowi, jak i parserowi. Tabele, pola tekstowe oraz układ wielokolumnowy warto najpierw sprawdzić w Audycie ATS.',
          keyTakeaways: [
            'Używaj standardowych czcionek (Inter, Roboto, Arial)',
            'Formatuj daty w układzie MM/RRRR lub RRRR',
            'Zapisuj dokument w formacie PDF lub DOCX',
          ],
        },
        {
          heading: '2. Twarde dopasowanie terminologii z ogłoszenia',
          body: 'Jeśli oferta wymaga „Zarządzania magazynem w SAP WMS”, nie pisz jedynie „obsługa komputera w magazynie”. Użyj dokładnej nazwy technologii, uprawnienia lub certyfikatu tylko wtedy, gdy możesz go potwierdzić przykładem.',
        },
        {
          heading: '3. Formuła Osiągnięcia zamiast listy obowiązków',
          body: 'Punkt doświadczenia jest czytelniejszy, gdy mówi co zrobiłeś, w jakim kontekście i z jakim efektem. Liczba pomaga, ale nie jest obowiązkowa: gdy jej nie masz, opisz zakres odpowiedzialności lub konkretny rezultat jakościowy.',
        },
      ],
    },
  },
  {
    id: 'metoda-star-rozmowa',
    title: 'Metoda STAR na rozmowie rekrutacyjnej — Mów językiem faktów',
    category: 'interview',
    categoryLabel: 'Rozmowa Kwalifikacyjna',
    readTime: '5 min czytania',
    badge: 'Popularne',
    imageSrc: '/blog/interview-star.png',
    snippet: 'Jak odpowiadać na pytania behawioralne krótko, konkretnie i bez uczenia się sztucznego skryptu.',
    content: {
      lead: 'Gdy pada pytanie „opowiedz o sytuacji, gdy…”, STAR pomaga ułożyć odpowiedź w logiczną historię zamiast improwizować w stresie.',
      sections: [
        {
          heading: 'Struktura STAR krok po kroku',
          body: 'S (Situation) — krótkie tło; T (Task) — cel lub odpowiedzialność; A (Action) — konkretne działania podjęte przez Ciebie; R (Result) — rezultat, który potrafisz uczciwie opisać. Długość dopasuj do pytania i rozmowy.',
          keyTakeaways: [
            'Używaj formy pierwszej osoby („Wdrożyłem”, „Zoptymalizowałem”, a nie „Robiliśmy”)',
            'Podawaj konkretne wskaźniki: czas, koszty, spadek awaryjności, wolumen',
            'Przygotuj 3–4 uniwersalne historie pasujące do różnych pytań',
          ],
        },
        {
          heading: 'Unikanie pułapki generalizacji',
          body: 'Zamiast mówić „zawsze dbam o jakość”, opowiedz o konkretnym incydencie, w którym Twoja czujność zapobiegła przestojowi linii lub reklamacji klienta.',
        },
      ],
    },
  },
  {
    id: 'uprawnienia-knockout-monter-spawacz',
    title: 'Kryteria Knockout: SEP, UDT, F-Gaz i Prawo Jazdy',
    category: 'trades',
    categoryLabel: 'Prace Techniczne & Przemysł',
    readTime: '3 min czytania',
    imageSrc: '/blog/ats-structure.png',
    snippet: 'Jak jasno pokazać wymagane uprawnienia techniczne, bez sugerowania kwalifikacji, których nie masz.',
    content: {
      lead: 'W branży technicznej i logistycznej ogłoszenie często wymienia uprawnienia wymagane na danym stanowisku. Jasne wpisanie posiadanych kwalifikacji ułatwia ich rzetelne sprawdzenie.',
      sections: [
        {
          heading: 'Eksponuj uprawnienia na samej górze profilu',
          body: 'Umieść posiadane uprawnienia blisko umiejętności lub doświadczenia, podając ich faktyczną kategorię, zakres i — jeżeli ma znaczenie — datę ważności. Nie dopisuj numeru ani zakresu, którego nie możesz potwierdzić.',
          keyTakeaways: [
            'Podawaj dokładne kategorie i zakresy napięć / metod',
            'Wpisuj daty ważności lub adnotację o bezterminowości',
            'Wymieniaj markę i typ obsługiwanych urządzeń diagnostycznych',
          ],
        },
      ],
    },
  },
  {
    id: 'medycyna-rekrutacja-szpital',
    title: 'CV Medyczne: Lekarz, Pielęgniarka, Ratownik Medyczny',
    category: 'career',
    categoryLabel: 'Sektor Medyczny',
    readTime: '4 min czytania',
    imageSrc: '/blog/career-change.png',
    snippet: 'Jak strukturyzować doświadczenie kliniczne, staże specjalizacyjne, procedury zabiegowe i dyżury na SOR.',
    content: {
      lead: 'Aplikowanie do szpitali, klinik i centrów medycznych wymaga szczególnego nacisku na samodzielność zabiegową, liczbę wykonanych procedur oraz znajomość procedur NFZ/ISO.',
      sections: [
        {
          heading: 'Kluczowe elementy profilu medycznego',
          body: 'Wymień oddziały szpitalne, na których odbywałeś dyżury, znajomość systemów medycznych (np. Asseco AMMS, KS-SOMED) oraz procedury triage i certyfikaty ALS/BLS/PALS.',
          keyTakeaways: [
            'Wpisz numer prawa wykonywania zawodu (PWZ)',
            'Określ stopień zaawansowania specjalizacji klinicznej',
            'Podawaj szacunkowy wolumen przyjętych pacjentów i zabiegów',
          ],
        },
      ],
    },
  },
  {
    id: 'dopasowanie-bez-naginania-faktow',
    title: 'Dopasuj CV do oferty bez naginania faktów',
    category: 'ats',
    categoryLabel: 'Filtry ATS & Algorytmy',
    readTime: '4 min czytania',
    badge: 'Praktyczne',
    imageSrc: '/blog/ats-structure.png',
    snippet: 'Trzy przejścia przez ofertę: wymaganie, dowód w Twojej historii, decyzja „mam / uczę się / brak”.',
    content: {
      lead: 'Najskuteczniejsze dopasowanie nie polega na kopiowaniu słów z ogłoszenia. Polega na znalezieniu prawdziwego dowodu, który rekruter może zweryfikować.',
      sections: [
        {
          heading: 'Zrób mapę „wymaganie → dowód”',
          body: 'Dla każdego ważnego wymagania z oferty znajdź konkretny projekt, zadanie, narzędzie lub uprawnienie z własnej historii. Jeśli nie znajdujesz dowodu, oznacz lukę — nie zamieniaj jej w deklarację.',
          keyTakeaways: [
            'Wpisuj dokładną nazwę narzędzia tylko przy prawdziwym doświadczeniu',
            'Przenieś najlepszy dowód wyżej w opisie roli lub projektu',
            'Lukę możesz nazwać planem nauki, ale nie doświadczeniem',
          ],
        },
        {
          heading: 'Nie upychaj słów kluczowych',
          body: 'Długa lista technologii bez kontekstu nie mówi, gdzie i po co ich używałeś. Jeden konkretny punkt doświadczenia zwykle daje więcej niż powtórzenie tej samej frazy w kilku miejscach.',
        },
      ],
    },
  },
  {
    id: 'zmiana-branzy-most-kompetencji',
    title: 'Zmiana branży: pokaż most kompetencji, nie nową legendę',
    category: 'career',
    categoryLabel: 'Rozwój kariery',
    readTime: '5 min czytania',
    imageSrc: '/blog/career-change.png',
    snippet: 'Jak przełożyć realne doświadczenie z poprzedniej roli na język nowego stanowiska.',
    content: {
      lead: 'Przy zmianie branży nie musisz ukrywać przeszłości. Potrzebujesz pokazać, które zadania, narzędzia i efekty są użyteczne w nowej roli.',
      sections: [
        {
          heading: 'Nazwij kompetencję przez działanie',
          body: 'Zamiast pisać ogólnie „komunikatywność”, opisz sytuację: obsługa zgłoszeń, diagnozowanie problemu, szkolenie klienta, kontrola jakości albo prowadzenie dokumentacji. To są dowody przenoszalne między branżami.',
          keyTakeaways: [
            'Zostaw prawdziwą nazwę stanowiska',
            'Pod spodem użyj języka zbliżonego do nowej oferty, ale nie zmieniaj faktów',
            'Wskaż jedno uzupełnione szkolenie lub projekt, jeśli naprawdę go zrealizowałeś',
          ],
        },
        {
          heading: 'Napisz krótkie wyjaśnienie kierunku',
          body: 'Jedno zdanie w podsumowaniu wystarczy: co zmieniasz, jakie masz pokrewne doświadczenie i dlaczego właśnie ta rola. Rozbudowaną historię zostaw na rozmowę.',
        },
      ],
    },
  },
  {
    id: 'bank-historii-na-rozmowe',
    title: 'Bank historii przed rozmową: przygotuj 5 przykładów',
    category: 'interview',
    categoryLabel: 'Rozmowa Kwalifikacyjna',
    readTime: '4 min czytania',
    imageSrc: '/blog/interview-star.png',
    snippet: 'Zamiast kuć odpowiedzi słowo w słowo, przygotuj pięć prawdziwych historii, które da się dopasować do pytań.',
    content: {
      lead: 'Jedna historia o rozwiązaniu problemu, współpracy czy błędzie może odpowiedzieć na kilka różnych pytań — jeżeli pamiętasz fakty, a nie wyuczony monolog.',
      sections: [
        {
          heading: 'Wybierz pięć sytuacji',
          body: 'Dobry start to: rozwiązany problem, współpraca, trudny klient lub konflikt, usprawnienie oraz sytuacja, w której czegoś się nauczyłeś. Do każdej zapisz po jednym zdaniu dla S, T, A i R.',
          keyTakeaways: [
            'Mów o własnym działaniu, nawet gdy pracowałeś w zespole',
            'Jeśli nie masz liczby, podaj obserwowalny efekt',
            'Przećwicz głośno, ale zostaw sobie miejsce na naturalną rozmowę',
          ],
        },
        {
          heading: 'Dopasuj historię do pytania',
          body: 'Najpierw upewnij się, o co pyta rekruter. Możesz zrobić krótką pauzę, aby wybrać właściwy przykład. STAR jest szkieletem odpowiedzi, a nie obowiązkiem recytacji.',
        },
      ],
    },
  },
];

export const CareerTipsView: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const categories = [
    { id: 'all', label: 'Wszystkie porady' },
    { id: 'ats', label: 'Filtry ATS' },
    { id: 'interview', label: 'Rozmowa o pracę' },
    { id: 'trades', label: 'Techniczne & Przemysł' },
    { id: 'career', label: 'Medycyna & Branże' },
  ];

  const filteredArticles = ARTICLES.filter((art) => {
    const matchesCategory = activeCategory === 'all' || art.category === activeCategory;
    const matchesSearch =
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <PageHeader
        title="Baza Wiedzy i Poradnik Kariery"
        description="Merytoryczne artykuły, wzorce odpowiedzi i strategie pokonywania filtrów ATS przygotowane przez ekspertów rekrutacji."
        badge="Wiedza & SEO"
      />

      {/* Jeśli czytamy konkretny artykuł */}
      {selectedArticle ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedArticle(null)}
            className="text-brand-fg mb-2"
          >
            &larr; Wróć do listy poradników
          </Button>

          <article className="rounded-3xl border border-line bg-surface p-6 sm:p-10 shadow-floating space-y-6">
            <img
              src={selectedArticle.imageSrc}
              alt=""
              className="h-44 w-full rounded-2xl border border-line object-cover sm:h-64"
            />
            <div className="space-y-3 border-b border-line/60 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-brand-500/10 text-brand-600 px-2.5 py-0.5 text-xs font-bold font-mono">
                  {selectedArticle.categoryLabel}
                </span>
                <span className="flex items-center gap-1 text-muted text-xs font-mono">
                  <Clock className="h-3.5 w-3.5" />
                  {selectedArticle.readTime}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-ink tracking-tight leading-tight">
                {selectedArticle.title}
              </h1>

              <p className="text-sm sm:text-base text-muted leading-relaxed font-medium">
                {selectedArticle.content.lead}
              </p>
            </div>

            {/* Treść artykułu */}
            <div className="space-y-8 text-ink text-sm sm:text-base leading-relaxed">
              {selectedArticle.content.sections.map((sec, idx) => (
                <div key={idx} className="space-y-3">
                  <h2 className="text-lg sm:text-xl font-bold text-ink flex items-center gap-2">
                    <span className="text-brand-600">#</span> {sec.heading}
                  </h2>
                  <p className="text-muted leading-relaxed">{sec.body}</p>

                  {sec.keyTakeaways && sec.keyTakeaways.length > 0 && (
                    <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 space-y-2 mt-3">
                      <div className="font-bold text-xs text-brand-fg uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-success-fg" />
                        Kluczowe wskazówki:
                      </div>
                      <ul className="space-y-1.5 pl-2 text-xs sm:text-sm text-ink">
                        {sec.keyTakeaways.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-brand-600 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-line/60 flex items-center justify-between">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedArticle(null)}
              >
                &larr; Wróć do bazy artykułów
              </Button>
            </div>
          </article>
        </motion.div>
      ) : (
        /* Lista artykułów */
        <div className="space-y-6">
          {/* Wyszukiwarka i filtry */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
               {categories.map((c) => (
                 <button
                   key={c.id}
                   type="button"
                   onClick={() => setActiveCategory(c.id)}
                   className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border ${
                     activeCategory === c.id
                       ? 'border-brand-500 bg-brand-500/10 text-brand-600 font-bold'
                       : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'
                   }`}
                 >
                   {c.label}
                 </button>
               ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj tematu poradnika..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-line bg-surface text-ink focus:border-brand-500 focus-visible:outline-none"
              />
            </div>
          </div>

          {/* Siatka artykułów */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map((art) => (
               <motion.div
                 key={art.id}
                 whileHover={{ y: -3 }}
                 transition={{ duration: 0.15 }}
                 role="button"
                 tabIndex={0}
                 onClick={() => {
                   trackProductInsight('career_article_opened');
                   setSelectedArticle(art);
                 }}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' || e.key === ' ') {
                     e.preventDefault();
                     trackProductInsight('career_article_opened');
                     setSelectedArticle(art);
                   }
                 }}
                 className="rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col justify-between hover:border-brand-500/40 cursor-pointer transition-colors"
               >
                <div className="space-y-3">
                  <img
                    src={art.imageSrc}
                    alt=""
                    className="h-32 w-full rounded-xl border border-line object-cover"
                    loading="lazy"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-brand-500/10 text-brand-600 px-2 py-0.5 text-[10px] font-bold font-mono">
                      {art.categoryLabel}
                    </span>
                    <span className="flex items-center gap-1 text-muted text-[11px] font-mono">
                      <Clock className="h-3 w-3" />
                      {art.readTime}
                    </span>
                  </div>

                   <h3 className="font-bold text-base text-ink leading-snug group-hover:text-brand-fg transition-colors">
                     {art.title}
                   </h3>

                   <p className="text-xs text-muted leading-relaxed line-clamp-3">
                     {art.snippet}
                   </p>
                 </div>

                 <div className="pt-4 flex items-center justify-between text-xs font-semibold text-brand-fg mt-2 border-t border-line/40">
                   <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     className="cursor-pointer text-brand-fg hover:underline"
                     onClick={() => {
                       trackProductInsight('career_article_opened');
                       setSelectedArticle(art);
                     }}
                   >
                     Czytaj artykuł <ChevronRight className="ml-1 h-3 w-3" />
                   </Button>
                 </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
