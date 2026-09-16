/**
 * interviewCockpitEngine.ts
 *
 * Silnik edukacyjno-taktyczny modułu "Kokpit Rozmowy" (Interview Playbook).
 * Odpowiada za bazę skryptów negocjacyjnych, pytania Red Flags oraz stan
 * ukończenia materiałów treningowych.
 */

import { StorageKeys, readJson, writeJson } from './storage';

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
          script: '„Na bazie moich dotychczasowych wdrożeń, udokumentowanych metryk i obecnego poziomu rynkowego dla ról o tym profilu, celuję w przedział X - Y PLN (B2B/UoP). Dokładna kwota w tych widełkach zależy od stopnia samodzielności i wyzwań architektonicznych.”',
          rationale: 'Pokazuje pewność siebie i natychmiast wiąże wynagrodzenie z mierzalnymi wynikami.',
        },
      ],
      proTip: 'Nigdy nie tłumacz się ze swoich stawek. Wymień jedną kluczową metrykę biznesową tuż po podaniu widełek.',
    },
    {
      id: 'trap_leaving',
      topic: 'Powód zmiany pracy',
      recruiterQuestion: '„Dlaczego chcesz odejść z obecnej firmy?”',
      dangerReason: 'Nawet uzasadniona krytyka obecnego pracodawcy może zostać odebrana jako brak lojalności lub trudny charakter.',
      variants: [
        {
          title: 'Wariant A: Poszukiwanie nowej skali i wyzwań technologicznych',
          badge: 'Pro-rozwojowy',
          script: '„W mojej obecnej firmie zrealizowałem z sukcesem kluczowe cele — ustabilizowaliśmy system i wdrożyliśmy założoną architekturę. Czuję, że osiągnąłem sufit organizacyjny i szukam środowiska o większej skali wyzwań, gdzie moje doświadczenie przyniesie jeszcze większą dźwignię.”',
          rationale: 'Zamyka etap sukcesem i pozycjonuje kandydata jako osobę zorientowaną na rezultaty.',
        },
        {
          title: 'Wariant B: Zmiana wektora specjalizacji',
          badge: 'Ekspercki',
          script: '„W ostatnich projektach skupiałem się mocno na [obszar X], natomiast mój długofalowy cel to pogłębienie ekspertyzy w [obszar Y z oferty]. Państwa projekt idealnie wpisuje się w ten kierunek.”',
          rationale: 'Koncentruje narrację na dopasowaniu do konkretnej oferty, a nie na ucieczce z poprzedniego miejsca.',
        },
      ],
      proTip: 'Zachowaj proporcję: 20% czasu na szacunek dla poprzedniego miejsca, 80% na entuzjazm wobec nowej roli.',
    },
    {
      id: 'trap_weakness',
      topic: 'Największa słabość / porażka',
      recruiterQuestion: '„Opowiedz o swojej największej słabości lub błędzie, który popełniłeś.”',
      dangerReason: 'Odpowiedzi w stylu „jestem perfekcjonistą” brzmią nieszczerze, a podanie krytycznej wady bez systemu naprawczego rodzi obawy.',
      variants: [
        {
          title: 'Wariant A: Rzeczywista strefa rozwoju + Aktywny system zabezpieczeń',
          badge: 'Dojrzały inżyniersko',
          script: '„Dawniej miałem tendencję do zbyt głębokiej optymalizacji kodu przed weryfikacją na produkcji (premature optimization). Zauważyłem to podczas projektu X. Aby temu zapobiegać, wdrożyłem żelazną zasadę: najpierw pomiar metryką i działający MVP, a dopiero po zebraniu danych profilera — dedykowana optymalizacja.”',
          rationale: 'Ukazuje wysoką autorefleksję i inżynierskie podejście oparte na procedurach.',
        },
      ],
      proTip: 'Prawdziwa siła tkwi w schemacie: Fakt -> Wnioski -> Zautomatyzowany mechanizm obronny.',
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
      greenFlagAnswer: '„Mamy stały bufor 15-20% na dług techniczny w każdym sprincie oraz dedykowany backlog inżynierski.”',
      redFlagWarning: '„Nie mamy na to dedykowanego czasu, naprawiamy jak coś padnie” — zwiastuje frustrację i pracę po godzinach.',
    },
    {
      id: 'rf_deploy_frequency',
      category: 'DECISION_PROCESS',
      categoryLabel: 'Proces Wdrożeń & Autonomia',
      question: '„Ile średnio czasu upływa od zmergowania Pull Requesta do momentu pojawienia się zmian na produkcji?”',
      intentExplanation: 'Testuje dojrzałość CI/CD, kulturę testów automatycznych i poziom biurokracji wdrożeniowej.',
      greenFlagAnswer: '„Wdrażamy automatycznie po przejściu pipeline CI (kilka minut do kilku godzin), z mechanizmem feature flags i canaries.”',
      redFlagWarning: '„Mamy wdrożenia raz w miesiącu w weekend, wymagające akceptacji 4 komitetów” — powolny proces i wysokie ryzyko awarii.',
    },
    {
      id: 'rf_growth_reason',
      category: 'FINANCIAL_STABILITY',
      categoryLabel: 'Powód Rekrutacji & Stabilność',
      question: '„Z jakiego powodu otworzyła się ta rekrutacja — czy to rozbudowa zespołu pod nowy strumień, czy zastępstwo?”',
      intentExplanation: 'Odkrywa dynamikę zespołu, potencjalną rotację oraz to, czy rola ma jasno zdefiniowane cele.',
      greenFlagAnswer: '„Pozyskaliśmy nowy rynek/klienta i skalujemy zespół o 2 osoby z konkretnym roadmapem na 12 miesięcy.”',
      redFlagWarning: 'Unikanie odpowiedzi lub informacja, że poprzednie 2 osoby zrezygnowały po okresie próbnym.',
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
export function loadCockpitProgress(): CockpitProgressState {
  const parsed = readJson<Partial<CockpitProgressState> | null>(StorageKeys.cockpitProgress, null);
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
export function saveCockpitProgress(progress: CockpitProgressState): void {
  writeJson(StorageKeys.cockpitProgress, progress);
}

/** Oznacza materiał treningowy jako ukończony albo przywraca go do pracy. */
export function toggleLessonCompletion(lessonId: string): CockpitProgressState {
  const current = loadCockpitProgress();
  const exists = current.completedLessons.includes(lessonId);
  const updatedLessons = exists
    ? current.completedLessons.filter((id) => id !== lessonId)
    : [...current.completedLessons, lessonId];

  const updated: CockpitProgressState = {
    ...current,
    completedLessons: updatedLessons,
    lastPracticeDate: new Date().toISOString(),
  };

  saveCockpitProgress(updated);
  return updated;
}
