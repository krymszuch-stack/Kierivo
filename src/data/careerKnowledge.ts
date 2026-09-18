/**
 * Baza Wiedzy i Poradnik Kariery — rzetelne źródła, ścieżki zawodowe i materiały edukacyjne.
 *
 * Plik definiuje modele oraz ustrukturyzowane materiały dla osób bezrobotnych,
 * szukających kierunku lub planujących przebranżowienie.
 *
 * Stała struktura 9 punktów w każdym materiale:
 * 1. Dla kogo jest ten materiał
 * 2. Czego można się nauczyć
 * 3. Jakie wymagania pojawiają się najczęściej
 * 4. Gdzie można zdobyć wiedzę lub kwalifikację
 * 5. Ile czasu i zaangażowania może wymagać nauka
 * 6. Jak sprawdzić jakość kursu, szkoły albo organizatora
 * 7. Jakie stanowiska można rozważyć po drodze
 * 8. Jak przygotować CV pod ten kierunek
 * 9. Jaki jest jeden konkretny następny krok
 */

export type KnowledgeCategory =
  | 'all'
  | 'cv'
  | 'interview'
  | 'learning'
  | 'pivot'
  | 'funding'
  | 'industries'
  | 'law';

export interface CategoryOption {
  id: KnowledgeCategory;
  label: string;
}

export const KNOWLEDGE_CATEGORIES: CategoryOption[] = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'cv', label: 'CV i aplikowanie' },
  { id: 'interview', label: 'Rozmowa o pracę' },
  { id: 'learning', label: 'Nauka i kwalifikacje' },
  { id: 'pivot', label: 'Zmiana zawodu' },
  { id: 'funding', label: 'Dofinansowania' },
  { id: 'industries', label: 'Branże i zawody' },
  { id: 'law', label: 'Prawo i bezpieczeństwo' },
];

export type UserIntent =
  | 'all'
  | 'undecided'
  | 'quick_job'
  | 'qualification'
  | 'career_change'
  | 'return_to_market'
  | 'improve_cv'
  | 'funding';

export interface IntentOption {
  id: UserIntent;
  label: string;
}

export const USER_INTENTS: IntentOption[] = [
  { id: 'all', label: 'Wszystkie intencje' },
  { id: 'undecided', label: 'Nie wiem, co dalej' },
  { id: 'quick_job', label: 'Chcę szybko znaleźć pracę' },
  { id: 'qualification', label: 'Chcę zdobyć konkretną kwalifikację' },
  { id: 'career_change', label: 'Chcę zmienić zawód' },
  { id: 'return_to_market', label: 'Chcę wrócić na rynek pracy' },
  { id: 'improve_cv', label: 'Chcę poprawić CV' },
  { id: 'funding', label: 'Chcę sprawdzić, czy mogę dostać dofinansowanie' },
];

export type QuickGoalType =
  | 'from_scratch'
  | 'quick_licenses'
  | 'career_change'
  | 'find_training'
  | 'check_funding';

export interface QuickGoalOption {
  id: QuickGoalType;
  label: string;
  categoryFilter?: KnowledgeCategory;
  intentFilter?: UserIntent;
  searchTag?: string;
}

export const QUICK_GOALS: QuickGoalOption[] = [
  {
    id: 'from_scratch',
    label: 'Chcę zacząć od podstaw',
    intentFilter: 'undecided',
  },
  {
    id: 'quick_licenses',
    label: 'Chcę szybko zdobyć uprawnienia',
    categoryFilter: 'learning',
    intentFilter: 'qualification',
  },
  {
    id: 'career_change',
    label: 'Chcę zmienić zawód',
    categoryFilter: 'pivot',
    intentFilter: 'career_change',
  },
  {
    id: 'find_training',
    label: 'Chcę znaleźć szkolenie',
    categoryFilter: 'learning',
  },
  {
    id: 'check_funding',
    label: 'Chcę sprawdzić dofinansowanie',
    categoryFilter: 'funding',
    intentFilter: 'funding',
  },
];

export type MaterialType = 'pathway' | 'guide' | 'checklist' | 'example' | 'official';

export type EntryLevel = 'from_scratch' | 'requires_experience' | 'similar_industry';

export type DifficultyLevel = 'Podstawy' | 'Praktyka' | 'Zaawansowane';

export type LearningMethod =
  | 'kurs'
  | 'szkoła policealna'
  | 'kwalifikacyjny kurs zawodowy'
  | 'studia podyplomowe'
  | 'nauka w pracy';

export interface MaterialStructure {
  targetAudience: string;
  whatYouWillLearn: string[];
  commonRequirements: string[];
  whereToLearn: string[];
  timeAndCommitment: string;
  howToCheckQuality: string[];
  entryRolesAlongTheWay: string[];
  howToPrepareCv: string[];
  concreteNextStep: string;
}

export interface OfficialSourceMeta {
  sourceName: string;
  url: string;
  lastUpdated: string;
  regionalNotice: string;
}

export interface KnowledgeMaterial {
  id: string;
  title: string;
  seriesId:
    | 'undecided'
    | 'from_scratch'
    | 'qualifications'
    | 'school_or_course'
    | 'funding'
    | 'career_change';
  seriesTitle: string;
  type: MaterialType;
  category: KnowledgeCategory;
  intents: UserIntent[];
  readTime: string;
  difficulty: DifficultyLevel;
  entryLevel: EntryLevel;
  entryLevelLabel: 'od podstaw' | 'wymaga doświadczenia' | 'dla osób z podobnej branży';
  estimatedDuration?: string;
  learningMethods?: LearningMethod[];
  possibleLicenses?: string[];
  initialRoles?: string[];
  snippet: string;
  imageSrc: string;
  badge?: string;
  structure: MaterialStructure;
  officialSource: OfficialSourceMeta;
  tags: string[];
}

export interface LearningPlanItem {
  id: string;
  materialId: string;
  materialTitle: string;
  status: 'not_started' | 'in_progress' | 'completed';
  statusLabel: 'Nie rozpoczęto' | 'W trakcie' | 'Gotowe';
  addedAt: string;
  notes?: string;
  nextTask?: string;
  reminderDate?: string;
}

export interface LearningPlan {
  goalName: string;
  steps: {
    id: string;
    label: string;
    completed: boolean;
  }[];
  items: LearningPlanItem[];
  updatedAt: string;
}

export const DEFAULT_PLAN_STEPS = [
  'Przeczytaj materiał i zrób notatki',
  'Wybierz jeden konkretny kierunek lub kwalifikację',
  'Znajdź 3 sprawdzone szkolenia lub szkoły',
  'Porównaj program nauki i oficjalny dokument końcowy',
  'Zapytaj urząd pracy lub pracodawcę o możliwość dofinansowania',
  'Uzupełnij swój profil i wypisz umiejętności',
  'Przygotuj dopasowane CV pod wybrany kierunek',
  'Wyślij pierwszą aplikację lub zgłoszenie na kurs',
];

