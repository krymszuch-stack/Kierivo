import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MOBILITY_PREFERENCES,
  NOMINAL_MONTHLY_HOURS,
  benefitPackageValue,
  benefitSourcesFromOffer,
  buildAdvisorNote,
  calculateFeasibility,
  detectBenefits,
  effectiveOfficeDays,
  estimateNetFromGross,
  monthlyCommuteHours,
  monthlyNetIncome,
  canShowFeasibilityResult,
  type MobilityPreferences,
} from '../commuteCalculator';

const prefs = (overrides: Partial<MobilityPreferences> = {}): MobilityPreferences => ({
  ...DEFAULT_MOBILITY_PREFERENCES,
  salaryAmount: 10_000,
  ...overrides,
});

describe('przeliczenie wynagrodzenia', () => {
  it('liczy netto z brutto na UoP w okolicach kwoty z kalkulatorów płacowych', () => {
    // 10 000 zł brutto to ok. 7,2 tys. na rękę. Sprawdzamy widełki, nie punkt:
    // test ma pilnować rzędu wielkości, a nie zamrażać stawki podatkowe.
    const net = estimateNetFromGross(10_000);
    expect(net).toBeGreaterThan(7_000);
    expect(net).toBeLessThan(7_500);
  });

  it('nie zgaduje podatku przy B2B — bierze kwotę podaną przez użytkownika', () => {
    expect(monthlyNetIncome(prefs({ contract: 'B2B', salaryAmount: 12_000 }))).toBe(12_000);
  });

  it('ujemna albo pusta kwota daje zero, nie NaN', () => {
    expect(estimateNetFromGross(0)).toBe(0);
    expect(estimateNetFromGross(Number.NaN)).toBe(0);
  });
});

describe('czas i koszt dojazdu', () => {
  it('praca zdalna zeruje dni w biurze mimo ustawionego suwaka', () => {
    expect(effectiveOfficeDays(prefs({ workMode: 'REMOTE', officeDaysPerWeek: 4 }))).toBe(0);
    expect(monthlyCommuteHours(prefs({ workMode: 'REMOTE', officeDaysPerWeek: 4 }))).toBe(0);
  });

  it('stacjonarna to zawsze pięć dni', () => {
    expect(effectiveOfficeDays(prefs({ workMode: 'ONSITE', officeDaysPerWeek: 1 }))).toBe(5);
  });

  it('liczy godziny w drodze w obie strony', () => {
    // 3 dni × 60 min tam i z powrotem × 4,2 tygodnia = 12,6 h
    expect(
      monthlyCommuteHours(prefs({ workMode: 'HYBRID', officeDaysPerWeek: 3, oneWayMinutes: 30 }))
    ).toBeCloseTo(12.6, 5);
  });

  it('nie nalicza kosztu dojazdu przy pracy zdalnej', () => {
    const result = calculateFeasibility(
      prefs({ workMode: 'REMOTE', monthlyCommuteCost: 500 })
    );
    expect(result?.commuteCost).toBe(0);
    expect(result?.realHourlyRate).toBeCloseTo(result!.nominalHourlyRate, 10);
  });
});

describe('realna stawka godzinowa', () => {
  it('nie pokazuje wyliczenia na niepotwierdzonych, domyślnych ustawieniach dojazdu', () => {
    const preferences = prefs({ salaryAmount: 10_000 });

    expect(canShowFeasibilityResult(preferences, false)).toBe(false);
    expect(canShowFeasibilityResult(preferences, true)).toBe(true);
    expect(canShowFeasibilityResult(prefs({ salaryAmount: 0 }), true)).toBe(false);
  });

  it('jest niższa od pozornej, gdy trzeba dojeżdżać', () => {
    const result = calculateFeasibility(
      prefs({ workMode: 'ONSITE', oneWayMinutes: 45, monthlyCommuteCost: 400 })
    );

    expect(result).not.toBeNull();
    expect(result!.realHourlyRate).toBeLessThan(result!.nominalHourlyRate);
    expect(result!.hourlyRateLoss).toBeGreaterThan(0);
    expect(result!.commuteWorkdays).toBeCloseTo(result!.commuteHours / 8, 10);
  });

  it('pozorna stawka to netto podzielone przez etat', () => {
    const result = calculateFeasibility(prefs({ contract: 'B2B', salaryAmount: 16_800 }));
    expect(result!.nominalHourlyRate).toBeCloseTo(16_800 / NOMINAL_MONTHLY_HOURS, 10);
  });

  it('bez podanej kwoty zwraca null zamiast zera', () => {
    expect(calculateFeasibility(prefs({ salaryAmount: 0 }))).toBeNull();
  });

  it('podaje, ile odzyskuje jeden dzień zdalny więcej', () => {
    const result = calculateFeasibility(
      prefs({ workMode: 'HYBRID', officeDaysPerWeek: 3, oneWayMinutes: 45, monthlyCommuteCost: 300 })
    );

    expect(result!.savingsPerRemoteDay?.hours).toBeCloseTo(6.3, 5);
    expect(result!.savingsPerRemoteDay?.cost).toBeCloseTo(100, 5);
  });
});

