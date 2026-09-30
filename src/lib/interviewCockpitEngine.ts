/**
 * interviewCockpitEngine.ts
 *
 * Silnik edukacyjno-taktyczny modułu "Kokpit Rozmowy" (Interview Playbook).
 * Odpowiada za bazę skryptów negocjacyjnych, pytania Red Flags oraz stan
 * ukończenia materiałów treningowych.
 */

import { StorageKeys, profileDataKeyFor, readJson, writeJson } from './storage';

export type CockpitSectionId =
  | 'pitch'
  | 'ai_coach'
  | 'bridging'
  | 'traps'
  | 'questions'
  | 'tracker';

export interface TacticalVariant {
  title: string;
  badge: string;
  script: string;
  rationale: string;
}

export interface NegotiationTrapScript {
  id: string;
  topic: string;
  recruiterQuestion: string;
  dangerReason: string;
  variants: TacticalVariant[];
  proTip: string;
}

export interface RedFlagCategoryQuestion {
  id: string;
  category: 'TECH_DEBT' | 'CULTURE_TEAM' | 'DECISION_PROCESS' | 'FINANCIAL_STABILITY';
  categoryLabel: string;
  question: string;
  intentExplanation: string;
  greenFlagAnswer: string;
  redFlagWarning: string;
}

export interface CockpitProgressState {
  completedLessons: string[];
  lastPracticeDate?: string;
  notes: Record<string, string>;
}

const DEFAULT_PROGRESS: CockpitProgressState = {
  completedLessons: [],
  notes: {},
};

/**
 * Zwraca bazę skryptów na trudne pytania i pułapki rekrutacyjne
 */
export function getNegotiationTrapScripts(): NegotiationTrapScript[] {
  return [
    {
      id: 'trap_salary',
      topic: 'Oczekiwania finansowe',
      recruiterQuestion: '„Jakie są Twoje oczekiwania finansowe na tym stanowisku?”',
      dangerReason: 'Zbyt wczesne podanie sztywnej kwoty zamyka pole do negocjacji po wykazaniu unikalnej wartości w trakcie rozmów technicznych.',
      variants: [
        {
          title: 'Wariant A: Zwrot pytania o widełki budżetowe (Rekomendowany na start)',
          badge: 'Bezpieczny',
          script: '„Moje oczekiwania są elastyczne i zależą od pełnego zakresu odpowiedzialności oraz pakietu benefitów. Zanim przejdziemy do szczegółów finansowych, chętnie dowiem się, jaki przedział budżetowy Państwo przewidzieli dla tej roli?”',
          rationale: 'Pozwala poznać budżet pracodawcy bez ryzyka podania zbyt niskiej lub zaporowej kwoty.',
        },
        {
          title: 'Wariant B: Szerokie widełki rynkowe z uzasadnieniem',
          badge: 'Asertywny',
          script: '„Na podstawie [źródło sprawdzonych widełek] oraz zakresu tej roli celuję w [kwota lub przedział] [brutto na UoP / netto + VAT na B2B]. Ostateczna kwota zależy od pełnego zakresu odpowiedzialności i pakietu.”',
          rationale: 'Pomaga podać własne, sprawdzone oczekiwania. Uzupełnij pola przed użyciem i nie twierdź, że masz metryki lub doświadczenie, których nie możesz potwierdzić.',
        },
      ],
      proTip: 'Podaj tylko stawkę, którą rzeczywiście akceptujesz. Metrykę dodaj wyłącznie wtedy, gdy masz potwierdzony wynik i możesz go wyjaśnić.',
    },
    {
      id: 'trap_leaving',
      topic: 'Powód zmiany pracy',
      recruiterQuestion: '„Dlaczego chcesz odejść z obecnej firmy?”',
      dangerReason: 'Nawet uzasadniona krytyka obecnego pracodawcy może zostać odebrana jako brak lojalności lub trudny charakter.',
      variants: [
        {
          title: 'Wariant A: Rzeczywisty powód zmiany',
          badge: 'Pro-rozwojowy',
          script: '„Szukam zmiany, ponieważ [prawdziwy powód]. W obecnej lub ostatniej roli [konkretny fakt, który możesz potwierdzić]. Teraz chcę [rzeczywisty cel związany z tą ofertą].”',
          rationale: 'Pomaga krótko i rzeczowo wyjaśnić zmianę bez dopisywania osiągnięć ani krytykowania poprzedniego pracodawcy.',
        },
        {
          title: 'Wariant B: Planowany kierunek rozwoju',
          badge: 'Ekspercki',
          script: '„Do tej pory zajmowałem się [faktyczny obszar]. Chcę rozwijać się w kierunku [rzeczywisty cel]. W tej ofercie zainteresowało mnie [konkretny element ogłoszenia].”',
          rationale: 'Łączy doświadczenie i plan z konkretnym elementem oferty, jeśli rzeczywiście jest to Twój powód aplikacji.',
        },
      ],
      proTip: 'Odpowiedz krótko i zgodnie z prawdą. Nie musisz podawać proporcji ani krytykować poprzedniego pracodawcy.',
    },
    {
      id: 'trap_weakness',
      topic: 'Największa słabość / porażka',
      recruiterQuestion: '„Opowiedz o swojej największej słabości lub błędzie, który popełniłeś.”',
      dangerReason: 'Odpowiedzi w stylu „jestem perfekcjonistą” brzmią nieszczerze, a podanie krytycznej wady bez systemu naprawczego rodzi obawy.',
      variants: [
        {
          title: 'Wariant A: Rzeczywista strefa rozwoju + Aktywny system zabezpieczeń',
          badge: 'Konkretna autorefleksja',
          script: '„Obszarem, nad którym pracuję, jest [rzeczywista słabość lub błąd]. Zauważyłem to, gdy [konkretny przykład]. Od tego czasu [działanie, które faktycznie stosujesz]; zauważyłem, że [rzeczywisty skutek albo informacja, że jeszcze go oceniasz].”',
          rationale: 'Pozwala opisać prawdziwy przykład i sposób uczenia się. Wybierz doświadczenie, o którym możesz swobodnie opowiedzieć.',
        },
      ],
      proTip: 'Prawdziwy przykład jest ważniejszy od idealnie brzmiącego szablonu. Nie przypisuj sobie zachowań ani skutków, których nie było.',
    },
  ];
}

