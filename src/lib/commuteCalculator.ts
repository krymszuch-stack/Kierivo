/**
 * Kalkulator opłacalności oferty: realna stawka za godzinę życia.
 *
 * Cała matematyka jest tutaj, poza komponentem, bo testy tego projektu biegną
 * w Node bez DOM-u (patrz `AGENTS.md`). Widżet ma zostać cienką warstwą, która
 * tylko podaje liczby do tych funkcji i rysuje wynik.
 *
 * Zasada nadrzędna: **nic tu nie jest zmyślone**. Podatki liczymy prawdziwym
 * algorytmem UoP, a nie mnożnikiem „×0,72". Wyceny pakietów socjalnych to
 * jawnie oznaczone **założenia** wystawione w `BENEFIT_ASSUMPTIONS` — interfejs
 * musi je pokazywać jako założenia, a nie jako pomiar, i pozwalać je nadpisać.
 * Czego nie wiemy, tego nie zgadujemy: brak danych zwraca `null`, nie liczbę.
 */

import type { ParsedJobDescription } from './jdParser';

/** Etat w miesiącu wg Kodeksu pracy w przybliżeniu rocznej średniej. */
export const NOMINAL_MONTHLY_HOURS = 168;

/** Średnia liczba tygodni roboczych w miesiącu (52 / 12 ≈ 4,33; ostrożnie 4,2). */
export const WEEKS_PER_MONTH = 4.2;

export type ContractType = 'UOP' | 'B2B';
export type WorkMode = 'REMOTE' | 'HYBRID' | 'ONSITE';

export interface MobilityPreferences {
  /** Kwota z oferty w złotych miesięcznie: brutto dla UoP, netto dla B2B. */
  salaryAmount: number;
  contract: ContractType;
  workMode: WorkMode;
  /** Ile dni w tygodniu w biurze. Dla REMOTE zawsze 0, dla ONSITE 5. */
  officeDaysPerWeek: number;
  /** Dojazd w jedną stronę, w minutach (10–90 w interfejsie). */
  oneWayMinutes: number;
  /** Paliwo, bilety, parking — złotych miesięcznie. */
  monthlyCommuteCost: number;
  /** Miasto zamieszkania (np. "Tarnów", "Chorzów", "Gdańsk"). */
  homeCity?: string;
  /** Miasto lokalizacji biura/pracy (np. "Kraków", "Warszawa", "Katowice"). */
  officeCity?: string;
  /** Obliczona odległość drogowa w km. */
  roadDistanceKm?: number;
}

export const DEFAULT_MOBILITY_PREFERENCES: MobilityPreferences = {
  salaryAmount: 0,
  contract: 'UOP',
  workMode: 'HYBRID',
  officeDaysPerWeek: 3,
  oneWayMinutes: 30,
  monthlyCommuteCost: 300,
};

/**
 * Ustawienia startowe są jedynie punktem wejścia do formularza. Wynik
 * finansowy pokazujemy dopiero po podaniu pensji i jawnym potwierdzeniu
 * sprawdzonych założeń o umowie i dojazdach.
 */
export function canShowFeasibilityResult(
  prefs: MobilityPreferences,
  assumptionsConfirmed: boolean
): boolean {
  return assumptionsConfirmed && Number.isFinite(prefs.salaryAmount) && prefs.salaryAmount > 0;
}

import { getGeoDistanceRegistry } from './geoDistance';

/**
 * Automatycznie wylicza czas, koszty paliwa i odległość na podstawie miast z bazy geoDistance.
 */
export function autoCalculateCommuteFromCities(
  homeCity: string,
  officeCity: string,
  workMode: WorkMode = 'HYBRID',
  officeDaysPerWeek = 3
): {
  oneWayMinutes: number;
  monthlyCommuteCost: number;
  roadDistanceKm: number;
  directDistanceKm: number;
  corridorDescription: string;
} | null {
  const calculation = getGeoDistanceRegistry().calculateCommute(homeCity, officeCity);
  if (!calculation) return null;

  const officeDays =
    workMode === 'REMOTE' ? 0 : workMode === 'ONSITE' ? 5 : Math.min(5, Math.max(0, officeDaysPerWeek));
  const monthlyCost = Math.round(
    calculation.estimatedFuelCostOneWayPln * 2 * officeDays * WEEKS_PER_MONTH
  );

  return {
    oneWayMinutes: calculation.estimatedDriveTimeMinutes,
    monthlyCommuteCost: monthlyCost,
    roadDistanceKm: calculation.roadDistanceKm,
    directDistanceKm: calculation.directDistanceKm,
    corridorDescription: calculation.corridorDescription,
  };
}

