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

function pasmoPokrycia(wynik: number | null): PasmoPokrycia {
  if (wynik === null || wynik <= 0) return 'NONE';
  // Próg HIGH celowo nie wymaga 100: brakująca końcówka to zwykle szum
  // ekstrakcji (np. `terraform.` z kropką), nie brak dowodu w profilu.
  if (wynik >= 75) return 'HIGH';
  return 'PARTIAL';
}

function kontraktSim(sim: WynikSim, konsensus: Konsensus): KontraktSemantyczny {
  return {
    hasEvidence: sim.layer2Nlp.hardSkillsCoverage !== null && sim.layer2Nlp.hardSkillsCoverage > 0,
    missingCount: sim.missingHardSkills.length,
    coverageBand: pasmoPokrycia(sim.layer2Nlp.hardSkillsCoverage),
    fitBand:
      konsensus.careerFitAdvice.assessment === 'INSUFFICIENT_EVIDENCE'
        ? 'INSUFFICIENT'
        : konsensus.consensusGrade === 'EXCELLENT'
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
    hasEvidence: tel.formulaBreakdown.hardSkillsScore !== null && tel.formulaBreakdown.hardSkillsScore > 0,
    missingCount: tel.linguisticTelemetry.missingCriticalLemmas.length,
    coverageBand: pasmoPokrycia(tel.formulaBreakdown.hardSkillsScore),
    // HIGH od 70, nie od 80: wynik telemetrii miesza evidence ze stażem
    // i metrykami, więc profil z pełnym evidence rzadko dobija wyżej.
    fitBand: wynik === null ? 'INSUFFICIENT' : wynik >= 70 ? 'HIGH' : wynik >= 55 ? 'MEDIUM' : wynik >= 30 ? 'LOW' : 'INSUFFICIENT',
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
  it('nie ocenia struktury CV na podstawie samego imienia i danych kontaktowych', () => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.test');
    const result = simulateAtsCheck(pustyRezyme(''), vault, '');

    expect(result.overallScore).toBeNull();
    expect(result.structureScore).toBeNull();
    expect(result.layer1Structure.layoutScore).toBeNull();
    expect(result.layer1Structure.headerNormalizationScore).toBeNull();
  });

  it('liczy strukture, kiedy Vault zawiera tresc CV', () => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.test');
    vault.skillsMatrix.hardSkills = ['SEP G1'];
    const result = simulateAtsCheck(pustyRezyme(''), vault, '');

    expect(result.structureScore).not.toBeNull();
    expect(result.layer1Structure.layoutScore).not.toBeNull();
    expect(result.layer1Structure.headerNormalizationScore).not.toBeNull();
  });

  it('nie pokazuje 100% pokrycia dla certyfikatu, którego aktualności nie da się potwierdzić', () => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    vault.personalInfo.summary = 'Pracownik techniczny z doświadczeniem w serwisie urządzeń.';
    vault.profiler.licenses = ['fgas'];
    const sim = simulateAtsCheck(
      pustyRezyme('Technik serwisu'),
      vault,
      'Wymagania: aktualny certyfikat F-Gaz.',
    );

    expect(sim.keywordCoverageScore).toBeNull();
    expect(sim.layer2Nlp.hardSkillsCoverage).toBeNull();
    expect(sim.layer2Nlp.formalReqsCoverage).toBeNull();
    expect(sim.missingHardSkills).toEqual([]);
  });

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
      expect(sim.layer3Scoring.recencyScore).toBeNull();
      expect(tel.formulaBreakdown.experienceScore).toBeNull();
    });

    it('NAPRAWIONE R5 (ślad na pustym profilu): brak podłogi przy zerowym evidence', () => {
      // Dawniej mediana ~39 na niczym (tytuł 50 + świeżość 80). Po naprawie
      // R1 i uszczelnieniu matchera podłoga znika — mediana spada pod 50.
      const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
      const { konsensus, tel } = licz(vault, JD, TARGET);

      expect(konsensus.assessedEngineCount).toBe(konsensus.engines.filter((engine) => engine.score !== null).length);
      expect(konsensus.medianScore).toBe(0);
      expect(konsensus.careerFitAdvice.assessment).toBe('INSUFFICIENT_EVIDENCE');
      expect(konsensus.consensusGrade).toBe('INSUFFICIENT_DATA');
      expect(tel.overallScore).toBeNull();
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

  describe('2b. Świeżość umiejętności z datowanych wpisów', () => {
    it('sortuje historię po datach i odrzuca zanegowane użycie w najnowszej roli', () => {
      const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
      vault.skillsMatrix.hardSkills = ['Kubernetes'];
      const older = {
        id: 'older', company: 'A', role: 'Administrator', location: '',
        startDate: '2019-01', endDate: '2021-12', isCurrent: false,
        highlights: [zHighlightem('old-k8s', 'Wdrażałem klastry Kubernetes.')],
      };
      const recent = {
        id: 'recent', company: 'B', role: 'Inżynier', location: '',
        startDate: '2022-01', endDate: 'Obecnie', isCurrent: true,
        highlights: [zHighlightem('recent-k8s', 'Prowadziłem wdrożenia Kubernetes.')],
      };
      vault.history = [older, recent];

      const currentUse = simulateAtsCheck(pustyRezyme('Inżynier'), vault, 'Wymaganie: Kubernetes.');
      expect(currentUse.layer3Scoring.recencyScore).toBe(100);

      recent.highlights = [zHighlightem('recent-no-k8s', 'Nie używałem Kubernetes.')];
      const olderUse = simulateAtsCheck(pustyRezyme('Inżynier'), vault, 'Wymaganie: Kubernetes.');
      expect(olderUse.layer3Scoring.recencyScore).toBe(70);
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
      expect(sim.layer3Scoring.recencyScore).toBeNull();
    });

    it('NAPRAWIONE R4: kropka końcowa nie rozjeżdża werdyktów', () => {
      // Ekstraktor odcina końcową interpunkcję, a oba silniki liczą granicami
      // słów — `terraform.` z oferty to `terraform`, zero braków po obu stronach.
      const { sim, tel } = licz(profilBezHistorii(), JD, TARGET);

      expect(sim.missingHardSkills).toEqual([]);
      expect(tel.linguisticTelemetry.missingCriticalLemmas).toEqual([]);
    });

    it('nie ogłasza dopasowania kariery na podstawie samych umiejętności bez historii ani projektów', () => {
      // Pełne pokrycie słów nie dowodzi praktycznego użycia; brakuje historii i projektów.
      const { konsensus, tel } = licz(profilBezHistorii(), JD, TARGET);
      const sim = simulateAtsCheck(pustyRezyme(TARGET), profilBezHistorii(), JD);
      const simK = kontraktSim(sim, konsensus);
      const telK = kontraktTel(tel);

      expect(konsensus.consensusGrade).toBe('INSUFFICIENT_DATA');
      expect(konsensus.careerFitAdvice.assessment).toBe('INSUFFICIENT_EVIDENCE');
      expect(konsensus.careerFitAdvice.isRealisticFit).toBe(false);
      expect(konsensus.careerFitAdvice.verdict).not.toContain('jest w zasięgu');
      expect(konsensus.careerFitAdvice.suggestedAlternativeRoles).toEqual([]);
      expect(simK.fitBand).toBe('INSUFFICIENT');
      expect(telK.fitBand).toBe('INSUFFICIENT');
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

      expect(sim.layer3Scoring.titleMatchScore).toBeNull();
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

    it('zero pokrycia nie daje pozytywnego werdyktu przy ograniczonych danych', () => {
      // Po naprawie R1 (świeżość 0 zamiast 80) tytuł 100 sam nie trzyma
      // mediany w LOW — zero dowodów to INSUFFICIENT po obu stronach.
      const vault = createEmptyVault('Ula Rys', 'ula@example.com');
      vault.personalInfo.title = 'Inzynier chmurowy';
      vault.skillsMatrix.hardSkills = ['Docker'];

      const { sim, konsensus, tel } = licz(vault, JD_KUBERNETES, TARGET);
      const simK = kontraktSim(sim, konsensus);
      const telK = kontraktTel(tel);

      expect(sim.layer2Nlp.hardSkillsCoverage).toBe(0);
      expect(konsensus.assessedEngineCount).toBe(konsensus.engines.filter((engine) => engine.score !== null).length);
      expect(konsensus.medianScore).toBeLessThan(65);
      expect(konsensus.careerFitAdvice.assessment).toBe('INSUFFICIENT_EVIDENCE');
      expect(konsensus.consensusGrade).not.toMatch(/EXCELLENT|GOOD/);
      expect(tel.overallScore).toBeNull();
      expect(simK.fitBand).toBe('INSUFFICIENT');
      expect(telK.fitBand).toBe('INSUFFICIENT');
    });
  });
});