/**
 * Zwraca bazę pytań do rekrutera z analizą Red Flags
 */
export function getRedFlagQuestions(): RedFlagCategoryQuestion[] {
  return [
    {
      id: 'rf_tech_debt',
      category: 'TECH_DEBT',
      categoryLabel: 'Dług Technologiczny & Architektura',
      question: '„Jaki procent czasu w sprincie / kwartale zespół realnie przeznacza na refactoring i spłatę długu technicznego?”',
      intentExplanation: 'Pozwala zweryfikować, czy firma traktuje jakość kodu systemowo, czy tylko gasi pożary pod presją feature’ów.',
      greenFlagAnswer: 'Zespół potrafi opisać, jak zgłasza, ocenia i planuje prace nad długiem technicznym; właściwy proces zależy od produktu i ryzyka.',
      redFlagWarning: 'Brak jakiegokolwiek sposobu zgłaszania i omawiania znanych problemów może utrudniać pracę; dopytaj o przykład i wpływ na tę rolę.',
    },
    {
      id: 'rf_deploy_frequency',
      category: 'DECISION_PROCESS',
      categoryLabel: 'Proces Wdrożeń & Autonomia',
      question: '„Ile średnio czasu upływa od zmergowania Pull Requesta do momentu pojawienia się zmian na produkcji?”',
      intentExplanation: 'Testuje dojrzałość CI/CD, kulturę testów automatycznych i poziom biurokracji wdrożeniowej.',
      greenFlagAnswer: 'Rozmówca jasno opisuje testy, akceptacje i sposób wycofania zmian; częstotliwość wdrożeń zależy od produktu i wymogów bezpieczeństwa.',
      redFlagWarning: 'Niejasny proces albo brak kontroli zmian może utrudniać pracę; dopytaj o przyczynę, konsekwencje i to, jak dotyczy tej roli.',
    },
    {
      id: 'rf_growth_reason',
      category: 'FINANCIAL_STABILITY',
      categoryLabel: 'Powód Rekrutacji & Stabilność',
      question: '„Z jakiego powodu otworzyła się ta rekrutacja — czy to rozbudowa zespołu pod nowy strumień, czy zastępstwo?”',
      intentExplanation: 'Odkrywa dynamikę zespołu, potencjalną rotację oraz to, czy rola ma jasno zdefiniowane cele.',
      greenFlagAnswer: 'Rekruter potrafi wyjaśnić, czy chodzi o rozwój zespołu, czy zastępstwo, oraz jakie zadania czekają na nową osobę.',
      redFlagWarning: 'Unikanie odpowiedzi lub sprzeczne informacje warto doprecyzować; samo zastępstwo nie przesądza o problemie w zespole.',
    },
    {
      id: 'rf_team_conflict',
      category: 'CULTURE_TEAM',
      categoryLabel: 'Kultura & Rozstrzyganie Sporów',
      question: '„W jaki sposób zespół podejmuje kluczowe decyzje architektoniczne, gdy pojawiają się sprzeczne opinie?”',
      intentExplanation: 'Sprawdza, czy w organizacji panuje merytoryczna kultura RFC/ADR (Architecture Decision Records), czy rządy autorytetu.',
      greenFlagAnswer: '„Opieramy się na RFC, prototypowaniu (PoC) i danych pomiarowych. Każdy inżynier ma prawo głosu.”',
      redFlagWarning: '„Decyzje podejmuje jednoosobowo szef, nie ma czasu na dyskusje.”',
    },
  ];
}

/**
 * Wczytuje stan postępów kokpitu z LocalStorage
 */
export function loadCockpitProgress(profileId: string): CockpitProgressState {
  const parsed = readJson<Partial<CockpitProgressState> | null>(profileDataKeyFor(StorageKeys.cockpitProgress, profileId), null);
  if (!parsed) return { ...DEFAULT_PROGRESS };
  return {
    completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
    notes: typeof parsed.notes === 'object' && parsed.notes !== null ? parsed.notes : {},
    lastPracticeDate: parsed.lastPracticeDate,
  };
}

/**
 * Zapisuje stan postępów kokpitu do LocalStorage
 *
 * `writeJson` połyka wyjątki (tryb prywatny, przepełniony limit), więc utrata
 * zapisu nie wywraca interfejsu — to samo robił tu wcześniejszy własny try/catch.
 */
export function saveCockpitProgress(profileId: string, progress: CockpitProgressState): void {
  writeJson(profileDataKeyFor(StorageKeys.cockpitProgress, profileId), progress);
}

/** Oznacza materiał treningowy jako ukończony albo przywraca go do pracy. */
export function toggleLessonCompletion(profileId: string, lessonId: string): CockpitProgressState {
  const current = loadCockpitProgress(profileId);
  const exists = current.completedLessons.includes(lessonId);
  const updatedLessons = exists
    ? current.completedLessons.filter((id) => id !== lessonId)
    : [...current.completedLessons, lessonId];

  const updated: CockpitProgressState = {
    ...current,
    completedLessons: updatedLessons,
    lastPracticeDate: new Date().toISOString(),
  };

  saveCockpitProgress(profileId, updated);
  return updated;
}
