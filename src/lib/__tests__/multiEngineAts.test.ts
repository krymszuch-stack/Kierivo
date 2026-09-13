import { describe, it, expect } from 'vitest';
import { simulateMultiEngineATS, calculateMedian } from '../atsSimulator';
import { auditKnockouts } from '../knockouts';
import { analyzeDrillResponse } from '../drillEngine';
import { MasterVault } from '../../types';

describe('Multi-Engine ATS Consensus & Engine Enhancements Suite', () => {
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
      expect(calculateMedian([])).toBe(0);
    });
  });

  // 2. Testy wielosilnikowej symulacji 10 modułów Kierivo
  describe('2. Symulator Konsensusu 10 Modułów Weryfikacji', () => {
    it('zwraca kompletny zestaw 10 zróżnicowanych silników z uzasadnieniem, medianą i propozycjami', () => {
      const result = simulateMultiEngineATS(sampleVault, sampleJobOffer, 'Starszy Inżynier Chmurowy i DevOps');

      expect(result.engines).toHaveLength(10);
      expect(result.medianScore).toBeGreaterThanOrEqual(70);
      expect(result.meanScore).toBeGreaterThanOrEqual(70);
      expect(result.consensusGrade).toBe('EXCELLENT');
      expect(result.summaryJustification).toContain('rynkowy konsensus');

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
        expect(engine.score).toBeGreaterThanOrEqual(0);
        expect(engine.score).toBeLessThanOrEqual(100);
        expect(engine.keyStrengths.length).toBeGreaterThan(0);
        expect(engine.weightsFocus).toBeTruthy();
        expect(engine.recommendation).toBeTruthy();
        expect(engine.proposals.length).toBeGreaterThan(0);
      }

      // Poradnik edukacyjny zawiera 6 złotych zasad w czystym języku polskim
      expect(result.globalBestPractices).toHaveLength(6);
      expect(result.globalBestPractices[0].badExample).toBeTruthy();
      expect(result.globalBestPractices[0].goodExample).toBeTruthy();

      // Uczciwa ocena predyspozycji dla dopasowanego kandydata
      expect(result.careerFitAdvice.isRealisticFit).toBe(true);
      expect(result.careerFitAdvice.verdict).toContain('zasięgu');
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
      expect(result.careerFitAdvice.verdict).toContain('lukę kompetencyjną');
      expect(result.careerFitAdvice.suggestedAlternativeRoles.length).toBeGreaterThan(0);
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

    it('uprawnienia SEP powyżej 1kV automatycznie spełniają wymóg do 1kV', () => {
      const jd = 'Konieczne ważne uprawnienia SEP do 1kV (eksploatacja).';
      const report = auditKnockouts(jd, sampleVault);

      expect(report.blocking).toHaveLength(0);
    });
  });

  // 4. Testy detektora słów waty w Mock Drill Mode
  describe('4. Detektor Słów Waty w Treningu Rozmowy', () => {
    it('wykrywa natręctwa językowe i obniża wskaźnik czystości wypowiedzi', () => {
      const responseWithFillers = `
        No w sensie kiedy klient zgłosił awarię, to jakby po prostu zidentyfikowałem błąd w kodzie.
        Moim zadaniem było naprawienie bazy. Generalnie wdrożyłem patch i tak naprawdę w rezultacie
        skróciłem czas niedostępności o 50%.
      `;

      const scorecard = analyzeDrillResponse(responseWithFillers);
      expect(scorecard.fillerWords).toBeDefined();
      expect(scorecard.fillerWords?.totalCount).toBeGreaterThanOrEqual(3);
      expect(scorecard.fillerWords?.clarityScore).toBeLessThan(100);
      expect(scorecard.suggestions.some((s) => s.includes('słowa waty'))).toBe(true);
    });

    it('daje 100% czystości wypowiedzi dla odpowiedzi bez słów waty', () => {
      const cleanResponse = `
        Gdy klient zgłosił awarię klastra, natychmiast przeprowadziłem analizę logów systemowych.
        Moim celem było przywrócenie SLA. Samodzielnie zdiagnozowałem wyciek pamięci i wdrożyłem
        poprawkę konfiguracyjną. W rezultacie osiągnąłem pełną stabilność z czasem odpowiedzi poniżej 50ms.
      `;

      const scorecard = analyzeDrillResponse(cleanResponse);
      expect(scorecard.fillerWords?.totalCount).toBe(0);
      expect(scorecard.fillerWords?.clarityScore).toBe(100);
    });
  });
});