export const INITIAL_MATERIALS: KnowledgeMaterial[] = [
  // SERIA 1: Nie wiem, co dalej
  {
    id: 'jak-wybrac-zawod-brak-kierunku',
    title: 'Jak wybrać zawód, jeśli nie wiesz, co chcesz robić',
    seriesId: 'undecided',
    seriesTitle: 'Nie wiem, co dalej',
    type: 'guide',
    category: 'pivot',
    intents: ['undecided', 'return_to_market', 'career_change'],
    readTime: '6 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Prosty przewodnik eliminacji: od codziennych preferencji i warunków fizycznych do wstępnej listy 2–3 branż.',
    imageSrc: '/blog/career-change.png',
    badge: 'Polecane na start',
    tags: ['Poradnik', 'Kierunek kariery', 'Start'],
    structure: {
      targetAudience: 'Dla każdego, kto czuje zagubienie na rynku pracy, stoi w miejscu lub wraca po dłuższej przerwie.',
      whatYouWillLearn: [
        'Jak zacząć od kryteriów wykluczenia (np. dojazdy, praca fizyczna vs komputer, system zmianowy)',
        'Jak określić swój minimalny budżet i czas, jaki możesz poświęcić na naukę',
        'Jak przetestować 2–3 zawody bez rzucania się na głęboką wodę',
      ],
      commonRequirements: [
        'Gotowość do szczerej oceny swoich ograniczeń i możliwości czasowych',
        'Często spotykane wymagania: chęć do nauki, dyspozycyjność, umiejętność współpracy',
        'W zależności od regionu i pracodawcy kluczowe mogą być dojazdy lub elastyczność godzinowa',
      ],
      whereToLearn: [
        'Powiatowy Urząd Pracy — bezpłatna konsultacja z doradcą zawodowym',
        'Zintegrowany Rejestr Kwalifikacji (zrk.men.gov.pl) — opisy rzeczywistych zawodów i wymagań',
        'Lokalne dni otwarte w centrach kształcenia ustawicznego',
      ],
      timeAndCommitment: 'Około 1–2 tygodnie na zebranie informacji i wykonanie wstępnej selekcji.',
      howToCheckQuality: [
        'Uważaj na drogie kursy obiecujące sukces w 2 tygodnie',
        'Sprawdzaj, czy doradca zawodowy jest certyfikowany i nie sprzedaje konkretnego drogiego szkolenia',
      ],
      entryRolesAlongTheWay: [
        'Prace pomocnicze i stażowe',
        'Stanowiska asystenckie z wdrożeniem stanowiskowym',
      ],
      howToPrepareCv: [
        'Wypisz prawdziwe doświadczenia życiowe, obsługę narzędzi lub prawa jazdy',
        'Napisz jedno szczere zdanie w podsumowaniu o gotowości do nauki od podstaw',
      ],
      concreteNextStep: 'Wypisz na kartce 3 rzeczy, których na pewno nie chcesz robić w pracy (np. praca w nocy, praca na mrozie, praca z klientem) i odrzuć oferty, które to zawierają.',
    },
    officialSource: {
      sourceName: 'Wortal Publicznych Służb Zatrudnienia (psz.praca.gov.pl)',
      url: 'https://psz.praca.gov.pl/',
      lastUpdated: '2026-03-01',
      regionalNotice: 'Oferta doradztwa zawodowego jest bezpłatna i dostępna w każdym powiatowym urzędzie pracy.',
    },
  },
  {
    id: 'praca-od-podstaw-bez-doswiadczenia',
    title: 'Jak znaleźć pracę, której można nauczyć się od podstaw',
    seriesId: 'undecided',
    seriesTitle: 'Nie wiem, co dalej',
    type: 'guide',
    category: 'industries',
    intents: ['quick_job', 'undecided', 'return_to_market'],
    readTime: '5 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Zestawienie branż i stanowisk oferujących pełne przyuczenie na miejscu i stabilny start.',
    imageSrc: '/blog/ats-structure.png',
    tags: ['Poradnik', 'Przyuczenie', 'Pierwsza praca'],
    structure: {
      targetAudience: 'Dla osób bez wykształcenia kierunkowego, które pilnie potrzebują dochodu i chcą uczyć się w działaniu.',
      whatYouWillLearn: [
        'Które branże najczęściej oferują programy wdrożeniowe i płatny onboarding',
        'Jak odróżnić uczciwe przyuczenie od wykorzystywania darmowego okresu próbnego',
        'Jakie predyspozycje decydują o zatrudnieniu, gdy brakuje twardego CV',
      ],
      commonRequirements: [
        'Punktualność, rzetelność i chęć przyswajania procedur zakładowych',
        'Badania sanitarno-epidemiologiczne lub wstępne badania medycyny pracy',
        'Możliwe kierunki: logistyka magazynowa, produkcja przemysłowa, obsługa techniczna',
      ],
      whereToLearn: [
        'Bezpośrednio u pracodawcy w trakcie płatnego okresu próbnego',
        'Darmowe szkolenia przygotowawcze organizowane przez OHP lub urzędy pracy',
      ],
      timeAndCommitment: 'Wdrożenie trwa zwykle od 1 do 4 tygodni w zależności od specyfiki stanowiska.',
      howToCheckQuality: [
        'Upewnij się, że umowa obejmuje wynagrodzenie od pierwszego dnia szkolenia',
        'Sprawdź opinie o kulturze wdrożenia w danym zakładzie pracy',
      ],
      entryRolesAlongTheWay: [
        'Młodszy operator produkcji',
        'Pomocnik magazyniera',
        'Młodszy pracownik zaplecza technicznego',
      ],
      howToPrepareCv: [
        'Wyróżnij punktualność, zaangażowanie i gotowość do pracy w systemie zmianowym',
        'Podaj dyspozycyjność od zaraz, jeśli jesteś dostępny',
      ],
      concreteNextStep: 'Wyszukaj w ogłoszeniach lokalnych frazę „zapewniamy pełne wdrożenie” lub „przyuczymy do zawodu” i zapisz 3 oferty.',
    },
    officialSource: {
      sourceName: 'Centralna Baza Ofert Pracy (oferty.praca.gov.pl)',
      url: 'https://oferty.praca.gov.pl/',
      lastUpdated: '2026-03-05',
      regionalNotice: 'Dostępność ofert z przyuczeniem zależy silnie od lokalnych parków przemysłowych i magazynowych.',
    },
  },
  {
    id: 'jak-sprawdzic-w-czym-jestes-dobry',
    title: 'Jak sprawdzić, w czym jesteś dobry — test mocnych stron bez psychotestów',
    seriesId: 'undecided',
    seriesTitle: 'Nie wiem, co dalej',
    type: 'checklist',
    category: 'pivot',
    intents: ['undecided', 'career_change'],
    readTime: '4 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Prosta metoda audytu własnych czynności z ostatnich lat: co szło Ci sprawnie, a co odbierało energię.',
    imageSrc: '/blog/career-change.png',
    tags: ['Checklist', 'Mocne strony', 'Samoocena'],
    structure: {
      targetAudience: 'Dla każdego, kto uważa, że „nic specjalnego nie potrafi”, a chce uświadomić sobie swoje atuty.',
      whatYouWillLearn: [
        'Jak zamienić codzienne umiejętności na język wymagań rynkowych',
        'Dlaczego sprawność manualna, cierpliwość do ludzi czy dobra organizacja to realne kwalifikacje',
        'Jak zweryfikować swoje predyspozycje w oparciu o fakty z przeszłości',
      ],
      commonRequirements: [
        'Szczerość wobec siebie i 30 minut spokoju na analizę',
        'Sprawdź aktualne warunki rynkowe dla zidentyfikowanych predyspozycji',
      ],
      whereToLearn: [
        'Darmowy Kwestionariusz Zainteresowań Zawodowych w Wojewódzkim Urzędzie Pracy',
        'Baza Zintegrowanego Systemu Kwalifikacji',
      ],
      timeAndCommitment: '1–2 godziny na ćwiczenie autoanalizy.',
      howToCheckQuality: [
        'Unikaj płatnych testów osobowości z internetu, które nie mają walidacji psychometrycznej',
      ],
      entryRolesAlongTheWay: [
        'Role wymagające dokładności (kontrola jakości, inwentaryzacja)',
        'Role zorientowane na kontakt (pierwsza linia wsparcia, rejestracja)',
      ],
      howToPrepareCv: [
        'Przekształć zidentyfikowane mocne strony w konkretne przykłady zadań w CV',
      ],
      concreteNextStep: 'Zapytaj 2 zaufane osoby z rodziny lub dawnej pracy: „W jakich zadaniach według Ciebie radzę sobie najsprawniej?”.',
    },
    officialSource: {
      sourceName: 'Wojewódzki Urząd Pracy — Poradnictwo Zawodowe',
      url: 'https://wup.pl/',
      lastUpdated: '2026-02-15',
      regionalNotice: 'WUP w każdym województwie oferuje bezpłatne testy predyspozycji zawodowych.',
    },
  },
  {
    id: 'jak-wybrac-zawod-bez-studiow',
    title: 'Jak wybrać zawód bez studiów — stabilne fachy z perspektywą',
    seriesId: 'undecided',
    seriesTitle: 'Nie wiem, co dalej',
    type: 'guide',
    category: 'industries',
    intents: ['undecided', 'qualification'],
    readTime: '6 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Kwalifikacje techniczne, rzemieślnicze i usługowe, w których liczą się uprawnienia i praktyka, a nie dyplom uczelni.',
    imageSrc: '/blog/ats-structure.png',
    tags: ['Poradnik', 'Bez studiów', 'Fachy rynkowe'],
    structure: {
      targetAudience: 'Dla absolwentów szkół średnich, zawodowych oraz osób szukających zawodu opartego na konkretnych umiejętnościach.',
      whatYouWillLearn: [
        'Które zawody techniczne i usługowe mają stały deficyt pracowników',
        'Jaką rolę odgrywają certyfikaty państwowe (UDT, SEP, TDT, uprawnienia spawalnicze)',
        'Jak zaplanować ścieżkę od pomocnika do samodzielnego specjalisty',
      ],
      commonRequirements: [
        'Sprawność manualna lub techniczny zmysł w zależności od wybranego fachu',
        'Często spotykane wymagania: prawo jazdy kat. B, brak przeciwwskazań zdrowotnych',
      ],
      whereToLearn: [
        'Szkoły policealne (często bezpłatne w trybie zaocznym)',
        'Kwalifikacyjne Kursy Zawodowe (KKZ) w Centrach Kształcenia Zawodowego',
      ],
      timeAndCommitment: 'Od 1 miesiąca (kurs z egzaminem) do 1,5 roku (szkoła policealna z tytułem technika).',
      howToCheckQuality: [
        'Sprawdź, czy szkoła lub ośrodek posiada akredytację Kuratorium Oświaty',
        'Upewnij się, czy egzamin końcowy to państwowy egzamin OKE lub komisji państwowej',
      ],
      entryRolesAlongTheWay: [
        'Młodszy monter / pomocnik elektroinstalatora',
        'Praktykant na warsztacie mechanicznym',
      ],
      howToPrepareCv: [
        'Wymień ukończone kursy i posiadane uprawnienia w widocznym miejscu',
        'Wskaż doświadczenie przy majsterkowaniu lub pracach technicznych',
      ],
      concreteNextStep: 'Sprawdź w wyszukiwarce lokalne Centrum Kształcenia Zawodowego (CKZ) i zobacz listę darmowych kursów KKZ.',
    },
    officialSource: {
      sourceName: 'Barometr Zawodów (barometrzawodow.pl)',
      url: 'https://barometrzawodow.pl/',
      lastUpdated: '2026-01-20',
      regionalNotice: 'Lista zawodów deficytowych różni się między powiatami — sprawdź swój powiat na barometrzawodow.pl.',
    },
  },
  {
    id: 'nauka-po-dlugiej-przerwie',
    title: 'Jak zacząć naukę po długiej przerwie — spokojny przewodnik powrotu',
    seriesId: 'undecided',
    seriesTitle: 'Nie wiem, co dalej',
    type: 'guide',
    category: 'learning',
    intents: ['return_to_market', 'undecided'],
    readTime: '5 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Jak przełamać barierę niepewności, wygospodarować 20 minut dziennie i nie zniechęcić się po pierwszym tygodniu.',
    imageSrc: '/blog/career-change.png',
    tags: ['Poradnik', 'Powrót do nauki', 'Motywacja'],
    structure: {
      targetAudience: 'Dla osób wracających na rynek pracy po opiece nad dziećmi, chorobie, pracy za granicą lub wieloletnim zastoju.',
      whatYouWillLearn: [
        'Jak budować mikro-nawyki nauki (15–30 minut dziennie)',
        'Gdzie szukać bezpłatnych materiałów dla dorosłych o przejrzystym języku',
        'Jak radzić sobie ze stresem przed testami i egzaminami państwowymi',
      ],
      commonRequirements: [
        'Cierpliwość do siebie i regularność zamiast zrywów po kilka godzin',
      ],
      whereToLearn: [
        'Platforma Zintegrowanej Platformy Edukacyjnej (zpe.gov.pl)',
        'Lokalne biblioteki publiczne oferujące bezpłatne stanowiska i warsztaty cyfrowe',
      ],
      timeAndCommitment: '20–30 minut dziennie przez 4 tygodnie na odbudowanie pewności siebie.',
      howToCheckQuality: [
        'Wybieraj materiały z jasnymi przykładami i ćwiczeniami praktycznymi',
      ],
      entryRolesAlongTheWay: [
        'Stanowiska asystenckie z możliwością stopniowego wdrażania',
      ],
      howToPrepareCv: [
        'Zastosuj układ umiejętności i projektów zamiast sztywnej chronologii',
      ],
      concreteNextStep: 'Wybierz jeden temat (np. obsługa arkusza kalkulacyjnego lub przepisy BHP) i poświęć na niego 20 minut dzisiaj.',
    },
    officialSource: {
      sourceName: 'Zintegrowana Platforma Edukacyjna MEN',
      url: 'https://zpe.gov.pl/',
      lastUpdated: '2026-02-10',
      regionalNotice: 'Materiały ZPE są w 100% bezpłatne i otwarte dla wszystkich dorosłych.',
    },
  },

  // SERIA 2: Zawód od podstaw (Ścieżki zawodowe)
  {
    id: 'sciezka-operator-wozka-widlowego',
    title: 'Operator wózka widłowego — jak zdobyć uprawnienia UDT i wejść do logistyki',
    seriesId: 'from_scratch',
    seriesTitle: 'Zawód od podstaw',
    type: 'pathway',
    category: 'industries',
    intents: ['quick_job', 'qualification'],
    readTime: '7 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    estimatedDuration: '2–4 tygodnie (kurs + egzamin UDT)',
    learningMethods: ['kurs', 'nauka w pracy'],
    possibleLicenses: ['Uprawnienia UDT (Wózki jezdniowe podnośnikowe)', 'Prawo jazdy kat. B (opcjonalnie)'],
    initialRoles: ['Magazynier z uprawnieniami UDT', 'Operator wózka bocznego (Reach Truck)', 'Pracownik strefy przyjęć towaru'],
    snippet: 'Krok po kroku: wymagania medyczne, wybór ośrodka, przebieg egzaminu UDT i pierwsze zatrudnienie.',
    imageSrc: '/blog/ats-structure.png',
    badge: 'Ścieżka zawodowa',
    tags: ['Ścieżka zawodowa', 'UDT', 'Magazyn', 'Logistyka'],
    structure: {
      targetAudience: 'Dla osób chcących szybko zdobyć cenione, konkretne uprawnienie i podjąć pracę w centrach logistycznych.',
      whatYouWillLearn: [
        'Obsługa wózków z mechanicznym napędem podnoszenia (dawna kategoria II WJO / I WJO)',
        'Bezpieczna wymiana butli gazowych LPG i obsługa akumulatorów trakcyjnych',
        'Zasady stateczności wózka i bezpiecznego składowania na regałach wysokiego składu',
      ],
      commonRequirements: [
        'Ukończone 18 lat i minimum wykształcenie podstawowe',
        'Orzeczenie lekarskie o braku przeciwwskazań (wzrok, słuch, badania psychotechniczne)',
        'Często spotykane wymagania: gotowość do pracy w systemie zmianowym',
      ],
      whereToLearn: [
        'Certyfikowane ośrodki szkolenia kierowców wózków jezdniowych',
        'Kursy finansowane przez Urząd Pracy dla zarejestrowanych osób bezrobotnych',
      ],
      timeAndCommitment: 'Kurs trwa ok. 25–40 godzin (teoria + praktyka na placu manewrowym), czas oczekiwania na egzamin UDT to ok. 2–4 tygodnie.',
      howToCheckQuality: [
        'Sprawdź, czy cena kursu zawiera koszt egzaminu państwowego przed komisją UDT',
        'Upewnij się, ile godzin faktycznej jazdy wózkiem zapewnia ośrodek',
      ],
      entryRolesAlongTheWay: [
        'Pomocnik magazyniera (przed zdanym egzaminem)',
        'Operator wózka czołowego',
      ],
      howToPrepareCv: [
        'Wyróżnij zaświadczenie kwalifikacyjne UDT z dokładnym zakresem',
        'Wpisz doświadczenie z magazynu, jeśli kompletowałeś zamówienia wózkiem prowadzonym',
      ],
      concreteNextStep: 'Zadzwoń do 2 lokalnych ośrodków szkoleniowych i zapytaj o najbliższy termin kursu wraz z egzaminem UDT oraz o cenę badań psychotechnicznych.',
    },
    officialSource: {
      sourceName: 'Urząd Dozoru Technicznego (UDT)',
      url: 'https://www.udt.gov.pl/',
      lastUpdated: '2026-03-01',
      regionalNotice: 'Opłata za egzamin UDT jest ustalana ustawowo i wynosi kilkaset złotych w całym kraju.',
    },
  },
  {
    id: 'sciezka-utrzymanie-ruchu-podstawy',
    title: 'Jak wejść do utrzymania ruchu — od zera do mechanika/elektryka liniowego',
    seriesId: 'from_scratch',
    seriesTitle: 'Zawód od podstaw',
    type: 'pathway',
    category: 'industries',
    intents: ['qualification', 'career_change'],
    readTime: '8 min czytania',
    difficulty: 'Praktyka',
    entryLevel: 'similar_industry',
    entryLevelLabel: 'dla osób z podobnej branży',
    estimatedDuration: '3–6 miesięcy (kursy SEP + szkolenia praktyczne)',
    learningMethods: ['kurs', 'szkoła policealna', 'nauka w pracy'],
    possibleLicenses: ['SEP G1 (Eksploatacja do 1kV)', 'Szkolenie pneumatyka/hydraulika siłowa'],
    initialRoles: ['Młodszy technik utrzymania ruchu', 'Mechanik pomocniczy', 'Monter linii produkcyjnych'],
    snippet: 'Praktyczny przewodnik po jednej z najstabilniejszych gałęzi przemysłu: jakie uprawnienia i wiedza techniczna otwierają drzwi fabryk.',
    imageSrc: '/blog/ats-structure.png',
    badge: 'Ścieżka zawodowa',
    tags: ['Ścieżka zawodowa', 'Przemysł', 'SEP', 'Utrzymanie ruchu'],
    structure: {
      targetAudience: 'Dla majsterkowiczów, monterów, kierowców i operatorów maszyn chcących przejść do działu technicznego fabryki.',
      whatYouWillLearn: [
        'Odczytywanie schematów elektrycznych i pneumatycznych',
        'Podstawy diagnostyki czujników, siłowników i silników elektrycznych',
        'Procedury prewencyjnego utrzymania ruchu (TPM) i bezpieczeństwa LOTO',
      ],
      commonRequirements: [
        'Zmysł techniczny i umiejętność posługiwania się miernikiem uniwersalnym oraz narzędziami ręcznymi',
        'Uprawnienia SEP Grupa 1 Eksploatacja',
        'Często spotykane wymagania: praca w systemie 3-zmianowym lub 4-brygadowym',
      ],
      whereToLearn: [
        'Szkoły policealne na kierunku Technik Mechatronik lub Technik Elektryk',
        'Kursy przygotowujące do egzaminu SEP G1 (stowarzyszenia SEP, SIMP, NOT)',
      ],
      timeAndCommitment: 'Od kilku tygodni na podstawy elektryczne i SEP do roku na pełną swobodę mechatroniczną.',
      howToCheckQuality: [
        'Zwracaj uwagę na ośrodki posiadające prawdziwe panele laboratoryjne z komponentami Festo lub SMC',
      ],
      entryRolesAlongTheWay: [
        'Operator maszyn dbający o pierwsze przezbrojenia',
        'Pomocnik technika serwisowego',
      ],
      howToPrepareCv: [
        'Wypisz konkretne narzędzia diagnostyczne, które potrafisz obsłużyć (miernik, suwmiarka, klucze dynamometryczne)',
      ],
      concreteNextStep: 'Zapisz się na weekendowy kurs przygotowujący do uprawnień SEP G1 do 1 kV z egzaminem państwowym.',
    },
    officialSource: {
      sourceName: 'Stowarzyszenie Elektryków Polskich (sep.com.pl)',
      url: 'https://sep.com.pl/',
      lastUpdated: '2026-02-28',
      regionalNotice: 'Komisje kwalifikacyjne działają w każdym większym mieście powiatowym.',
    },
  },
  {
    id: 'sciezka-administracja-biurowa',
    title: 'Jak zacząć w administracji i biurze — bez studiów administracyjnych',
    seriesId: 'from_scratch',
    seriesTitle: 'Zawód od podstaw',
    type: 'pathway',
    category: 'industries',
    intents: ['quick_job', 'career_change'],
    readTime: '6 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    estimatedDuration: '1–3 miesiące',
    learningMethods: ['kurs', 'nauka w pracy'],
    possibleLicenses: ['Certyfikat Excel (np. ECDL/ICDL)', 'Zaświadczenie o znajomości obiegu dokumentów'],
    initialRoles: ['Młodszy asystent biura', 'Pracownik recepcji', 'Specjalista ds. wprowadzania danych (Data Entry)'],
    snippet: 'Jak zorganizować wiedzę z arkuszy kalkulacyjnych, korespondencji biznesowej i obiegu faktur, by dostać pierwszą pracę biurową.',
    imageSrc: '/blog/career-change.png',
    badge: 'Ścieżka zawodowa',
    tags: ['Ścieżka zawodowa', 'Administracja', 'Biuro', 'Excel'],
    structure: {
      targetAudience: 'Dla osób chcących przejść z handlu, gastronomii lub pracy fizycznej do środowiska biurowego.',
      whatYouWillLearn: [
        'Praktyczna obsługa arkusza kalkulacyjnego (VLOOKUP/XLOOKUP, tabele przestawne, sumy warunkowe)',
        'Podstawy obiegu dokumentów księgowych i kadrowych w firmie',
        'Zasady profesjonalnej korespondencji e-mail i obsługi terminarza',
      ],
      commonRequirements: [
        'Biegłość w obsłudze komputera i pakietu biurowego',
        'Dokładność, skrupulatność i wysoka kultura osobista w kontakcie z interesantami',
      ],
      whereToLearn: [
        'Bezpłatne kursy arkusza kalkulacyjnego online',
        'Dofinansowane szkolenia z pakietu MS Office w Bazie Usług Rozwojowych',
      ],
      timeAndCommitment: '20–30 godzin solidnej nauki Excela i procedur biurowych.',
      howToCheckQuality: [
        'Wybieraj kursy zorientowane na zadania praktyczne (faktury, rejestry, zestawienia sprzedaży), a nie suchą teorię',
      ],
      entryRolesAlongTheWay: [
        'Pracownik wprowadzania danych (Data Entry)',
        'Recepcjonista / obsługa sekretariatu',
      ],
      howToPrepareCv: [
        'Wskaż konkretne funkcje Excela, którymi się posługujesz',
        'Pokaż dowody na skrupulatność z dotychczasowej pracy (np. rozliczanie kasy, ewidencja stanów)',
      ],
      concreteNextStep: 'Stwórz w arkuszu kalkulacyjnym domowy budżet lub przykładowy rejestr 50 faktur z tabelą przestawną.',
    },
    officialSource: {
      sourceName: 'Polska Agencja Rozwoju Przedsiębiorczości (PARP Akademia)',
      url: 'https://akademia.parp.gov.pl/',
      lastUpdated: '2026-03-02',
      regionalNotice: 'Platforma PARP oferuje w 100% darmowe, certyfikowane kursy z Excela i administracji.',
    },
  },
  {
    id: 'sciezka-it-wsparcie-techniczne',
    title: 'Jak zacząć w IT i wsparciu technicznym (Helpdesk L1)',
    seriesId: 'from_scratch',
    seriesTitle: 'Zawód od podstaw',
    type: 'pathway',
    category: 'industries',
    intents: ['career_change', 'qualification'],
    readTime: '7 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    estimatedDuration: '2–4 miesiące',
    learningMethods: ['kurs', 'nauka w pracy'],
    possibleLicenses: ['CompTIA A+ (lub wiedza równoważna)', 'Podstawy ITIL v4'],
    initialRoles: ['Młodszy specjalista wsparcia IT', 'Technik Helpdesk L1', 'Wsparcie użytkownika końcowego (On-site Support)'],
    snippet: 'Najbardziej realna brama wejścia do IT: rozwiązywanie problemów ze sprzętem, systemami Windows/Linux i siecią bez programowania.',
    imageSrc: '/blog/ats-structure.png',
    badge: 'Ścieżka zawodowa',
    tags: ['Ścieżka zawodowa', 'IT', 'Helpdesk', 'Wsparcie techniczne'],
    structure: {
      targetAudience: 'Dla osób dobrze czujących się przy komputerze, które chcą wejść do branży IT bez konieczności kodowania.',
      whatYouWillLearn: [
        'Diagnozowanie awarii systemów Windows/macOS/Linux',
        'Zarządzanie kontami użytkowników w Active Directory / Microsoft 365',
        'Podstawy sieci komputerowych (IP, DHCP, DNS, rozwiązywanie problemów z drukarkami sieciowymi)',
      ],
      commonRequirements: [
        'Komunikatywność i cierpliwość w rozmowie z użytkownikiem nietechnicznym',
        'Znajomość języka angielskiego na poziomie czytania dokumentacji technicznej (min. B1)',
      ],
      whereToLearn: [
        'Darmowe materiały przygotowawcze do CompTIA A+ na YouTube',
        'Szkolenia ze środków KFS (Krajowy Fundusz Szkoleniowy) dla pracowników',
      ],
      timeAndCommitment: 'Ok. 80–120 godzin nauki i ćwiczeń w wirtualnym środowisku.',
      howToCheckQuality: [
        'Ucz się na rzeczywistych systemach biletowych (np. Jira Service Desk, Zendesk)',
      ],
      entryRolesAlongTheWay: [
        'Konsultant wsparcia technicznego na infolinii',
        'Serwisant sprzętu komputerowego',
      ],
      howToPrepareCv: [
        'Wypisz konkretne systemy i narzędzia (np. Windows 11, MS 365 Admin, Active Directory, ping/traceroute)',
      ],
      concreteNextStep: 'Zainstaluj na darmowym VirtualBox maszynę wirtualną z Windows lub Ubuntu i skonfiguruj podstawowe udostępnianie plików w sieci.',
    },
    officialSource: {
      sourceName: 'Baza Usług Rozwojowych (uslugirozwojowe.parp.gov.pl)',
      url: 'https://uslugirozwojowe.parp.gov.pl/',
      lastUpdated: '2026-02-25',
      regionalNotice: 'Dofinansowanie do certyfikatów CompTIA i szkoleń IT wynosi w BUR do 80%.',
    },
  },

  // SERIA 3: Uprawnienia i kwalifikacje
  {
    id: 'uprawnienia-sep-g1-g2-g3',
    title: 'Uprawnienia SEP (G1, G2, G3) — dla kogo, wymagania i gdzie szukać kursu',
    seriesId: 'qualifications',
    seriesTitle: 'Uprawnienia i kwalifikacje',
    type: 'official',
    category: 'learning',
    intents: ['qualification', 'quick_job'],
    readTime: '6 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Kompendium uprawnień elektrycznych (G1), cieplnych (G2) i gazowych (G3) w zakresie Eksploatacji (E) oraz Dozoru (D).',
    imageSrc: '/blog/ats-structure.png',
    badge: 'Oficjalne źródła',
    tags: ['Oficjalne źródła', 'SEP', 'Uprawnienia państwowe', 'Elektryka'],
    structure: {
      targetAudience: 'Dla instalatorów, techników, serwisantów, monterów fotowoltaiki i pracowników produkcji.',
      whatYouWillLearn: [
        'Różnica między Grupą 1 (elektryczna do 1kV lub wyżej), Grupą 2 (kotły, piece, ciepłownictwo) i Grupą 3 (sieci gazowe)',
        'Co oznacza litera E (Eksploatacja — montaż, demontaż, obsługa) a co D (Dozór — kierowanie pracami)',
        'Zasady pierwszej pomocy przy porażeniu prądem i przepisy BHP',
      ],
      commonRequirements: [
        'Ukończone 18 lat i podstawowa wiedza techniczna',
        'Złożenie wniosku do Państwowej Komisji Kwalifikacyjnej powołanej przez Prezesa URE',
      ],
      whereToLearn: [
        'Ośrodki szkoleniowe SEP, SIMP, NOT, SITP',
        'Często organizowane jako 1-dniowe szkolenie połączone bezpośrednio z egzaminem',
      ],
      timeAndCommitment: 'Szkolenie trwa 1 dzień (ok. 6–8 godzin), świadectwo wydawane jest po zdanym ustnym egzaminie państwowym.',
      howToCheckQuality: [
        'Upewnij się, że komisja egzaminacyjna posiada ważną nominację Urzędu Regulacji Energetyki (URE)',
        'Sprawdź, czy zaświadczenie kwalifikacyjne jest ważne przez 5 lat',
      ],
      entryRolesAlongTheWay: [
        'Elektromonter pomocniczy',
        'Monter instalacji OZE / klimatyzacji',
      ],
      howToPrepareCv: [
        'Wpisz dokładnie: „Świadectwo kwalifikacji Grupa 1 Eksploatacja (do 1kV) — ważne do [data]”',
      ],
      concreteNextStep: 'Sprawdź najbliższy termin komisji kwalifikacyjnej w swoim mieście i pobierz zakres pytań egzaminacyjnych z BHP i ochrony przeciwporażeniowej.',
    },
    officialSource: {
      sourceName: 'Urząd Regulacji Energetyki (URE)',
      url: 'https://www.ure.gov.pl/',
      lastUpdated: '2026-03-01',
      regionalNotice: 'Opłata za egzamin kwalifikacyjny wynosi 10% minimalnego wynagrodzenia za pracę.',
    },
  },
  {
    id: 'uprawnienia-udt-katalog',
    title: 'Uprawnienia UDT — jakie uprawnienia można zdobyć i co dają na rynku',
    seriesId: 'qualifications',
    seriesTitle: 'Uprawnienia i kwalifikacje',
    type: 'official',
    category: 'learning',
    intents: ['qualification', 'quick_job'],
    readTime: '6 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Zestawienie uprawnień Urzędu Dozoru Technicznego: wózki widłowe, suwnice, podesty ruchome (zwyżki), żurawie i windy.',
    imageSrc: '/blog/ats-structure.png',
    badge: 'Oficjalne źródła',
    tags: ['Oficjalne źródła', 'UDT', 'Suwnice', 'Podesty'],
    structure: {
      targetAudience: 'Dla osób pracujących na magazynach, budowach, w portach, hutach i halach montażowych.',
      whatYouWillLearn: [
        'Katalog urządzeń transportu bliskiego objętych dozorem technicznym',
        'Procedury bezpiecznej eksploatacji i zgłaszania usterek w dzienniku konserwacji',
        'Przebieg egzaminu teoretycznego (test komputerowy) i praktycznego przed inspektorem UDT',
      ],
      commonRequirements: [
        'Ukończone 18 lat, badania lekarskie i psychologiczne',
        'W zależności od urządzenia: brak lęku wysokości (podesty ruchome, żurawie)',
      ],
      whereToLearn: [
        'Ośrodki szkolenia technicznego z poligonem manewrowym zaakceptowanym przez UDT',
      ],
      timeAndCommitment: 'Kurs trwa od 2 dni (suwnice z poziomu roboczego) do 2 tygodni, plus czas oczekiwania na termin komisji UDT.',
      howToCheckQuality: [
        'Zapytaj, czy ośrodek zapewnia w cenie powtórkę przed egzaminem oraz weryfikację dokumentacji w UDT',
      ],
      entryRolesAlongTheWay: [
        'Hakowy / sygnalista',
        'Operator suwnic sterowanych z poziomu roboczego',
      ],
      howToPrepareCv: [
        'Podaj pełną oficjalną nazwę uprawnienia UDT wraz z numerem legitymacji',
      ],
      concreteNextStep: 'Wybierz jedno urządzenie (np. podesty ruchome przejezdne do prac budowlano-montażowych) i sprawdź zapotrzebowanie w lokalnych ogłoszeniach.',
    },
    officialSource: {
      sourceName: 'Portal eUDT — Urząd Dozoru Technicznego',
      url: 'https://eudt.gov.pl/',
      lastUpdated: '2026-02-20',
      regionalNotice: 'Wszystkie zaświadczenia kwalifikacyjne UDT są ewidencjonowane w centralnym rejestrze elektronicznym.',
    },
  },
  {
    id: 'prawo-jazdy-transport-kwalifikacje',
    title: 'Prawo jazdy i kwalifikacje w transporcie — kat. C, C+E i Kwalifikacja Wstępna',
    seriesId: 'qualifications',
    seriesTitle: 'Uprawnienia i kwalifikacje',
    type: 'guide',
    category: 'learning',
    intents: ['qualification', 'quick_job'],
    readTime: '7 min czytania',
    difficulty: 'Praktyka',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Jak zostać kierowcą zawodowym: ścieżka od kat. B do C+E, Kwalifikacja Wstępna Przyspieszona, karta kierowcy i badania.',
    imageSrc: '/blog/ats-structure.png',
    tags: ['Poradnik', 'Kierowca zawodowy', 'Transport', 'Kat. C'],
    structure: {
      targetAudience: 'Dla osób posiadających prawo jazdy kat. B, które chcą rozpocząć pracę w krajowym lub międzynarodowym transporcie towarowym.',
      whatYouWillLearn: [
        'Etapy: Profil Kandydata na Kierowcę (PKK), kurs kat. C, kurs kat. C+E',
        'Co to jest Kwalifikacja Wstępna Przyspieszona (kod 95 w prawie jazdy)',
        'Wyrobienie karty do tachografu cyfrowego w Polskiej Wytwórni Papierów Wartościowych (PWPW)',
      ],
      commonRequirements: [
        'Prawo jazdy kat. B, wiek min. 21 lat (lub 18 przy pełnej kwalifikacji wstępnej)',
        'Badania psychologiczne (psychotesty) i orzeczenie lekarskie dla kierowców zawodowych',
      ],
      whereToLearn: [
        'Ośrodki Szkolenia Kierowców (OSK) z akredytacją',
        'Projekty unijne z dofinansowaniem do 100% kosztów prawa jazdy w Urzędach Pracy',
      ],
      timeAndCommitment: 'Zwykle 3–5 miesięcy na pełny cykl (C, C+E oraz kwalifikacja wstępna).',
      howToCheckQuality: [
        'Wybieraj OSK dysponujące nowoczesnymi ciągnikami siodłowymi z naczepą i placem manewrowym zgodnym z WORD',
      ],
      entryRolesAlongTheWay: [
        'Kierowca solówki (kat. C) w dystrybucji lokalnej',
        'Kierowca międzynarodowy w podwójnej obsadzie',
      ],
      howToPrepareCv: [
        'Wypisz prawo jazdy kat. C+E, kod 95 z datą ważności oraz posiadanie karty kierowcy',
      ],
      concreteNextStep: 'Złóż wizytę w wydziale komunikacji lub zapytaj w PUP o nabór na dofinansowanie prawa jazdy kat. C+E dla bezrobotnych.',
    },
    officialSource: {
      sourceName: 'Wortal Info-Car (PWPW)',
      url: 'https://info-car.pl/',
      lastUpdated: '2026-03-04',
      regionalNotice: 'Dofinansowania unijne na kierowców zawodowych są regularnie uruchamiane przez WUP w programach regionalnych.',
    },
  },

  // SERIA 4: Szkoła, kurs czy studia?
  {
    id: 'kurs-zawodowy-a-szkola-policealna',
    title: 'Kurs zawodowy a szkoła policealna — co wybrać pod kątem czasu i dokumentu',
    seriesId: 'school_or_course',
    seriesTitle: 'Szkoła, kurs czy studia?',
    type: 'guide',
    category: 'learning',
    intents: ['undecided', 'qualification'],
    readTime: '6 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Porównanie kosztów, czasu nauki i wagi dokumentu końcowego: certyfikat ukończenia kursu vs dyplom technika OKE.',
    imageSrc: '/blog/career-change.png',
    tags: ['Poradnik', 'Szkoła policealna', 'Kursy', 'Kwalifikacje'],
    structure: {
      targetAudience: 'Dla osób planujących naukę, które wahają się między szybkim kursem prywatnym a 1–2 letnią bezpłatną szkołą zaoczną.',
      whatYouWillLearn: [
        'Różnica prawna między zaświadczeniem o ukończeniu kursu a dyplomem państwowym OKE',
        'Kiedy pracodawcy wymagają formalnego tytułu technika, a kiedy wystarczy praktyczna umiejętność',
        'Jak działają Kwalifikacyjne Kursy Zawodowe (KKZ) kończące się egzaminem państwowym',
      ],
      commonRequirements: [
        'Szkoła policealna wymaga wykształcenia średniego (matura nie jest wymagana)',
        'Kursy komercyjne najczęściej nie mają wymagań formalnych',
      ],
      whereToLearn: [
        'Publiczne i niepubliczne szkoły policealne z uprawnieniami szkoły publicznej',
        'Centra Kształcenia Zawodowego i Ustawicznego (CKZiU)',
      ],
      timeAndCommitment: 'Szkoła policealna: 1–2 lata w zjazdach weekendowych (zwykle bezpłatna). Kurs: od 2 dni do 3 miesięcy (często płatny).',
      howToCheckQuality: [
        'Sprawdź, czy szkoła policealna posiada uprawnienia szkoły publicznej i przeprowadza egzaminy OKE',
        'Zawsze pytaj: „Jaki dokładnie dokument otrzymam po zakończeniu nauki?”',
      ],
      entryRolesAlongTheWay: [
        'Praktykant / stażysta w trakcie trwania nauki w szkole policealnej',
      ],
      howToPrepareCv: [
        'Wpisz szkołę w toku z planowaną datą egzaminu państwowego',
      ],
      concreteNextStep: 'Wybierz interesujący Cię zawód i sprawdź w Zintegrowanym Rejestrze Kwalifikacji, jakie certyfikaty są do niego przypisane.',
    },
    officialSource: {
      sourceName: 'Zintegrowany Rejestr Kwalifikacji (ZRK)',
      url: 'https://rejestr.kwalifikacje.gov.pl/',
      lastUpdated: '2026-02-18',
      regionalNotice: 'Wszystkie kwalifikacje z ZRK mają określony poziom Polskiej Ramy Kwalifikacji (PRK).',
    },
  },
  {
    id: 'jak-odroznic-certyfikat-od-formalnej-kwalifikacji',
    title: 'Jak odróżnić certyfikat ukończenia od formalnej kwalifikacji zawodowej',
    seriesId: 'school_or_course',
    seriesTitle: 'Szkoła, kurs czy studia?',
    type: 'checklist',
    category: 'learning',
    intents: ['qualification', 'funding'],
    readTime: '5 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Kluczowe pytania przed wydaniem pieniędzy: podstawa prawna, instytucja certyfikująca, wpis do rejestru.',
    imageSrc: '/blog/ats-structure.png',
    tags: ['Checklist', 'Certyfikaty', 'ZRK', 'Bezpieczeństwo'],
    structure: {
      targetAudience: 'Dla każdego, kto rozważa płatne szkolenie i chce uniknąć wydania oszczędności na bezwartościowy dyplom pamiątkowy.',
      whatYouWillLearn: [
        'Co oznacza „certyfikat uczestnictwa” w porównaniu z państwowym świadectwem kwalifikacji',
        'Czym jest Polska Rama Kwalifikacji (PRK) i jak sprawdzić kod kwalifikacji',
        'Jak zweryfikować czy dana jednostka szkoleniowa ma prawo egzaminowania',
      ],
      commonRequirements: [
        'Czujność i nawyk czytania regulaminu szkolenia przed podpisaniem umowy',
      ],
      whereToLearn: [
        'Baza Zintegrowanego Systemu Kwalifikacji (kwalifikacje.gov.pl)',
        'Rejestr Instytucji Szkoleniowych (stor.praca.gov.pl)',
      ],
      timeAndCommitment: '15 minut weryfikacji w publicznych rejestrach przed zapisaniem się.',
      howToCheckQuality: [
        'Zapytaj organizatora: „Na jakiej podstawie prawnej wydawany jest dokument i jaki organ państwowy go uznaje?”',
        'Sprawdź, czy firma jest wpisana do Rejestru Instytucji Szkoleniowych (RIS) Wojewódzkiego Urzędu Pracy',
      ],
      entryRolesAlongTheWay: [
        'Prace w sektorach wymagających twardych uprawnień (BHP, budownictwo, energetyka)',
      ],
      howToPrepareCv: [
        'Podawaj w CV wyłącznie podmiot certyfikujący i numer uprawnienia, unikając ogólnych haseł „ukończony kurs”',
      ],
      concreteNextStep: 'Wpisz NIP wybranej firmy szkoleniowej do Rejestru Instytucji Szkoleniowych (RIS) na stronie stor.praca.gov.pl.',
    },
    officialSource: {
      sourceName: 'Rejestr Instytucji Szkoleniowych (RIS)',
      url: 'https://stor.praca.gov.pl/portal/#/ris',
      lastUpdated: '2026-03-01',
      regionalNotice: 'Tylko instytucje z ważnym wpisem do RIS mogą realizować szkolenia finansowane przez urzędy pracy.',
    },
  },

  // SERIA 5: Dofinansowanie nauki
  {
    id: 'jak-zapytac-urzad-pracy-o-szkolenie',
    title: 'Jak zapytać urząd pracy o szkolenie indywidualne — krok po kroku',
    seriesId: 'funding',
    seriesTitle: 'Dofinansowanie nauki',
    type: 'guide',
    category: 'funding',
    intents: ['funding', 'quick_job', 'return_to_market'],
    readTime: '7 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Procedura wnioskowania o szkolenie ze środków Funduszu Pracy: warunki, uzasadnienie celowości i deklaracja pracodawcy.',
    imageSrc: '/blog/career-change.png',
    badge: 'Kluczowe',
    tags: ['Poradnik', 'Urząd Pracy', 'Dofinansowanie', 'Szkolenie bezrobotnych'],
    structure: {
      targetAudience: 'Dla osób zarejestrowanych jako bezrobotne, które chcą sfinansować uprawnienia lub kurs bez wkładu własnego.',
      whatYouWillLearn: [
        'Kto może ubiegać się o sfinansowanie szkolenia wskazanego przez siebie (tzw. szkolenie indywidualne)',
        'Jak uzyskać deklarację zatrudnienia od przyszłego pracodawcy i dlaczego gwarantuje ona sukces wniosku',
        'Jakie koszty pokrywa urząd (kurs, badania lekarskie, egzamin państwowy, stypendium szkoleniowe, dojazdy)',
      ],
      commonRequirements: [
        'Status osoby bezrobotnej w Powiatowym Urzędzie Pracy',
        'Uzasadnienie celowości szkolenia (uprawdopodobnienie zatrudnienia)',
      ],
      whereToLearn: [
        'Powiatowy Urząd Pracy właściwy dla miejsca zamieszkania',
      ],
      timeAndCommitment: 'Rozpatrzenie wniosku trwa do 30 dni od momentu złożenia kompletu dokumentów.',
      howToCheckQuality: [
        'Wybieraj szkolenie z instytucji zarejestrowanej w RIS (Rejestr Instytucji Szkoleniowych)',
      ],
      entryRolesAlongTheWay: [
        'Stanowisko uzgodnione w deklaracji zatrudnienia od pracodawcy',
      ],
      howToPrepareCv: [
        'Dołącz CV do wniosku w urzędzie pracy, aby pokazać, że brak konkretnego uprawnienia to jedyna luka blokująca zatrudnienie',
      ],
      concreteNextStep: 'Pobierz ze strony swojego powiatowego urzędu pracy formularz: „Wniosek o skierowanie na szkolenie indywidualne”.',
    },
    officialSource: {
      sourceName: 'Portal Publicznych Służb Zatrudnienia — Szkolenia',
      url: 'https://psz.praca.gov.pl/dla-bezrobotnych-i-poszukujacych-pracy/podnoszenie-kwalifikacji/szkolenia',
      lastUpdated: '2026-02-15',
      regionalNotice: 'Wysokość środków na szkolenia zależy od budżetu danego PUP na dany rok kalendarzowy.',
    },
  },
  {
    id: 'jak-dziala-baza-uslug-rozwojowych',
    title: 'Jak znaleźć szkolenie w Bazie Usług Rozwojowych (BUR) z dofinansowaniem do 80%',
    seriesId: 'funding',
    seriesTitle: 'Dofinansowanie nauki',
    type: 'guide',
    category: 'funding',
    intents: ['funding', 'qualification', 'career_change'],
    readTime: '6 min czytania',
    difficulty: 'Praktyka',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Przewodnik po podmiotowym systemie finansowania: jak osoby pracujące i poszukujące pracy mogą zdobyć bon szkoleniowy.',
    imageSrc: '/blog/ats-structure.png',
    tags: ['Poradnik', 'BUR', 'PARP', 'Bony szkoleniowe'],
    structure: {
      targetAudience: 'Dla osób pracujących, na umowach cywilnoprawnych i samozatrudnionych, które chcą podnieść kwalifikacje z dopłatą unijną.',
      whatYouWillLearn: [
        'Jak wyszukiwać usługi szkoleniowe oznaczone opcją „możliwość dofinansowania”',
        'Jak zgłosić się do Operatora Regionalnego w swoim województwie',
        'Jak działa refundacja lub system bonowy bez angażowania pełnej kwoty',
      ],
      commonRequirements: [
        'Zamieszkiwanie lub praca na terenie danego województwa',
        'Wkład własny (zwykle od 10% do 20% wartości szkolenia)',
      ],
      whereToLearn: [
        'Serwis Bazy Usług Rozwojowych PARP (uslugirozwojowe.parp.gov.pl)',
        'Operatorzy regionalni w poszczególnych województwach',
      ],
      timeAndCommitment: 'Złożenie wniosku i uzyskanie bonów trwa zwykle 2–4 tygodnie przed rozpoczęciem kursu.',
      howToCheckQuality: [
        'BUR posiada rygorystyczne audyty jakości — sprawdzaj opinie uczestników widoczne przy każdym szkoleniu',
      ],
      entryRolesAlongTheWay: [
        'Wyższe stanowisko w obecnej firmie lub nowe kwalifikacje w innej branży',
      ],
      howToPrepareCv: [
        'Po ukończeniu wpisz szkolenie wraz z certyfikatem uznawanym w ZRK',
      ],
      concreteNextStep: 'Załóż darmowe konto użytkownika w Bazie Usług Rozwojowych i zaznacz filtr „Z możliwością dofinansowania”.',
    },
    officialSource: {
      sourceName: 'Polska Agencja Rozwoju Przedsiębiorczości (BUR)',
      url: 'https://uslugirozwojowe.parp.gov.pl/',
      lastUpdated: '2026-03-01',
      regionalNotice: 'Zasady dofinansowania i nabory wniosków są prowadzone cyklicznie przez operatorów regionalnych.',
    },
  },
  {
    id: 'na-co-uwazac-przed-platnym-kursem',
    title: 'Na co uważać przed zapisaniem się na płatny kurs — 6 sygnałów ostrzegawczych',
    seriesId: 'funding',
    seriesTitle: 'Dofinansowanie nauki',
    type: 'checklist',
    category: 'law',
    intents: ['funding', 'qualification'],
    readTime: '5 min czytania',
    difficulty: 'Podstawy',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Jak nie dać się naciągnąć na pseudokursy obiecujące „gwarantowaną pracę w IT/logistyce po 2 tygodniach”.',
    imageSrc: '/blog/ats-structure.png',
    badge: 'Ważne ostrzeżenie',
    tags: ['Checklist', 'Bezpieczeństwo', 'Prawa konsumenta', 'Ostrzeżenie'],
    structure: {
      targetAudience: 'Dla każdego, kto rozważa podpisanie umowy szkoleniowej lub zaciągnięcie pożyczki na kurs.',
      whatYouWillLearn: [
        'Dlaczego klauzula „gwarancja pracy lub zwrot pieniędzy” najczęściej zawiera warunki niemożliwe do spełnienia',
        'Jak sprawdzić, ile godzin to faktyczna praca z instruktorem, a ile nagrane filmiki',
        'Zasady odstąpienia od umowy zawartej przez internet w terminie 14 dni',
      ],
      commonRequirements: [
        'Wnikliwa lektura umowy i regulaminu przed dokonaniem jakiejkolwiek opłaty',
      ],
      whereToLearn: [
        'Urząd Ochrony Konkurencji i Konsumentów (uokik.gov.pl)',
        'Miejski lub powiatowy rzecznik konsumentów (bezpłatna pomoc prawna)',
      ],
      timeAndCommitment: '1 godzina analizy umowy i regulaminu może uratować kilka tysięcy złotych.',
      howToCheckQuality: [
        'Sprawdź NIP w KRS/CEIDG, opinie poza stroną organizatora i datę powstania firmy',
      ],
      entryRolesAlongTheWay: [
        'Wybieraj szkolenia z oficjalnym egzaminem zewnętrznym zamiast wewnętrznego dyplomu',
      ],
      howToPrepareCv: [
        'Pracodawcy cenią praktyczne umiejętności i państwowe certyfikaty, a nie nazwę drogiej akademii',
      ],
      concreteNextStep: 'Poproś firmę szkoleniową o przesłanie wzoru umowy i regulaminu do przeczytania w domu przed podjęciem decyzji.',
    },
    officialSource: {
      sourceName: 'Urząd Ochrony Konkurencji i Konsumentów (UOKiK)',
      url: 'https://uokik.gov.pl/',
      lastUpdated: '2026-02-12',
      regionalNotice: 'Prawa konsumenta chronią Cię bezpłatnie przy umowach zawieranych na odległość.',
    },
  },

  // SERIA 6: Zmiana zawodu
  {
    id: 'umiejetnosci-przenosne-most-kompetencji',
    title: 'Jak znaleźć umiejętności przenośne — z prac fizycznych do biura i techniki',
    seriesId: 'career_change',
    seriesTitle: 'Zmiana zawodu',
    type: 'guide',
    category: 'pivot',
    intents: ['career_change', 'improve_cv'],
    readTime: '6 min czytania',
    difficulty: 'Praktyka',
    entryLevel: 'similar_industry',
    entryLevelLabel: 'dla osób z podobnej branży',
    snippet: 'Jak przełożyć doświadczenie z magazynu, handlu, produkcji lub gastronomii na język ofert technicznych i biurowych.',
    imageSrc: '/blog/career-change.png',
    badge: 'Popularne',
    tags: ['Poradnik', 'Przebranżowienie', 'Most kompetencji', 'CV'],
    structure: {
      targetAudience: 'Dla osób chcących zmienić branżę bez zaczynania od zera i bez poczucia, że ich dotychczasowe lata pracy przepadły.',
      whatYouWillLearn: [
        'Jak zidentyfikować twarde fakty: organizacja pracy, obsługa systemów, odpowiedzialność za mienie, kontakt z klientem',
        'Jak zbudować most kompetencji w podsumowaniu zawodowym bez naciągania faktów',
        'Jak unikać żargonu starej branży, którego nie rozumie nowy rekruter',
      ],
      commonRequirements: [
        'Zrozumienie słownictwa używanego w nowej branży docelowej',
        'Sprawdź aktualne wymagania w ofertach na poziomie podstawowym',
      ],
      whereToLearn: [
        'Analiza ogłoszeń o pracę w nowej branży i wypisanie powtarzających się czasowników działania',
      ],
      timeAndCommitment: '2–3 dni na przygotowanie nowej narracji zawodowej i przetestowanie jej w CV.',
      howToCheckQuality: [
        'Nie zmieniaj nazw stanowisk w historii zatrudnienia — zmieniaj opisy zadań i uwypuklaj przenośne elementy',
      ],
      entryRolesAlongTheWay: [
        'Role pomostowe (np. dyspozytor logistyczny, kontroler jakości, asystent techniczny)',
      ],
      howToPrepareCv: [
        'Wypisz jako pierwsze te zadania z dawnej pracy, które są najbardziej zbieżne z nową rolą',
      ],
      concreteNextStep: 'Wypisz 3 zadania ze swojej obecnej pracy, które wymagają dokładności, procedur lub kontaktu z ludźmi i opisz je językiem rezultatów.',
    },
    officialSource: {
      sourceName: 'Wortal Publicznych Służb Zatrudnienia — Kwalifikacje Przenośne',
      url: 'https://psz.praca.gov.pl/',
      lastUpdated: '2026-02-28',
      regionalNotice: 'Zintegrowany System Kwalifikacji klasyfikuje umiejętności według uniwersalnych efektów uczenia się.',
    },
  },
  {
    id: 'plan-zmiany-zawodu-30-60-90',
    title: 'Jak zbudować plan zmiany zawodu na 30, 60 i 90 dni',
    seriesId: 'career_change',
    seriesTitle: 'Zmiana zawodu',
    type: 'checklist',
    category: 'pivot',
    intents: ['career_change', 'undecided'],
    readTime: '7 min czytania',
    difficulty: 'Praktyka',
    entryLevel: 'from_scratch',
    entryLevelLabel: 'od podstaw',
    snippet: 'Konkretny harmonogram działania: od rozeznania i wyboru 1 kursu, przez budowę profilu, po pierwsze aplikacje.',
    imageSrc: '/blog/career-change.png',
    tags: ['Checklist', 'Plan 30-60-90', 'Harmonogram', 'Przebranżowienie'],
    structure: {
      targetAudience: 'Dla każdego, kto chce zmienić branżę bezpiecznie, bez rzucania obecnej pracy przed znalezieniem nowej.',
      whatYouWillLearn: [
        'Etap 30 dni: Audyt, wykluczenie nierealnych opcji, wybór jednej kwalifikacji bazowej',
        'Etap 60 dni: Zdobycie uprawnienia/kursu, stworzenie portfolio lub profilu z dowodami',
        'Etap 90 dni: Selektywne aplikowanie, przygotowanie historii na rozmowę i pierwsze wdrożenie',
      ],
      commonRequirements: [
        'Wyznaczenie 30–45 minut dziennie lub 4 godzin w weekend na realizację kolejnych punktów',
      ],
      whereToLearn: [
        'Narzędzie „Mój plan nauki” w Kierivo z przypomnieniami i kontrolą postępu',
      ],
      timeAndCommitment: '3 miesiące spokojnej, systematycznej pracy równolegle do codziennych obowiązków.',
      howToCheckQuality: [
        'Nie zmieniaj decyzji o branży co 2 tygodnie — doprowadź jeden 90-dniowy cykl do końca',
      ],
      entryRolesAlongTheWay: [
        'Praktyki weekendowe, zlecenia próbne lub staż wstępny',
      ],
      howToPrepareCv: [
        'Przygotuj CV dopiero w 60. dniu, gdy masz już w ręku konkretny dowód nauki lub zaświadczenie',
      ],
      concreteNextStep: 'Wpisz do kalendarza 1 konkretną godzinę w tym tygodniu na analizę 3 ofert pracy z wybranego nowego kierunku.',
    },
    officialSource: {
      sourceName: 'Wojewódzki Urząd Pracy — Poradnik Przebranżowienia',
      url: 'https://wup.pl/',
      lastUpdated: '2026-03-01',
      regionalNotice: 'Doradcy zawodowi w WUP bezpłatnie pomagają ułożyć indywidualny plan działania (IPD).',
    },
  },
];
