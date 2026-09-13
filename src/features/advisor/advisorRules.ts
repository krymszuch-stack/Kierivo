export interface AdvisorRuleReply {
  text: string;
  topic: string;
}

interface AdvisorRule {
  topic: string;
  matches: (query: string) => boolean;
  text: string;
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function hasAny(value: string, phrases: string[]): boolean {
  return phrases.some((phrase) => value.includes(phrase));
}

const RULES: AdvisorRule[] = [
  {
    topic: 'metoda STAR',
    matches: (q) => hasAny(q, ['star', 'rozmow', 'interview']),
    text: 'Do rozmowy wybierz jedną prawdziwą sytuację i opowiedz ją w kolejności: sytuacja → Twoje zadanie → Twoje działanie → rezultat. Przygotuj też dowód lub szczegół, o który rekruter może dopytać. Metrykę podawaj tylko wtedy, gdy umiesz wyjaśnić, skąd ją znasz.',
  },
  {
    topic: 'czytelność dla parserów',
    matches: (q) => hasAny(q, ['ats', 'parser', 'pdf', 'kolumn', 'tabel', 'formatowan']),
    text: 'Najbezpieczniejszy technicznie wybór to jednokolumnowe CV ze zwykłą warstwą tekstową, prostymi nagłówkami sekcji i bez informacji ukrytych wyłącznie w grafice. To zwiększa szansę poprawnego odczytu, ale nie jest testem ani gwarancją działania konkretnego zewnętrznego ATS.',
  },
  {
    topic: 'słowa kluczowe',
    matches: (q) => hasAny(q, ['slowa kluczowe', 'slow klucz', 'keyword', 'upych', 'frazy z ogloszenia']),
    text: 'Weź wymagania z ogłoszenia i przypisz je tylko do miejsc, w których naprawdę ich używałeś: doświadczenia, projektu, kursu albo umiejętności. Zamiast listy powtórzeń dodaj kontekst: „obsługa zgłoszeń w [narzędziu]” jest czytelniejsza niż samo „[narzędzie]” pięć razy.',
  },
  {
    topic: 'podsumowanie zawodowe',
    matches: (q) => hasAny(q, ['podsumowan', 'o mnie', 'profil zawod', 'profil cv']),
    text: 'Podsumowanie CV wystarczą 2–3 zdania: kierunek zawodowy, najistotniejsze realne doświadczenie lub kompetencje oraz rodzaj roli, której szukasz. Omiń cechy bez dowodu typu „ambitny” — lepiej nazwać konkretny obszar pracy i to, co umiesz w nim zrobić.',
  },
  {
    topic: 'osiągnięcia',
    matches: (q) => hasAny(q, ['osiagnie', 'sukces', 'metryk', 'liczb', 'rezultat', 'wynik']),
    text: 'Opis osiągnięcia powinien rozdzielać Twoje działanie od wyniku zespołu. Zacznij od czasownika, dodaj kontekst i rezultat: „Usprawniłem [proces] przez [działanie], co dało [sprawdzalny efekt]”. Jeśli nie masz liczby, opisz zmianę jakościową bez dopowiadania skali.',
  },
  {
    topic: 'doświadczenie',
    matches: (q) => hasAny(q, ['doswiadczen', 'obowiazk', 'stanowisk', 'projekt']),
    text: 'Przy każdym stanowisku wybierz 3–5 punktów, które są najbliżej ogłoszenia. Każdy punkt niech mówi, co robiłeś, w jakim kontekście i czym się posługiwałeś. Nie rozciągaj zakresu odpowiedzialności ponad to, co faktycznie należało do Twojej roli.',
  },
  {
    topic: 'zmiana branży lub luka',
    matches: (q) => hasAny(q, ['zmian', 'przebran', 'luka', 'przerwa', 'bez doswiadczenia', 'junior']),
    text: 'Przy zmianie kierunku nie udawaj pełnego doświadczenia. Wyciągnij kompetencje przenoszalne z poprzedniej pracy, pokaż konkretną naukę lub projekt i nazwij poziom uczciwie. Lukę najlepiej opisać krótko tylko wtedy, gdy wyjaśnia chronologię; szczegóły zostaw na rozmowę.',
  },
  {
    topic: 'umiejętności',
    matches: (q) => hasAny(q, ['umiejetn', 'kompetenc', 'technolog', 'narzedzi']),
    text: 'Podziel umiejętności na te używane bezpośrednio w pracy oraz pokrewne. Usuń pozycje, których nie umiesz omówić na rozmowie. Przy ważnym narzędziu dodaj dowód użycia w doświadczeniu lub projekcie — sama lista nie mówi rekruterowi, na jakim jesteś poziomie.',
  },
  {
    topic: 'zdjęcie i wygląd',
    matches: (q) => hasAny(q, ['zdjec', 'fotograf', 'wyglad', 'design', 'ladne cv']),
    text: 'Zdjęcie jest opcjonalne i nie poprawia technicznego odczytu CV. Jeśli je dodajesz, wybierz aktualny, prosty portret z neutralnym tłem. Dla maksymalnej czytelności zacznij od wariantu ATS-friendly; ozdobny układ traktuj jako świadomy kompromis estetyczny, nie jako lepszy wynik ATS.',
  },
  {
    topic: 'edukacja i kursy',
    matches: (q) => hasAny(q, ['edukac', 'studia', 'kurs', 'certyfikat', 'szkolen']),
    text: 'Edukację i kursy zostaw, gdy pomagają wyjaśnić kierunek lub wymaganie z ogłoszenia. Przy certyfikacie podaj prawdziwą nazwę, organizatora i rok, jeśli go pamiętasz. Nie wpisuj kursu jako kompetencji, dopóki nie potrafisz pokazać, co po nim praktycznie umiesz.',
  },
  {
    topic: 'list motywacyjny',
    matches: (q) => hasAny(q, ['list motyw', 'cover letter', 'wiadomosc do rekrutera']),
    text: 'Krótka wiadomość do rekrutera może mieć trzy części: dlaczego ta rola, jeden lub dwa fakty z Twojego doświadczenia pasujące do oferty oraz prośbę o rozmowę. Nie powtarzaj całego CV i nie deklaruj motywacji, której nie czujesz — konkret brzmi lepiej niż formuła.',
  },
  {
    topic: 'dane kontaktowe i języki',
    matches: (q) => hasAny(q, ['kontakt', 'telefon', 'email', 'rodo', 'jezyk', 'angielsk']),
    text: 'W danych kontaktowych wystarczą imię i nazwisko, e-mail, telefon oraz lokalizacja w zakresie, który chcesz ujawnić. Język opisz poziomem, który potwierdzisz w praktyce. Nie podawaj nadmiarowych danych osobowych tylko dlatego, że pojawiają się w starych wzorach CV.',
  },
  {
    topic: 'rola senior',
    matches: (q) => hasAny(q, ['senior', 'lider', 'lead', 'mentoring']),
    text: 'Przy roli Senior pokaż wyłącznie rzeczywisty zakres: samodzielne decyzje, odpowiedzialność za wynik, współpracę lub mentoring — jeśli rzeczywiście je wykonywałeś. Nie zamieniaj stażu na „seniority”; ważniejszy jest konkretny wpływ i umiejętność obrony przykładów na rozmowie.',
  },
];

export function getRuleBasedReply(query: string, context?: AdvisorContext): AdvisorRuleReply {
  const contextual = context ? buildContextualAdvice(query, context) : null;
  if (contextual) return { topic: 'aktualna analiza CV', text: contextual };
  const normalized = normalize(query);
  const rule = RULES.find((candidate) => candidate.matches(normalized));

  if (rule) return { topic: rule.topic, text: rule.text };

  const question = query.trim().replace(/\s+/g, ' ').slice(0, 120);
  return {
    topic: 'brak reguły dla pytania',
    text: `Nie mam gotowej reguły, która uczciwie odpowie na: „${question}${query.trim().length > question.length ? '…' : ''}”. Gdy lokalna Ollama nie działa, nie będę udawać odpowiedzi AI. Możesz przeformułować pytanie wokół konkretnego elementu CV (np. doświadczenia, umiejętności, ATS, luki, rozmowy lub listu motywacyjnego) albo uruchomić lokalną asystę Ollama.`,
  };
}
import type { AdvisorContext } from './advisorContext';
import { buildContextualAdvice } from './advisorContext';
