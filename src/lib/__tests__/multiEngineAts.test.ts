import { describe, it, expect } from 'vitest';
import { simulateMultiEngineATS, calculateMedian, extractDynamicJdPhrases } from '../atsSimulator';
import { auditKnockouts } from '../knockouts';
import { analyzeDrillResponse } from '../drillEngine';
import { MasterVault } from '../../types';
import { createEmptyVault } from '../sampleVault';

describe('Multi-Engine ATS Consensus & Engine Enhancements Suite', () => {
  it('nie ocenia dopasowania przy ofercie bez rozpoznanych wymagan', () => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.test');
    vault.personalInfo.title = 'Analityk danych';
    vault.personalInfo.summary = 'Analityk z doświadczeniem w raportowaniu i automatyzacji procesów.';
    vault.skillsMatrix.hardSkills = ['SQL', 'Python'];
    vault.history = [{
      id: 'synthetic-analysis-role', company: 'Firma testowa', role: 'Analityk danych', location: 'Warszawa',
      startDate: '2020-01', endDate: '2024-01', isCurrent: false,
      description: 'Przygotowywałem raporty i analizowałem procesy operacyjne.',
      highlights: [{ id: 'synthetic-analysis-highlight', text: 'Automatyzowałem raporty SQL.', action: '', target: '', tool: 'SQL', metric: '', keywords: [] }],
    }];
    const offer = 'Dołącz do naszego zespołu w Warszawie. Oferujemy stabilne zatrudnienie, rozwój i pracę hybrydową.';
    const result = simulateMultiEngineATS(vault, offer, vault.personalInfo.title);

    expect(result.careerFitAdvice.assessment).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.consensusGrade).toBe('INSUFFICIENT_DATA');
    expect(result.summaryJustification).toContain('nie tworza wyniku dopasowania');
  });
  it('nie wyciąga słowa "wymagane" jako umiejętności z nagłówka zdania', () => {
    const extracted = extractDynamicJdPhrases(
      'Wymagane aktualne uprawnienia SEP G1 do 1 kV. Wymagane doświadczenie z Python.'
    );

    expect(extracted.hardSkills.map(({ phrase }) => phrase)).toContain('python');
    expect(extracted.hardSkills.map(({ phrase }) => phrase)).not.toContain('wymagane');
  });

  const sampleVault: MasterVault = {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    profiler: {
      flags: [],
      languages: [{ id: 'lang_1', language: 'Angielski', level: 'C1', context: 'Biegle w mowie i piśmie' }],
      licenses: ['c_license', 'sep_above_1kv', 'udt_forklift'],
      experienceLevel: 'SENIOR',
      location: { city: 'Warszawa', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: true },
    },
    personalInfo: {
      fullName: 'Aleksandra Nowacka',
      title: 'Starszy Inżynier Chmurowy i DevOps',
      email: 'a.nowacka@cloudtech.pl',
      phone: '+48 600 700 800',
      location: 'Warszawa',
      summary: 'Ekspert chmurowy i automatyzacji z 8-letnim doświadczeniem w Kubernetes i AWS.',
    },
    skillsMatrix: {
      hardSkills: ['Kubernetes', 'AWS', 'Terraform', 'Docker', 'Python', 'CI/CD', 'Linux'],
      softSkills: ['Team Leadership', 'Mentoring'],
      toolsAndTech: ['Prometheus', 'Grafana', 'GitLab CI', 'Helm'],
      certifications: [
        { id: 'cert_1', name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services', date: '2022-05' },
        { id: 'cert_2', name: 'Certified Kubernetes Administrator (CKA)', issuer: 'Linux Foundation', date: '2023-01' },
      ],
    },
    history: [
      {
        id: 'exp_1',
        company: 'CloudScale S.A.',
        role: 'Starszy Inżynier Chmurowy i DevOps',
        location: 'Warszawa',
        startDate: '2021-02',
        endDate: 'Obecnie',
        isCurrent: true,
        highlights: [
          {
            id: 'hl_1',
            text: 'Wdrożenie klastrów Kubernetes w AWS EKS, redukując koszty infrastruktury o 35% i czas deploymentu o 60%.',
            metric: '35%',
            tool: 'Kubernetes',
            action: 'Wdrożenie',
            target: 'Klastry EKS',
            keywords: ['Kubernetes', 'AWS', 'EKS'],
          },
          {
            id: 'hl_2',
            text: 'Automatyzacja provisioningu 40+ środowisk przy użyciu Terraform i Helm.',
            metric: '40+',
            tool: 'Terraform',
            action: 'Automatyzacja',
            target: 'Środowiska',
            keywords: ['Terraform', 'Helm'],
          },
        ],
      },
    ],
    education: [
      {
        id: 'edu_1',
        institution: 'Politechnika Warszawska',
        degree: 'Magister Inżynier',
        fieldOfStudy: 'Informatyka',
        startDate: '2013',
        endDate: '2018',
      },
    ],
    projects: [],
  };

  const sampleJobOffer = `
    Stanowisko: Starszy Inżynier Chmurowy i DevOps
    Firma: FinTech Global
    Wymagania kluczowe:
    - Minimum 5 lat doświadczenia w Kubernetes i chmurze AWS
    - Znajomość Terraform, Docker, CI/CD oraz Linux
    - Doświadczenie w monitoringu (Prometheus, Grafana)
    - Mile widziane certyfikaty AWS lub CKA
    - Prawo jazdy kat. B
  `;

  // 1. Testy kalkulatora mediany
  describe('1. Kalkulator Mediany ATS', () => {
    it('poprawnie oblicza medianę dla nieparzystej i parzystej liczby elementów', () => {
      expect(calculateMedian([50, 70, 90])).toBe(70);
      expect(calculateMedian([50, 70, 80, 90])).toBe(75);
      expect(calculateMedian([100])).toBe(100);
      expect(calculateMedian([])).toBeNull();
    });
  });

  // 2. Testy wielosilnikowej symulacji 10 modułów Kierivo
  describe('2. Symulator Konsensusu 10 Modułów Weryfikacji', () => {
    it('zwraca kompletny zestaw 10 zróżnicowanych silników z uzasadnieniem, medianą i propozycjami', () => {
      const result = simulateMultiEngineATS(sampleVault, sampleJobOffer, 'Starszy Inżynier Chmurowy i DevOps');

      expect(result.engines).toHaveLength(10);
      expect(result.assessedEngineCount).toBe(result.engines.filter((engine) => engine.score !== null).length);
      expect(result.medianScore).toBeGreaterThanOrEqual(70);
      expect(result.meanScore).toBeGreaterThanOrEqual(70);
      expect(result.consensusGrade).toBe('EXCELLENT');
      expect(result.careerFitAdvice.assessment).toBe('PLAUSIBLE_FIT');
      expect(result.summaryJustification).toContain('Mediana kontrolnych wskaznikow');
      expect(result.summaryJustification).not.toContain('Wynik reguł Kierivo');
      expect(result.summaryJustification).not.toMatch(/przejdzie wstępne sito|ryzyko odrzucenia|ponad 85%/i);

      // Weryfikacja obecności 10 modułów wewnętrznych
      const engineIds = result.engines.map((e) => e.id);
      expect(engineIds).toContain('struktura_ocr');
      expect(engineIds).toContain('slowa_kluczowe_fleksja');
      expect(engineIds).toContain('kryteria_formalne');
      expect(engineIds).toContain('swiezosc_umiejetnosci');
      expect(engineIds).toContain('zgodnosc_tytulu');
      expect(engineIds).toContain('metryki_liczbowe');
      expect(engineIds).toContain('naturalnosc_jezyka');
      expect(engineIds).toContain('spojnosc_profilu');
      expect(engineIds).toContain('przesiew_wymagan');
      expect(engineIds).toContain('konsensus_cvelocity');

      // Każdy silnik ma zalety, propozycje i rekomendację
      for (const engine of result.engines) {
        if (engine.score !== null) {
          expect(engine.score).toBeGreaterThanOrEqual(0);
          expect(engine.score).toBeLessThanOrEqual(100);
        }
        expect(engine.keyStrengths.length).toBeGreaterThan(0);
        expect(engine.weightsFocus).toBeTruthy();
        expect(engine.recommendation).toBeTruthy();
        expect(Array.isArray(engine.proposals)).toBe(true);
      }

      // Poradnik edukacyjny zawiera 6 złotych zasad w czystym języku polskim
      expect(result.globalBestPractices).toHaveLength(6);
      expect(result.globalBestPractices[0].badExample).toBeTruthy();
      expect(result.globalBestPractices[0].goodExample).toBeTruthy();

      // Uczciwa ocena predyspozycji dla dopasowanego kandydata
      expect(result.careerFitAdvice.isRealisticFit).toBe(true);
      expect(result.careerFitAdvice.verdict).toContain('udokumentowanemu doświadczeniu');
    });

    it('pokazuje wskazówki jako schematy bez wymyślonych osiągnięć i gwarancji ATS', () => {
      const result = simulateMultiEngineATS(sampleVault, sampleJobOffer, 'Starszy Inżynier Chmurowy i DevOps');
      const practices = result.globalBestPractices;
      const copy = practices.map((practice) =>
        `${practice.title} ${practice.badExample} ${practice.goodExample} ${practice.explanation}`,
      ).join(' ');

      expect(practices[0].goodExample).toContain('[potwierdzony wynik, jeśli go znasz]');
      expect(practices[1].goodExample).toContain('[Twoje stanowisko lub kierunek zgodny z doświadczeniem]');
      expect(practices[4].goodExample).toContain('[MM.RRRR]');
      expect(copy).not.toMatch(/42%|10 tysięcy użytkowników|3 lata doświadczenia komercyjnego/i);
      expect(copy).not.toMatch(/natychmiast porównują|najwyżej punktują|powodują pominięcie|odrzucają dokumenty/i);
      expect(practices[5].explanation).toContain('generator nie powinien dopisywać zgody');
    });

    it('generuje uczciwe ostrzeżenie i alternatywne ścieżki dla niedopasowanego kandydata', () => {
      const nonMatchingJob = `
        Stanowisko: Główny Spawacz Konstrukcji Mostowych
        Wymagania bezwzględne:
        - Certyfikat spawalniczy TIG 141 i MAG 135
        - 10 lat doświadczenia przy konstrukcjach mostowych
        - Uprawnienia VT2
      `;

      const result = simulateMultiEngineATS(sampleVault, nonMatchingJob, 'Główny Spawacz Konstrukcji Mostowych');
      expect(result.careerFitAdvice.isRealisticFit).toBe(false);
      expect(result.careerFitAdvice.assessment).toBe('SIGNIFICANT_GAPS');
      expect(result.careerFitAdvice.verdict).toContain('luki między udokumentowanym profilem');
      expect(result.careerFitAdvice.suggestedAlternativeRoles.length).toBeGreaterThan(0);
    });

    it('nie wystawia oceny formaliów, gdy oferta nie zawiera rozpoznanego wymogu', () => {
      const vault = createEmptyVault('Jan Kowalski', 'jan@example.invalid');
      const result = simulateMultiEngineATS(vault, 'Wymagania: Kubernetes, AWS, Terraform.', 'Inżynier chmurowy');
      const formalEngine = result.engines.find((engine) => engine.id === 'kryteria_formalne')!;

      expect(formalEngine.score).toBeNull();
      expect(formalEngine.status).toBe('NOT_ASSESSED');
      expect(formalEngine.keyStrengths[0]).toContain('nie zawiera wykrytych wymagań formalnych');
    });

    it('liczy ocenę formaliów wyłącznie z wymagań rozpoznanych w konkretnej ofercie', () => {
      const vault = createEmptyVault('Jan Kowalski', 'jan@example.invalid');
      const result = simulateMultiEngineATS(
        vault,
        'Wymagane aktualne uprawnienia SEP G1 do 1 kV (eksploatacja).',
        'Elektryk',
      );
      const formalEngine = result.engines.find((engine) => engine.id === 'kryteria_formalne')!;

      expect(formalEngine.score).toBe(0);
      expect(formalEngine.status).toBe('REJECTED');
      expect(formalEngine.penaltiesAndFlags[0]).toContain('SEP');
    });

    it('nie ocenia metryk ani chronologii, gdy profil nie zawiera dowodów do sprawdzenia', () => {
      const vault = createEmptyVault('Jan Kowalski', 'jan@example.invalid');
      const result = simulateMultiEngineATS(vault, sampleJobOffer, 'Inżynier');
      const metricsEngine = result.engines.find((engine) => engine.id === 'metryki_liczbowe')!;
      const timelineEngine = result.engines.find((engine) => engine.id === 'spojnosc_profilu')!;
      const recencyEngine = result.engines.find((engine) => engine.id === 'swiezosc_umiejetnosci')!;

      expect(metricsEngine.score).toBeNull();
      expect(metricsEngine.status).toBe('NOT_ASSESSED');
      expect(timelineEngine.score).toBeNull();
      expect(timelineEngine.status).toBe('NOT_ASSESSED');
      expect(recencyEngine.score).toBeNull();
      expect(recencyEngine.status).toBe('NOT_ASSESSED');
    });

    it('metryki liczy jako udział opisów z wykrywalnym wynikiem, a luki wyprowadza z dat', () => {
      const vault = createEmptyVault('Jan Kowalski', 'jan@example.invalid');
      vault.history = [
        {
          id: 'exp-1', company: 'A', role: 'Technik', location: 'Warszawa',
          startDate: '2018-01', endDate: '2019-01', isCurrent: false,
          highlights: [
            { id: 'h1', text: 'Obsługa zgłoszeń klientów.', action: '', target: '', tool: '', metric: '', keywords: [] },
            { id: 'h2', text: 'Skróciłem czas obsługi o 25%.', action: '', target: '', tool: '', metric: '', keywords: [] },
          ],
        },
        {
          id: 'exp-2', company: 'B', role: 'Technik', location: 'Warszawa',
          startDate: '2021-01', endDate: '2022-01', isCurrent: false,
          highlights: [],
        },
      ];
      const result = simulateMultiEngineATS(vault, sampleJobOffer, 'Technik');
      const metricsEngine = result.engines.find((engine) => engine.id === 'metryki_liczbowe')!;
      const timelineEngine = result.engines.find((engine) => engine.id === 'spojnosc_profilu')!;

      expect(metricsEngine.score).toBe(50);
      expect(metricsEngine.status).toBe('RISKY');
      expect(timelineEngine.score).toBeNull();
      expect(timelineEngine.status).toBe('REVIEW_REQUIRED');
      expect(timelineEngine.penaltiesAndFlags.length).toBeGreaterThan(0);
      expect(timelineEngine.penaltiesAndFlags.join(' ')).toMatch(/nieopisany okres/i);
    });

    it('moduł osi czasu nie ukrywa nieczytelnego wpisu obok dwóch poprawnych', () => {
      const vault = createEmptyVault();
      const job = (id: string, startDate: string, endDate: string) => ({
        id, company: `Firma ${id}`, role: 'Monter', location: 'Kraków', startDate, endDate,
        isCurrent: false, highlights: [],
      });
      vault.history = [job('a', '2020-01', '2021-01'), job('b', '2021-02', '2022-01'), job('c', 'nie wiem', '2023-01')];
      const engine = simulateMultiEngineATS(vault, 'Wymagany SEP G1.', 'Monter').engines.find(item => item.id === 'spojnosc_profilu')!;
      expect(engine.status).toBe('NOT_ASSESSED');
      expect(engine.score).toBeNull();
      expect(engine.penaltiesAndFlags.join(' ')).toContain('Nie można sprawdzić okresu');
      expect(engine.keyStrengths.join(' ')).toContain('niepotwierdzona');
    });

    it('moduł osi czasu odrzuca przyszłe i odwrócone daty zamiast wysokiego wyniku', () => {
      for (const dates of [['2020-01', '2099-01'], ['2023-01', '2020-01']]) {
        const vault = createEmptyVault();
        vault.history = [
          { id: 'a', company: 'Firma A', role: 'Spawacz', location: '', startDate: '2018-01', endDate: '2019-01', isCurrent: false, highlights: [] },
          { id: 'b', company: 'Firma B', role: 'Spawacz', location: '', startDate: dates[0], endDate: dates[1], isCurrent: false, highlights: [] },
        ];
        const engine = simulateMultiEngineATS(vault, 'Wymagane spawanie TIG.', 'Spawacz').engines.find(item => item.id === 'spojnosc_profilu')!;
        expect(engine.status).toBe('NOT_ASSESSED');
        expect(engine.penaltiesAndFlags.join(' ')).toContain('Nie można sprawdzić okresu');
      }
    });

    it('brak uwag chronologicznych ma status opisowy bez wysokiego wyniku liczbowego', () => {
      const vault = createEmptyVault();
      vault.history = [
        { id: 'a', company: 'Firma A', role: 'Magazynier', location: '', startDate: '2018-01', endDate: '2019-01', isCurrent: false, highlights: [] },
        { id: 'b', company: 'Firma B', role: 'Magazynier', location: '', startDate: '2019-02', endDate: '2020-01', isCurrent: false, highlights: [] },
      ];
      const engine = simulateMultiEngineATS(vault, 'Wymagane UDT.', 'Magazynier').engines.find(item => item.id === 'spojnosc_profilu')!;
      expect(engine.score).toBeNull();
      expect(engine.status).toBe('NO_SIGNALS');
    });

    it('sprawdza dowód umiejętności w opisie, a nie samą listę profilu', () => {
      const vault = createEmptyVault('Jan Kowalski', 'jan@example.invalid');
      vault.skillsMatrix.hardSkills = ['Kubernetes'];

      const listOnly = simulateMultiEngineATS(vault, 'Wymaganie: Kubernetes.', 'Inżynier');
      const listOnlyEngine = listOnly.engines.find((engine) => engine.id === 'naturalnosc_jezyka')!;
      expect(listOnlyEngine.score).toBe(0);
      expect(listOnlyEngine.status).toBe('REJECTED');

      vault.personalInfo.summary = 'Wdrażam klastry Kubernetes w środowisku produkcyjnym.';
      const described = simulateMultiEngineATS(vault, 'Wymaganie: Kubernetes.', 'Inżynier');
      const describedEngine = described.engines.find((engine) => engine.id === 'naturalnosc_jezyka')!;
      expect(describedEngine.score).toBe(100);
      expect(describedEngine.status).toBe('OPTIMAL');
    });

    it('nie obniza zgodnosci tytulu przez brak wymagan twardych w ofercie', () => {
      const vault = createEmptyVault('Jan Kowalski', 'jan@example.invalid');
      vault.personalInfo.title = 'Technik';

      const result = simulateMultiEngineATS(
        vault,
        'Opis pracy: Technik odpowiada za kontakt z klientami i organizacje pracy.',
        'Technik'
      );
      const titleEngine = result.engines.find((engine) => engine.id === 'zgodnosc_tytulu')!;

      expect(titleEngine.score).toBe(100);
      expect(titleEngine.weightsFocus).toMatch(/nie znaleziono wymagan twardych/i);
      expect(result.engines.find((engine) => engine.id === 'slowa_kluczowe_fleksja')?.score).toBeNull();
    });
  });

  // 3. Testy dziedziczenia i subsumpcji uprawnień (License Hierarchy)
  describe('3. Dziedziczenie Uprawnień w Audycie Formalnym', () => {
    it('prawo jazdy kat. C automatycznie spełnia wymaganie kat. B', () => {
      const jd = 'Wymagane prawo jazdy kat. B do wyjazdów serwisowych.';
      const report = auditKnockouts(jd, sampleVault);

      expect(report.blocking).toHaveLength(0);
      expect(report.satisfiedCount).toBeGreaterThanOrEqual(1);
    });

    it('uprawnienia SEP powyżej 1kV nie spełniają wymogu do 1kV bez potwierdzenia zakresu', () => {
      const jd = 'Konieczne ważne uprawnienia SEP do 1kV (eksploatacja).';
      const report = auditKnockouts(jd, sampleVault);

      expect(report.blocking.map((finding) => finding.ruleId)).toContain('sep_g1');
      expect(report.findings.find((finding) => finding.ruleId === 'sep_g1')?.satisfied).toBe(false);
    });
  });

  // 4. Testy detektora słów waty w Mock Drill Mode
  describe('4. Detektor Słów Waty w Treningu Rozmowy', () => {
    it('wskazuje rozpoznane natręctwa językowe bez punktacji czystości wypowiedzi', () => {
      const responseWithFillers = `
        No w sensie kiedy klient zgłosił awarię, to jakby po prostu zidentyfikowałem błąd w kodzie.
        Moim zadaniem było naprawienie bazy. Generalnie wdrożyłem patch i tak naprawdę w rezultacie
        skróciłem czas niedostępności o 50%.
      `;

      const scorecard = analyzeDrillResponse(responseWithFillers);
      expect(scorecard.suggestions.some((s) => s.includes('słowa waty'))).toBe(true);
    });

    it('nie zgłasza słów waty, gdy nie rozpoznano żadnego z nich', () => {
      const cleanResponse = `
        Gdy klient zgłosił awarię klastra, natychmiast przeprowadziłem analizę logów systemowych.
        Moim celem było przywrócenie SLA. Samodzielnie zdiagnozowałem wyciek pamięci i wdrożyłem
        poprawkę konfiguracyjną. W rezultacie osiągnąłem pełną stabilność z czasem odpowiedzi poniżej 50ms.
      `;

      const scorecard = analyzeDrillResponse(cleanResponse);
      expect(scorecard.suggestions.some((s) => s.includes('słowa waty'))).toBe(false);
    });
  });
});