/* ------------------------------------------------------------------ */
/* Podatki i składki                                                   */
/* ------------------------------------------------------------------ */

/** Składki pracownika: emerytalna 9,76% + rentowa 1,5% + chorobowa 2,45%. */
const ZUS_EMPLOYEE_RATE = 0.0976 + 0.015 + 0.0245;
const HEALTH_RATE = 0.09;
const PIT_RATE = 0.12;
/** Miesięczne koszty uzyskania przychodu — wariant podstawowy. */
const TAX_DEDUCTIBLE_COSTS = 250;
/** 1/12 kwoty zmniejszającej podatek (3600 zł rocznie) przy złożonym PIT-2. */
const MONTHLY_TAX_RELIEF = 300;

/**
 * Netto „na rękę" z kwoty brutto na umowie o pracę.
 *
 * Uproszczenia, których świadomie nie ukrywamy: pierwszy próg skali (12%),
 * podstawowe KUP, złożony PIT-2, brak PPK i brak ulg szczególnych. Dla drugiego
 * progu i dla PPK wynik będzie zawyżony — dlatego interfejs pisze „szacunek".
 */
export function estimateNetFromGross(gross: number): number {
  if (!Number.isFinite(gross) || gross <= 0) return 0;

  const zus = gross * ZUS_EMPLOYEE_RATE;
  const afterZus = gross - zus;
  const health = afterZus * HEALTH_RATE;
  const taxBase = Math.max(0, Math.round(afterZus - TAX_DEDUCTIBLE_COSTS));
  const advance = Math.max(0, Math.round(taxBase * PIT_RATE - MONTHLY_TAX_RELIEF));

  return Math.max(0, afterZus - health - advance);
}

/**
 * Kwota na rękę zależnie od formy zatrudnienia.
 *
 * Dla B2B **nie liczymy** ZUS-u ani podatku: stawka ryczałtu, forma
 * opodatkowania i preferencyjne składki są indywidualne, a zgadnięcie ich
 * dałoby liczbę wyglądającą na pomiar. Użytkownik B2B podaje kwotę, która
 * faktycznie zostaje mu w kieszeni.
 */
export function monthlyNetIncome(prefs: MobilityPreferences): number {
  return prefs.contract === 'UOP'
    ? estimateNetFromGross(prefs.salaryAmount)
    : Math.max(0, prefs.salaryAmount);
}

/* ------------------------------------------------------------------ */
/* Czas w drodze                                                       */
/* ------------------------------------------------------------------ */

/** Dni w biurze wynikające z trybu pracy; hybryda bierze wybór użytkownika. */
export function effectiveOfficeDays(prefs: MobilityPreferences): number {
  if (prefs.workMode === 'REMOTE') return 0;
  if (prefs.workMode === 'ONSITE') return 5;
  return Math.min(5, Math.max(0, prefs.officeDaysPerWeek));
}

/** Godziny miesięcznie spędzone w drodze — w obie strony. */
export function monthlyCommuteHours(prefs: MobilityPreferences): number {
  const days = effectiveOfficeDays(prefs);
  return (days * (prefs.oneWayMinutes * 2) * WEEKS_PER_MONTH) / 60;
}

/** Koszt dojazdu naliczamy tylko wtedy, gdy ktoś faktycznie dojeżdża. */
export function effectiveCommuteCost(prefs: MobilityPreferences): number {
  return effectiveOfficeDays(prefs) === 0 ? 0 : Math.max(0, prefs.monthlyCommuteCost);
}

/* ------------------------------------------------------------------ */
/* Benefity                                                            */
/* ------------------------------------------------------------------ */

export type BenefitKey =
  | 'SPORT'
  | 'SPORT_MULTISPORT'
  | 'SPORT_PZU'
  | 'SPORT_MEDICOVER'
  | 'MEDICAL'
  | 'MEDICAL_LUXMED'
  | 'MEDICAL_MEDICOVER'
  | 'MEDICAL_PZU'
  | 'MEDICAL_ENELMED'
  | 'MYBENEFIT'
  | 'FOOD'
  | 'FOOD_LUNCH'
  | 'FRUITS'
  | 'COFFEE'
  | 'WELLBEING'
  | 'TRAINING'
  | 'INSURANCE'
  | 'DRIVING_LICENSE'
  | 'COMMUTE'
  | 'EQUIPMENT';

