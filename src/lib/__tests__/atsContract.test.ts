import { describe, it, expect } from 'vitest';
import { simulateAtsCheck, simulateMultiEngineATS } from '../atsSimulator';
import { buildAtsTelemetryReport } from '../atsScorer';
import { createEmptyVault } from '../sampleVault';
import type { MasterVault, TailoredResume } from '../../types';

/**
 * Kontrakt semantyczny: symulator ATS (`simulateAtsCheck` + `simulateMultiEngineATS`)
 * kontra telemetria śledcza (`buildAtsTelemetryReport`).
 *
 * Celowo nie porównujemy surowych wyników — skale są z konstrukcji różne
 * (symulator waży tytuł i świeżość, telemetria staż i metryki). Porównujemy
 * odpowiedź na jedno pytanie: czy profil ma dowody na wymagania z oferty.
 *
 * Adaptery `kontraktSim` / `kontraktTel` istnieją wyłącznie na potrzeby tego
 * testu i nie są eksportowane — żaden kod produkcyjny nie może zależeć od
 * progów umownych z tego pliku.
 *
 * Uwaga o wspólnej ekstrakcji (NIE jest rozjazdem): oba silniki dziedziczą
 * frazy z `extractDynamicJdPhrases`, więc jej szum — np. `terraform.` z kropką
 * ani `Wymaganie` wyciągnięte z nagłówka oferty — obciąża je tak samo. To
 * jest jedno źródło prawdy działające poprawnie (reguła 3); do wyczyszczenia
 * w samej ekstrakcji, poza tym testem.
 */

type PasmoPokrycia = 'NONE' | 'PARTIAL' | 'HIGH';
type PasmoDopasowania = 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH';

interface KontraktSemantyczny {
  hasEvidence: boolean;
  missingCount: number;
  coverageBand: PasmoPokrycia;
  fitBand: PasmoDopasowania;
}

type WynikSim = ReturnType<typeof simulateAtsCheck>;
type Konsensus = ReturnType<typeof simulateMultiEngineATS>;
type Telemetria = ReturnType<typeof buildAtsTelemetryReport>;

function pasmoPokrycia(wynik: number): PasmoPokrycia {
  if (wynik <= 0) return 'NONE';
  // Próg HIGH celowo nie wymaga 100: brakująca końcówka to zwykle szum
  // ekstrakcji (np. `terraform.` z kropką), nie brak dowodu w profilu.
  if (wynik >= 75) return 'HIGH';
  return 'PARTIAL';
}

function kontraktSim(sim: WynikSim, konsensus: Konsensus): KontraktSemantyczny {
  return {
    hasEvidence: sim.layer2Nlp.hardSkillsCoverage > 0,
    missingCount: sim.missingHardSkills.length,
    coverageBand: pasmoPokrycia(sim.layer2Nlp.hardSkillsCoverage),
    fitBand:
      konsensus.consensusGrade === 'EXCELLENT'
        ? 'HIGH'
        : konsensus.consensusGrade === 'GOOD' || konsensus.careerFitAdvice.isRealisticFit
          ? 'MEDIUM'
          : konsensus.consensusGrade === 'NEEDS_WORK'
            ? 'LOW'
            : 'INSUFFICIENT',
  };
}

function kontraktTel(tel: Telemetria): KontraktSemantyczny {
  const wynik = tel.overallScore;
  return {
    hasEvidence: tel.formulaBreakdown.hardSkillsScore > 0,
    missingCount: tel.linguisticTelemetry.missingCriticalLemmas.length,
    coverageBand: pasmoPokrycia(tel.formulaBreakdown.hardSkillsScore),
    // HIGH od 70, nie od 80: wynik telemetrii miesza evidence ze stażem
    // i metrykami, więc profil z pełnym evidence rzadko dobija wyżej.
    fitBand: wynik >= 70 ? 'HIGH' : wynik >= 55 ? 'MEDIUM' : wynik >= 30 ? 'LOW' : 'INSUFFICIENT',
  };
}

const JD = 'Poszukujemy inzyniera chmurowego. Wymagania: Kubernetes, AWS, Terraform. Oferujemy rozwoj i szkolenia.';
const JD_KUBERNETES = 'Poszukujemy inzyniera. Wymaganie: Kubernetes.';
const TARGET = 'Inzynier chmurowy';

function pustyRezyme(tytul: string): TailoredResume {
  return {
    targetJobTitle: tytul,
    companyName: '',
    summary: '',
    selectedHighlights: [],
    skillsMatched: { hardSkills: [], toolsAndTech: [], softSkills: [] },
    atsScore: 0,
  };
}