describe('rozpoznawanie benefitów', () => {
  it('wykrywa pakiet socjalny i uprawnienia w treści oferty dla montera', () => {
    const offer = {
      description:
        'Oferujemy: prywatna opieka medyczna LuxMed, karta MultiSport, dofinansowanie do posiłków. ' +
        'Wymagamy prawo jazdy kat. B oraz uprawnień SEP do 1 kV.',
      requirements: ['SEP E1', 'UDT'],
    };

    const detected = detectBenefits(benefitSourcesFromOffer(offer));
    const status = Object.fromEntries(detected.map((item) => [item.key, item.status]));

    expect(status.MEDICAL).toBe('PROVIDED');
    expect(status.SPORT).toBe('PROVIDED');
    expect(status.FOOD).toBe('PROVIDED');
    expect(status.DRIVING_LICENSE).toBe('PROVIDED');
    expect(status.EQUIPMENT).toBe('MISSING');
  });

  it('nie wlicza prawa jazdy do wartości pakietu — to wymaganie, nie benefit', () => {
    const detected = detectBenefits(['Wymagane prawo jazdy kat. C']);
    expect(benefitPackageValue(detected)).toBe(0);
  });

  it('sumuje wyłącznie wyceniane pozycje faktycznie obecne w ofercie', () => {
    const detected = detectBenefits(['Zapewniamy Medicover i kartę MultiSport']);
    // 180 (medyczne) + 150 (sport)
    expect(benefitPackageValue(detected)).toBe(330);
  });

  it('wykrywa pakiety marek prywatnych: PZU, Luxmed, MultiSport, MyBenefit, Kawa i Owoce', () => {
    const offer = {
      description:
        'Zapewniamy: abonament PZU Sport lub MultiSport, opiekę medyczną LuxMed, ' +
        'dostęp do kafeterii MyBenefit (150 pkt/mies.), darmową kawę z ekspresu i owocowe czwartki.',
    };

    const detected = detectBenefits(benefitSourcesFromOffer(offer));
    const byKey = Object.fromEntries(detected.map((item) => [item.key, item]));

    expect(byKey.SPORT?.status).toBe('PROVIDED');
    expect(byKey.MEDICAL?.status).toBe('PROVIDED');
    expect(byKey.MYBENEFIT?.status).toBe('PROVIDED');
    expect(byKey.COFFEE?.status).toBe('PROVIDED');
    expect(byKey.FRUITS?.status).toBe('PROVIDED');

    expect(byKey.MEDICAL?.brandKey).toBe('luxmed');
    expect(byKey.MYBENEFIT?.brandKey).toBe('mybenefit');
  });

  it('pusta oferta nie generuje benefitów z powietrza', () => {
    const detected = detectBenefits([undefined, null, '   ']);
    expect(detected.every((item) => item.status === 'MISSING')).toBe(true);
    expect(benefitPackageValue(detected)).toBe(0);
  });

  it('nie wycenia benefitów, których brak oferta jawnie deklaruje', () => {
    const detected = detectBenefits([
      'Zapewniamy prywatną opiekę medyczną LuxMed. Nie zapewniamy karty MultiSport.',
      'Brak dofinansowania szkoleń. Pracodawca nie zapewnia laptopa.',
    ]);
    const byKey = Object.fromEntries(detected.map((item) => [item.key, item]));

    expect(byKey.MEDICAL?.status).toBe('PROVIDED');
    expect(byKey.SPORT?.status).toBe('MISSING');
    expect(byKey.TRAINING?.status).toBe('MISSING');
    expect(byKey.EQUIPMENT?.status).toBe('MISSING');
    expect(benefitPackageValue(detected)).toBe(180);
  });

  it.each([
    ['MultiSport', 'Karta MultiSport nie jest dostępna.'],
    ['opieka medyczna', 'Brak prywatnej opieki medycznej.'],
    ['szkolenia', 'Nie oferujemy budżetu szkoleniowego.'],
  ])('negacja benefitu „%s” nie staje się pozytywnym dowodem', (_name, source) => {
    const detected = detectBenefits([source]);
    expect(detected.every((item) => item.status === 'MISSING')).toBe(true);
    expect(benefitPackageValue(detected)).toBe(0);
  });
});

describe('notatka doradcy', () => {
  it('przy pracy zdalnej mówi o zachowanym czasie, nie o stracie', () => {
    const preferences = prefs({ workMode: 'REMOTE' });
    const note = buildAdvisorNote(calculateFeasibility(preferences)!, preferences);

    expect(note.headline).toMatch(/Zdalnie/);
    expect(note.tactic.length).toBeGreaterThan(20);
  });

  it('przy dojazdach podaje konkretną taktykę na rozmowę', () => {
    const preferences = prefs({ workMode: 'ONSITE', oneWayMinutes: 60, monthlyCommuteCost: 500 });
    const note = buildAdvisorNote(calculateFeasibility(preferences)!, preferences);

    expect(note.body).toMatch(/zł\/h/);
    expect(note.tactic).toMatch(/dzień zdalny/);
  });

  it('nie porównuje oferty do rynku, bo takich danych nie mamy', () => {
    const preferences = prefs({ workMode: 'HYBRID' });
    const note = buildAdvisorNote(calculateFeasibility(preferences)!, preferences);

    expect(`${note.headline} ${note.body} ${note.tactic}`).not.toMatch(/rynkow|średni[aej]/i);
  });
});