export interface BenefitAssumption {
  key: BenefitKey;
  label: string;
  /**
   * Ile trzeba by wydać z własnej kieszeni miesięcznie. To **założenie**
   * kalkulatora, nie dana z oferty — interfejs ma je oznaczyć i pozwolić
   * odznaczyć pozycję, jeśli użytkownik i tak by z niej nie skorzystał.
   * `null` znaczy „nie da się wycenić pieniędzmi" (np. uprawnienia).
   */
  monthlyValue: number | null;
  /** Skąd ta liczba — pokazywane w dymku, żeby nie udawała pomiaru. */
  basis: string;
  /** Frazy z ogłoszenia, po których rozpoznajemy benefit. */
  keywords: string[];
  /** Domyślny klucz marki do pobierania logotypu. */
  defaultBrandKey?: string;
}

export const BENEFIT_ASSUMPTIONS: readonly BenefitAssumption[] = [
  {
    key: 'SPORT',
    label: 'Karta sportowa / MultiSport / PZU Sport',
    monthlyValue: 150,
    basis: 'Założenie: abonament sportowy w wariancie podstawowym (MultiSport, PZU Sport, Medicover Sport).',
    keywords: ['multisport', 'pzu sport', 'medicover sport', 'karta sportowa', 'karty sportow', 'siłowni', 'fitprofit', 'benefit systems', 'karnet sportow', 'aktywność fizyczn'],
    defaultBrandKey: 'multisport',
  },
  {
    key: 'MEDICAL',
    label: 'Opieka medyczna / LuxMed / Medicover / PZU',
    monthlyValue: 180,
    basis: 'Założenie: prywatny pakiet medyczny dla jednej osoby (LuxMed, Medicover, PZU Zdrowie, Enel-Med).',
    keywords: ['luxmed', 'lux med', 'medicover', 'pzu zdrowie', 'enel-med', 'enelmed', 'opieka medyczna', 'opiekę medyczn', 'opieki medyczn', 'prywatna opieka', 'pakiet medyczny', 'pakiet zdrowotn'],
    defaultBrandKey: 'luxmed',
  },
  {
    key: 'MYBENEFIT',
    label: 'Kafeteria MyBenefit / Punkty',
    monthlyValue: 150,
    basis: 'Założenie: miesięczny budżet punktowy na platformie kafeteryjnej MyBenefit.',
    keywords: ['mybenefit', 'my benefit', 'kafeteria benefit', 'system kafeteryjny', 'punkty kafeteryjne', 'platforma benefitowa', 'kafeteri'],
    defaultBrandKey: 'mybenefit',
  },
  {
    key: 'FOOD',
    label: 'Karta Lunch / Posiłki',
    monthlyValue: 300,
    basis: 'Założenie: dofinansowanie lunchu i posiłków w dni robocze (Sodexo, Edenred).',
    keywords: ['karta lunch', 'lunch', 'posiłk', 'kantyn', 'sodexo', 'edenred', 'pluxee', 'dofinansowanie do posiłków', 'obiad'],
    defaultBrandKey: 'sodexo',
  },
  {
    key: 'FRUITS',
    label: 'Świeże owoce & Przekąski',
    monthlyValue: 60,
    basis: 'Założenie: świeże owoce, soki i zdrowe przekąski w biurze.',
    keywords: ['owocowe czwartki', 'owoce w biurze', 'świeże owoce', 'owocowe wtorki', 'owocowe dni', 'zdrowe przekąski', 'owoc'],
  },
  {
    key: 'COFFEE',
    label: 'Kawa Specialty & Herbata',
    monthlyValue: 80,
    basis: 'Założenie: nielimitowana kawa z ekspresu ciśnieniowego / specialty i herbata w biurze.',
    keywords: ['kawa', 'kawę', 'kawy', 'ekspres', 'herbat', 'barista', 'kawa specialty', 'darmowa kawa'],
  },
  {
    key: 'WELLBEING',
    label: 'Wellbeing & Psycholog',
    monthlyValue: 120,
    basis: 'Założenie: konsultacje psychologiczne i program wsparcia pracowników (EAP / Mindgram).',
    keywords: ['mindgram', 'psycholog', 'wsparcie psychologiczne', 'wellbeing', 'zdrowie psychiczne', 'program wsparcia pracowników', 'eap'],
    defaultBrandKey: 'mindgram',
  },
  {
    key: 'TRAINING',
    label: 'Budżet szkoleniowy & Certyfikaty',
    monthlyValue: 200,
    basis: 'Założenie: roczny budżet szkoleniowy i dofinansowanie certyfikacji rozbite na miesiące.',
    keywords: ['budżet szkoleniowy', 'szkolenia', 'szkoleń', 'dofinansowanie kursów', 'certyfikat', 'konferencje', 'udemy', 'coursera'],
  },
  {
    key: 'INSURANCE',
    label: 'Ubezpieczenie na życie',
    monthlyValue: 90,
    basis: 'Założenie: grupowe ubezpieczenie na życie (PZU, Warta, Nationale-Nederlanden).',
    keywords: ['ubezpieczenie na życie', 'ubezpieczenie grupowe', 'pzu życie', 'ubezpieczenie nnw', 'polisa na życie'],
    defaultBrandKey: 'pzu',
  },
  {
    key: 'EQUIPMENT',
    label: 'Sprzęt i biurko',
    monthlyValue: 120,
    basis: 'Założenie: laptop i budżet na biurko rozłożone na 24 miesiące.',
    keywords: ['laptop', 'macbook', 'sprzęt', 'budżet na', 'home office', 'stanowisko pracy', 'monitor'],
  },
  {
    key: 'COMMUTE',
    label: 'Dojazd / parking',
    monthlyValue: 200,
    basis: 'Założenie: bilet okresowy albo miejsce parkingowe.',
    keywords: ['parking', 'bilet', 'dojazd', 'samochód służbowy', 'auto służbowe', 'zwrot kosztów dojazdu'],
  },
  {
    key: 'DRIVING_LICENSE',
    label: 'Prawo jazdy & Uprawnienia',
    monthlyValue: null,
    basis: 'To wymaganie oferty, nie benefit — nie wliczamy go do wartości pakietu.',
    keywords: ['prawo jazdy', 'kat. b', 'kategorii b', 'kat.b', 'kategoria b', 'kat. c', 'sep', 'udt'],
  },
] as const;