function licz(vault: MasterVault, jd: string, target: string): { sim: WynikSim; konsensus: Konsensus; tel: Telemetria } {
  return {
    sim: simulateAtsCheck(pustyRezyme(target), vault, jd),
    konsensus: simulateMultiEngineATS(vault, jd, target),
    tel: buildAtsTelemetryReport({ vault, jobDescription: jd }),
  };
}

function zHighlightem(id: string, text: string, extra: { action?: string; tool?: string; metric?: string } = {}) {
  return {
    id,
    text,
    action: extra.action ?? '',
    target: '',
    tool: extra.tool ?? '',
    metric: extra.metric ?? '',
    keywords: [] as string[],
  };
}

describe('Kontrakt semantyczny: symulator ATS kontra telemetria śledcza', () => {
  describe('1. EMPTY — pusty profil', () => {
    it('oba systemy widzą brak dowodów: NONE, braki > 0, INSUFFICIENT', () => {
      const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
      const { sim, konsensus, tel } = licz(vault, JD, TARGET);
      const simK = kontraktSim(sim, konsensus);
      const telK = kontraktTel(tel);

      expect(simK.hasEvidence).toBe(false);
      expect(telK.hasEvidence).toBe(false);
      expect(simK.coverageBand).toBe('NONE');
      expect(telK.coverageBand).toBe('NONE');
      expect(simK.missingCount).toBeGreaterThan(0);
      expect(telK.missingCount).toBe(simK.missingCount);
      expect(simK.fitBand).toBe('INSUFFICIENT');
      expect(telK.fitBand).toBe('INSUFFICIENT');
    });

    it('NAPRAWIONE R1: brak dopasowań = świeżość 0, nie bonus 80', () => {
      // Dawniej przy zerze trafień silnik podstawiał stałą 80 — wartość
      // z sufitu pompującą medianę pustego profilu. Teraz 0 (F4).
      const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
      const { sim, tel } = licz(vault, JD, TARGET);

      expect(sim.layer2Nlp.hardSkillsCoverage).toBe(0);
      expect(sim.layer3Scoring.recencyScore).toBe(0);
      expect(tel.formulaBreakdown.experienceScore).toBe(0);
    });

    it('NAPRAWIONE R5 (ślad na pustym profilu): brak podłogi przy zerowym evidence', () => {
      // Dawniej mediana ~39 na niczym (tytuł 50 + świeżość 80). Po naprawie
      // R1 i uszczelnieniu matchera podłoga znika — mediana spada pod 50.
      const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
      const { konsensus, tel } = licz(vault, JD, TARGET);

      expect(konsensus.medianScore).toBeLessThan(50);
      expect(tel.overallScore).toBeLessThan(20);
    });
  });

  describe('2. FULL — Kubernetes, AWS i Terraform w aktualnym doświadczeniu', () => {
    function pelnyProfil(): MasterVault {
      const vault = createEmptyVault('Ada Nowak', 'ada@example.com');
      vault.personalInfo.title = 'Inzynier chmurowy';
      vault.personalInfo.summary = 'Wdrazam klastry Kubernetes w AWS z Terraform.';
      vault.skillsMatrix.hardSkills = ['Kubernetes', 'AWS', 'Terraform'];
      vault.history = [
        {
          id: 'exp-1',
          company: 'CloudCorp',
          role: 'Inzynier chmurowy',
          location: 'Warszawa',
          startDate: '2022-01',
          endDate: 'Obecnie',
          isCurrent: true,
          highlights: [
            zHighlightem('h1', 'Wdrozyłem klaster Kubernetes w AWS przy uzyciu Terraform.', {
              action: 'wdrozylem',
              tool: 'Terraform',
              metric: '40%',
            }),
            zHighlightem('h2', 'Automatyzuje infrastrukture AWS narzedziem Terraform.', { metric: '20 srodowisk' }),
          ],
        },
        {
          id: 'exp-0',
          company: 'DataSoft',
          role: 'Administrator systemow',
          location: 'Krakow',
          startDate: '2019-06',
          endDate: '2021-12',
          isCurrent: false,
          highlights: [
            zHighlightem('h0a', 'Zbudowalem srodowisko AWS z Terraform dla 5 zespolow.', {
              action: 'zbudowalem',
              tool: 'Terraform',
              metric: '5 zespolow',
            }),
            zHighlightem('h0b', 'Zautomatyzowalem backupy, skracajac okno o polowe.', {
              action: 'zautomatyzowalem',
              tool: 'AWS',
              metric: '50%',
            }),
          ],
        },
      ];
      return vault;
    }

    it('oba systemy klasyfikują profil jako mocno dopasowany, bez braków', () => {
      const { sim, konsensus, tel } = licz(pelnyProfil(), JD, TARGET);
      const simK = kontraktSim(sim, konsensus);
      const telK = kontraktTel(tel);

      expect(simK).toEqual({ hasEvidence: true, missingCount: 0, coverageBand: 'HIGH', fitBand: 'HIGH' });
      expect(telK).toEqual({ hasEvidence: true, missingCount: 0, coverageBand: 'HIGH', fitBand: 'HIGH' });
    });
  });

  describe('3. PARTIAL — w profilu tylko AWS', () => {
    it('oba systemy widzą częściowe dopasowanie: PARTIAL, brakuje Kubernetes i Terraform', () => {
      const vault = createEmptyVault('Ewa Lis', 'ewa@example.com');
      vault.personalInfo.title = 'Inzynier chmurowy';
      vault.skillsMatrix.hardSkills = ['AWS'];
      vault.history = [
        {
          id: 'exp-1',
          company: 'CloudCorp',
          role: 'Inzynier chmurowy',
          location: 'Warszawa',
          startDate: '2022-01',
          endDate: 'Obecnie',
          isCurrent: true,
          highlights: [zHighlightem('h1', 'Administruje srodowiska AWS dla zespolu developerskiego.')],
        },
      ];

      const { sim, konsensus, tel } = licz(vault, JD, TARGET);
      const simK = kontraktSim(sim, konsensus);
      const telK = kontraktTel(tel);

      expect(simK.hasEvidence).toBe(true);
      expect(telK.hasEvidence).toBe(true);
      expect(simK.coverageBand).toBe('PARTIAL');
      expect(telK.coverageBand).toBe('PARTIAL');
      expect(sim.missingHardSkills).toContain('kubernetes');
      expect(sim.missingHardSkills).toContain('terraform');
      expect(tel.linguisticTelemetry.missingCriticalLemmas).toContain('kubernetes');
      expect(tel.linguisticTelemetry.missingCriticalLemmas).toContain('terraform');
      expect(simK.missingCount).toBe(telK.missingCount);
      expect(simK.fitBand).toBe('LOW');
      expect(telK.fitBand).toBe('LOW');
    });
  });

  describe('4. MATRIX ONLY — umiejętności bez doświadczenia', () => {
    function profilBezHistorii(): MasterVault {
      const vault = createEmptyVault('Ola Kot', 'ola@example.com');
      vault.personalInfo.title = 'Inzynier chmurowy';
      vault.skillsMatrix.hardSkills = ['Kubernetes', 'AWS', 'Terraform'];
      return vault;
    }

    it('obecność potwierdza oba systemy (HIGH/HIGH), świeżość nie udaje aktualnego użycia', () => {
      const { sim, konsensus, tel } = licz(profilBezHistorii(), JD, TARGET);
      const simK = kontraktSim(sim, konsensus);
      const telK = kontraktTel(tel);

      expect(simK.coverageBand).toBe('HIGH');
      expect(telK.coverageBand).toBe('HIGH');
      // Trafienia wyłącznie spoza datowanych ról dostają wagę starego użycia,
      // nie aktualnego — tak ma zostać.
      expect(sim.layer3Scoring.recencyScore).toBeLessThan(100);
    });

    it('NAPRAWIONE R4: kropka końcowa nie rozjeżdża werdyktów', () => {
      // Ekstraktor odcina końcową interpunkcję, a oba silniki liczą granicami
      // słów — `terraform.` z oferty to `terraform`, zero braków po obu stronach.
      const { sim, tel } = licz(profilBezHistorii(), JD, TARGET);

      expect(sim.missingHardSkills).toEqual([]);
      expect(tel.linguisticTelemetry.missingCriticalLemmas).toEqual([]);
    });

    it('NAPRAWIONE R2: pełne evidence bez stażu — oba pasma MEDIUM', () => {
      // Po naprawie R4 (kropka) oba silniki widzą pełne pokrycie, więc pasma
      // schodzą się w MEDIUM. Flaga `isRealisticFit` przy NEEDS_WORK i zerowym
      // stażu zostaje jako znana słabość (osobny temat, nie rozjazd pasm).
      const { konsensus, tel } = licz(profilBezHistorii(), JD, TARGET);
      const sim = simulateAtsCheck(pustyRezyme(TARGET), profilBezHistorii(), JD);
      const simK = kontraktSim(sim, konsensus);
      const telK = kontraktTel(tel);

      expect(konsensus.consensusGrade).toBe('NEEDS_WORK');
      expect(simK.fitBand).toBe('MEDIUM');
      expect(telK.fitBand).toBe('MEDIUM');
    });
  });

  describe('5. WHITESPACE — pola ze śmieciami (` `, `---`, `...`)', () => {
    function profilSmieciowy(): MasterVault {
      const vault = createEmptyVault('   ', 'jan@example.com');
      vault.personalInfo.title = '---';
      vault.personalInfo.summary = '...';
      vault.skillsMatrix.hardSkills = [' ', '---', '...'];
      vault.skillsMatrix.toolsAndTech = [' '];
      return vault;
    }

    it('zero fałszywych matchy: NONE, pełne braki, pusta lista trafień', () => {
      const { sim, konsensus, tel } = licz(profilSmieciowy(), JD, '---');
      const simK = kontraktSim(sim, konsensus);
      const telK = kontraktTel(tel);

      expect(simK.hasEvidence).toBe(false);
      expect(telK.hasEvidence).toBe(false);
      expect(simK.coverageBand).toBe('NONE');
      expect(telK.coverageBand).toBe('NONE');
      expect(simK.missingCount).toBeGreaterThan(0);
      expect(telK.missingCount).toBe(simK.missingCount);
      expect(tel.linguisticTelemetry.matchedLemmas).toEqual([]);
    });

    it('NAPRAWIONE R3: tytuł-śmieć nie pasuje (`---` → 45, bez dowodu)', () => {
      // Kanoniczny matcher odrzuca śmieci bez liter/cyfr — identyczne `---`
      // nie „pasują" idealnie i nie ciągną mediany (F1).
      const { sim, konsensus, tel } = licz(profilSmieciowy(), JD, '---');
      const simK = kontraktSim(sim, konsensus);
      const telK = kontraktTel(tel);

      expect(sim.layer3Scoring.titleMatchScore).toBe(45);
      expect(simK.fitBand).toBe('INSUFFICIENT');
      expect(telK.fitBand).toBe('INSUFFICIENT');
    });
  });

  describe('6. RELATED — Docker w CV, Kubernetes w ofercie', () => {
    it('oba systemy odmawiają exact match: NONE, kubernetes na liście braków', () => {
      const vault = createEmptyVault('Ula Rys', 'ula@example.com');
      vault.personalInfo.title = 'Inzynier chmurowy';
      vault.skillsMatrix.hardSkills = ['Docker'];
      vault.history = [
        {
          id: 'exp-1',
          company: 'CloudCorp',
          role: 'Inzynier chmurowy',
          location: 'Warszawa',
          startDate: '2022-01',
          endDate: 'Obecnie',
          isCurrent: true,
          highlights: [zHighlightem('h1', 'Konteneryzuje aplikacje narzedziem Docker w srodowisku produkcyjnym.')],
        },
      ];

      const { sim, konsensus, tel } = licz(vault, JD_KUBERNETES, TARGET);
      const simK = kontraktSim(sim, konsensus);
      const telK = kontraktTel(tel);

      expect(simK.hasEvidence).toBe(false);
      expect(telK.hasEvidence).toBe(false);
      expect(simK.coverageBand).toBe('NONE');
      expect(telK.coverageBand).toBe('NONE');
      expect(sim.missingHardSkills).toContain('kubernetes');
      expect(tel.linguisticTelemetry.missingCriticalLemmas).toContain('kubernetes');
      expect(simK.missingCount).toBe(telK.missingCount);
    });

    it('NAPRAWIONE R5: zero pokrycia bez podłogi (mediana < 50, INSUFFICIENT)', () => {
      // Po naprawie R1 (świeżość 0 zamiast 80) tytuł 100 sam nie trzyma
      // mediany w LOW — zero dowodów to INSUFFICIENT po obu stronach.
      const vault = createEmptyVault('Ula Rys', 'ula@example.com');
      vault.personalInfo.title = 'Inzynier chmurowy';
      vault.skillsMatrix.hardSkills = ['Docker'];

      const { sim, konsensus, tel } = licz(vault, JD_KUBERNETES, TARGET);
      const simK = kontraktSim(sim, konsensus);
      const telK = kontraktTel(tel);

      expect(sim.layer2Nlp.hardSkillsCoverage).toBe(0);
      expect(konsensus.medianScore).toBeLessThan(50);
      expect(tel.overallScore).toBeLessThan(30);
      expect(simK.fitBand).toBe('INSUFFICIENT');
      expect(telK.fitBand).toBe('INSUFFICIENT');
    });
  });
});