export type BenefitStatus = 'PROVIDED' | 'MISSING';

export interface DetectedBenefit {
  key: BenefitKey;
  label: string;
  status: BenefitStatus;
  monthlyValue: number | null;
  basis: string;
  /** Fragment ogłoszenia, który uruchomił dopasowanie — dowód, nie domysł. */
  matchedPhrase: string | null;
  /** Klucz marki (np. 'luxmed', 'pzu', 'multisport', 'mybenefit', 'sodexo') do pobrania logotypu. */
  brandKey?: string;
}

function normalizeBenefitText(text: string): string {
  return text
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Samo słowo nie dowodzi, że pracodawca benefit zapewnia: w ogłoszeniach
 * często pojawia się też w przeczeniach („brak MultiSport”, „nie zapewniamy
 * laptopa”). Oceniamy negację tylko w klauzuli z trafieniem, by osobna oferta
 * innego benefitu nie unieważniała poprawnego, pozytywnego wskazania.
 */
function findPositiveBenefitKeyword(haystack: string, keywords: readonly string[]): string | null {
  const normalized = normalizeBenefitText(haystack);

  for (const keyword of keywords) {
    const needle = normalizeBenefitText(keyword);
    let searchFrom = 0;
    let index = normalized.indexOf(needle, searchFrom);

    while (index >= 0) {
      const clauseStart = Math.max(
        normalized.lastIndexOf('\n', index),
        normalized.lastIndexOf(';', index),
        normalized.lastIndexOf('.', index),
        normalized.lastIndexOf('!', index),
        normalized.lastIndexOf('?', index),
      ) + 1;
      const clauseEndCandidates = ['\n', ';', '.', '!', '?']
        .map((boundary) => normalized.indexOf(boundary, index + needle.length))
        .filter((boundaryIndex) => boundaryIndex >= 0);
      const clauseEnd = clauseEndCandidates.length > 0 ? Math.min(...clauseEndCandidates) : normalized.length;
      const before = normalized.slice(clauseStart, index);
      const after = normalized.slice(index + needle.length, clauseEnd);
      const negatedBefore = /\bnie\s+(?!tylko\b)[^.!?;\n]{0,55}$|\bbrak(?:\s+[^.!?;\n]{0,40})?$/i.test(before);
      const negatedAfter = /^\s*(?:nie\s+(?:jest|sa|bedzie|beda|zostanie|zostana|obejmuje|zapewnia|oferuje)|niedostepn\w*|brak\b)[^.!?;\n]{0,45}/i.test(after);

      if (!negatedBefore && !negatedAfter) return keyword;
      searchFrom = index + needle.length;
      index = normalized.indexOf(needle, searchFrom);
    }
  }

  return null;
}

/**
 * Rozpoznaje powiązaną markę na podstawie dopasowanej frazy.
 */
function resolveBrandKey(matchedPhrase: string | null, defaultBrandKey?: string): string | undefined {
  if (!matchedPhrase) return defaultBrandKey;
  const p = matchedPhrase.toLowerCase();
  if (p.includes('multisport') || p.includes('benefit systems')) return 'multisport';
  if (p.includes('pzu')) return 'pzu';
  if (p.includes('luxmed') || p.includes('lux med')) return 'luxmed';
  if (p.includes('medicover')) return 'medicover';
  if (p.includes('enel')) return 'enelmed';
  if (p.includes('mybenefit') || p.includes('my benefit')) return 'mybenefit';
  if (p.includes('sodexo') || p.includes('pluxee')) return 'sodexo';
  if (p.includes('edenred')) return 'edenred';
  if (p.includes('mindgram')) return 'mindgram';
  return defaultBrandKey;
}

/**
 * Rozpoznanie benefitów w treści oferty.
 *
 * Jedno miejsce, jedna lista fraz (reguła 3): parser ogłoszeń i ten kalkulator
 * nie mogą mieć dwóch różnych zdań na temat tego, czy w ofercie jest MultiSport.
 */
export function detectBenefits(sources: Array<string | undefined | null>): DetectedBenefit[] {
  const haystack = sources
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .join(' \n ')
    .toLowerCase();

  return BENEFIT_ASSUMPTIONS.map((assumption) => {
    const matched = findPositiveBenefitKeyword(haystack, assumption.keywords);
    const brandKey = resolveBrandKey(matched, assumption.defaultBrandKey);

    return {
      key: assumption.key,
      label: assumption.label,
      status: matched ? ('PROVIDED' as const) : ('MISSING' as const),
      monthlyValue: assumption.monthlyValue,
      basis: assumption.basis,
      matchedPhrase: matched,
      brandKey,
    };
  });
}

/** Zbiera teksty oferty, w których szukamy benefitów. */
export function benefitSourcesFromOffer(
  offer: { description?: string; requirements?: string[]; tags?: string[] },
  parsed?: ParsedJobDescription | null
): string[] {
  return [
    offer.description ?? '',
    (offer.requirements ?? []).join(' '),
    (offer.tags ?? []).join(' '),
    (parsed?.benefits ?? []).join(' '),
    (parsed?.perksAndPlusy ?? []).join(' '),
  ].filter((entry) => entry.trim().length > 0);
}

/** Suma wycenionych, faktycznie zapewnionych pozycji pakietu. */
export function benefitPackageValue(benefits: DetectedBenefit[]): number {
  return benefits.reduce(
    (sum, benefit) =>
      benefit.status === 'PROVIDED' && benefit.monthlyValue !== null
        ? sum + benefit.monthlyValue
        : sum,
    0
  );
}

/* ------------------------------------------------------------------ */
/* Wynik                                                               */
/* ------------------------------------------------------------------ */

export interface FeasibilityResult {
  netMonthly: number;
  /** Stawka, którą widać w ogłoszeniu: netto / 168 h. Pozorna. */
  nominalHourlyRate: number;
  /** Stawka po odjęciu kosztów dojazdu i doliczeniu godzin w drodze. */
  realHourlyRate: number;
  /** Ile złotych na godzinę zjada dojazd. */
  hourlyRateLoss: number;
  commuteHours: number;
  commuteCost: number;
  /** Godziny w drodze przeliczone na 8-godzinne dni robocze. */
  commuteWorkdays: number;
  benefitValue: number;
  /** Realna stawka, gdy doliczyć wartość pakietu socjalnego. */
  realHourlyRateWithBenefits: number;
  /** Ile miesięcznie odzyskuje jeden dzień pracy zdalnej więcej. */
  savingsPerRemoteDay: { hours: number; cost: number } | null;
}

export function calculateFeasibility(
  prefs: MobilityPreferences,
  benefits: DetectedBenefit[] = []
): FeasibilityResult | null {
  const netMonthly = monthlyNetIncome(prefs);
  // Bez kwoty nie ma czego liczyć. Zero zamiast `null` byłoby stwierdzeniem,
  // że ta praca jest darmowa — a to nieprawda, tylko brak danych.
  if (netMonthly <= 0) return null;

  const commuteHours = monthlyCommuteHours(prefs);
  const commuteCost = effectiveCommuteCost(prefs);
  const benefitValue = benefitPackageValue(benefits);

  const nominalHourlyRate = netMonthly / NOMINAL_MONTHLY_HOURS;
  const realHourlyRate = (netMonthly - commuteCost) / (NOMINAL_MONTHLY_HOURS + commuteHours);
  const realHourlyRateWithBenefits =
    (netMonthly - commuteCost + benefitValue) / (NOMINAL_MONTHLY_HOURS + commuteHours);

  const days = effectiveOfficeDays(prefs);
  const savingsPerRemoteDay =
    days > 0
      ? {
          hours: (prefs.oneWayMinutes * 2 * WEEKS_PER_MONTH) / 60,
          cost: commuteCost / days,
        }
      : null;

  return {
    netMonthly,
    nominalHourlyRate,
    realHourlyRate,
    hourlyRateLoss: nominalHourlyRate - realHourlyRate,
    commuteHours,
    commuteCost,
    commuteWorkdays: commuteHours / 8,
    benefitValue,
    realHourlyRateWithBenefits,
    savingsPerRemoteDay,
  };
}

/* ------------------------------------------------------------------ */
/* Notatka doradcy                                                     */
/* ------------------------------------------------------------------ */

export interface AdvisorNote {
  headline: string;
  body: string;
  /** Konkretna rzecz do zrobienia na rozmowie. Zawsze wykonalna. */
  tactic: string;
}

const zl = (value: number) => `${Math.round(value).toLocaleString('pl-PL')} zł`;
const h = (value: number) => value.toFixed(0);

/**
 * Życzliwy doradca, nie recenzent.
 *
 * Notatka jest deterministyczna i zbudowana wyłącznie z liczb policzonych
 * wyżej. Świadomie nie ma tu porównań w rodzaju „o 15% lepiej niż rynek":
 * nie mamy danych o rynku dla tego stanowiska, więc taka zdanie byłoby
 * wymyślone (reguła 1). Gdy zbierzemy je z wiedzy zbiorowej, dopiszemy je
 * jako osobne, oznaczone źródło.
 */
export function buildAdvisorNote(
  result: FeasibilityResult,
  prefs: MobilityPreferences
): AdvisorNote {
  const days = effectiveOfficeDays(prefs);

  if (days === 0) {
    return {
      headline: 'Zdalnie — Twój czas zostaje u Ciebie',
      body: `Bez dojazdów Twoja stawka to ${result.realHourlyRate.toFixed(2)} zł za godzinę i nic jej nie uszczupla. Pakiet dokłada ${zl(result.benefitValue)} miesięcznie wartości, której nie widać w kwocie na umowie.`,
      tactic:
        'Zapytaj wprost, czy tryb zdalny jest zapisany w umowie, czy tylko w praktyce zespołu — to pytanie jest normalne i dobrze świadczy o kandydacie.',
    };
  }

  const lossShare = result.nominalHourlyRate
    ? (result.hourlyRateLoss / result.nominalHourlyRate) * 100
    : 0;

  const body =
    `Na papierze wychodzi ${result.nominalHourlyRate.toFixed(2)} zł/h. Po doliczeniu ${h(result.commuteHours)} godzin miesięcznie w drodze ` +
    `(równowartość ${result.commuteWorkdays.toFixed(1)} dnia roboczego) i ${zl(result.commuteCost)} kosztów dojazdu ` +
    `zostaje ${result.realHourlyRate.toFixed(2)} zł za godzinę Twojego życia — o ${lossShare.toFixed(0)}% mniej.`;

  const tactic = result.savingsPerRemoteDay
    ? `Jeden dodatkowy dzień zdalny w tygodniu odzyskuje ${h(result.savingsPerRemoteDay.hours)} godzin i ${zl(result.savingsPerRemoteDay.cost)} miesięcznie. To zwykle łatwiejsze do wynegocjowania niż podwyżka o tę samą kwotę — i warto o to poprosić na drugiej rozmowie, gdy już Cię chcą.`
    : 'Zapytaj o elastyczne godziny — wyjazd poza szczyt potrafi skrócić dojazd bardziej niż jakikolwiek dodatek do pensji.';

  const headline =
    lossShare >= 20
      ? 'Oferta warta rozmowy, ale dojazd kosztuje sporo'
      : 'Bilans wychodzi na plus';

  return { headline, body, tactic };
}
