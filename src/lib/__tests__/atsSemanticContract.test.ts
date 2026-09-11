import { describe, expect, it } from 'vitest';
import type { MasterVault, TailoredResume } from '../../types';
import {
  simulateAtsCheck,
  simulateMultiEngineATS,
  type MultiEngineAtsConsensus,
} from '../atsSimulator';
import {
  buildAtsTelemetryReport,
  type AtsTelemetryReport,
} from '../atsScorer';
import { createEmptyVault } from '../sampleVault';

type CoverageBand = 'NONE' | 'PARTIAL' | 'HIGH';
type FitBand = 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH';

interface SemanticContract {
  hasEvidence: boolean;
  missingCount: number;
  coverageBand: CoverageBand;
  fitBand: FitBand;
}

interface FixtureExpectation {
  hasEvidence: boolean;
  coverageBand: CoverageBand;
  missingAtLeast?: number;
  missingExactly?: number;
  requireRealisticFit?: boolean;
  forbidRealisticFit?: boolean;
  maxRecencyScore?: number;
}

interface ContractFixture {
  id: string;
  jd: string;
  vault: MasterVault;
  expectation: FixtureExpectation;
}

const JD_THREE = [
  'Wymagania:',
  '- Kubernetes',
  '- AWS',
  '- Terraform',
].join('\n');

const JD_KUBERNETES = ['Wymagania:', '- Kubernetes'].join('\n');

function coverageBand(score: number): CoverageBand {
  if (score <= 0) return 'NONE';
  if (score < 80) return 'PARTIAL';
  return 'HIGH';
}

/**
 * FitBand w tym teście nie jest aliasem globalnego score ATS. Kontrakt bada
 * wyłącznie semantykę dowodu na wymagania, więc pasmo wyprowadzamy z coverage.
 * Dzięki temu różne wagi layoutu/experience nie tworzą fałszywego konfliktu.
 */
function fitBandFromEvidence(hasEvidence: boolean, coverage: number): FitBand {
  if (!hasEvidence) return 'INSUFFICIENT';
  if (coverage < 50) return 'LOW';
  if (coverage < 80) return 'MEDIUM';
  return 'HIGH';
}

function resumeFor(vault: MasterVault): TailoredResume {
  return {
    targetJobTitle: vault.personalInfo.title || 'Cloud Engineer',
    companyName: '',
    summary: vault.personalInfo.summary || '',
    selectedHighlights: [],
    skillsMatched: {
      hardSkills: [...vault.skillsMatrix.hardSkills],
      toolsAndTech: [...vault.skillsMatrix.toolsAndTech],
      softSkills: [...vault.skillsMatrix.softSkills],
    },
    atsScore: 0,
  };
}

function adaptSimulator(
  vault: MasterVault,
  jd: string,
): {
  contract: SemanticContract;
  result: ReturnType<typeof simulateAtsCheck>;
  consensus: MultiEngineAtsConsensus;
} {
  const result = simulateAtsCheck(resumeFor(vault), vault, jd);
  const consensus = simulateMultiEngineATS(vault, jd, 'Cloud Engineer');
  const hardMatches = result.layer2Nlp.lemmatizedMatches.filter(
    (match) => match.category === 'HARD_SKILL',
  );
  const hasEvidence = hardMatches.length > 0;
  const coverage = result.layer2Nlp.hardSkillsCoverage;

  return {
    contract: {
      hasEvidence,
      missingCount: result.missingHardSkills.length,
      coverageBand: coverageBand(coverage),
      fitBand: fitBandFromEvidence(hasEvidence, coverage),
    },
    result,
    consensus,
  };
}

function adaptTelemetry(vault: MasterVault, jd: string): {
  contract: SemanticContract;
  report: AtsTelemetryReport;
} {
  const report = buildAtsTelemetryReport({ vault, jobDescription: jd });
  const hasEvidence = report.linguisticTelemetry.matchedLemmas.length > 0;
  const coverage = report.formulaBreakdown.hardSkillsScore;

  return {
    contract: {
      hasEvidence,
      missingCount: report.linguisticTelemetry.missingCriticalLemmas.length,
      coverageBand: coverageBand(coverage),
      fitBand: fitBandFromEvidence(hasEvidence, coverage),
    },
    report,
  };
}

function withCurrentExperience(skillsText: string): MasterVault {
  const vault = createEmptyVault('Jan Testowy', 'jan@example.com');
  vault.personalInfo.title = 'Cloud Engineer';
  vault.history = [
    {
      id: 'exp-current',
      company: 'Example Cloud',
      role: 'Cloud Engineer',
      location: 'Kraków',
      startDate: '01/2025',
      endDate: 'Obecnie',
      isCurrent: true,
      highlights: [
        {
          id: 'hl-current',
          text: skillsText,
          action: 'Wdrożyłem',
          target: 'platformę',
          tool: skillsText,
          metric: '',
          keywords: skillsText.split(/[ ,]+/).filter(Boolean),
        },
      ],
    },
  ];
  return vault;
}

function skillsMatrixOnly(...skills: string[]): MasterVault {
  const vault = createEmptyVault('Jan Testowy', 'jan@example.com');
  vault.personalInfo.title = 'Cloud Engineer';
  vault.skillsMatrix.hardSkills = skills;
  return vault;
}

function whitespaceVault(): MasterVault {
  const vault = createEmptyVault(' ', ' ');
  vault.personalInfo.title = ' ';
  vault.personalInfo.summary = '...';
  vault.personalInfo.location = '---';
  vault.skillsMatrix.hardSkills = [' ', '---', '...'];
  vault.skillsMatrix.toolsAndTech = ['   '];
  return vault;
}

const fixtures: ContractFixture[] = [
  {
    id: 'EMPTY_PROFILE',
    jd: JD_THREE,
    vault: createEmptyVault(),
    expectation: {
      hasEvidence: false,
      coverageBand: 'NONE',
      missingAtLeast: 3,
      forbidRealisticFit: true,
      maxRecencyScore: 0,
    },
  },
  {
    id: 'FULL_MATCH',
    jd: JD_THREE,
    vault: withCurrentExperience('Kubernetes AWS Terraform'),
    expectation: {
      hasEvidence: true,
      coverageBand: 'HIGH',
      missingExactly: 0,
      requireRealisticFit: true,
    },
  },
  {
    id: 'PARTIAL_MATCH',
    jd: JD_THREE,
    vault: withCurrentExperience('AWS'),
    expectation: {
      hasEvidence: true,
      coverageBand: 'PARTIAL',
      missingAtLeast: 2,
    },
  },
  {
    id: 'SKILLS_MATRIX_ONLY',
    jd: JD_KUBERNETES,
    vault: skillsMatrixOnly('Kubernetes'),
    expectation: {
      hasEvidence: true,
      coverageBand: 'HIGH',
      missingExactly: 0,
      maxRecencyScore: 40,
    },
  },
  {
    id: 'WHITESPACE_EMPTY_NORMALIZATION',
    jd: JD_THREE,
    vault: whitespaceVault(),
    expectation: {
      hasEvidence: false,
      coverageBand: 'NONE',
      missingAtLeast: 3,
      forbidRealisticFit: true,
      maxRecencyScore: 0,
    },
  },
  {
    id: 'RELATED_BUT_NOT_SAME',
    jd: JD_KUBERNETES,
    vault: skillsMatrixOnly('Docker'),
    expectation: {
      hasEvidence: false,
      coverageBand: 'NONE',
      missingAtLeast: 1,
      forbidRealisticFit: true,
      maxRecencyScore: 0,
    },
  },
];

function assertExpectation(
  fixture: ContractFixture,
  simulator: ReturnType<typeof adaptSimulator>,
  telemetry: ReturnType<typeof adaptTelemetry>,
): void {
  const expected = fixture.expectation;

  expect(simulator.contract.hasEvidence, `${fixture.id}: simulator hasEvidence`).toBe(expected.hasEvidence);
  expect(telemetry.contract.hasEvidence, `${fixture.id}: telemetry hasEvidence`).toBe(expected.hasEvidence);
  expect(simulator.contract.coverageBand, `${fixture.id}: simulator coverageBand`).toBe(expected.coverageBand);
  expect(telemetry.contract.coverageBand, `${fixture.id}: telemetry coverageBand`).toBe(expected.coverageBand);

  if (expected.missingExactly !== undefined) {
    expect(simulator.contract.missingCount, `${fixture.id}: simulator missingCount`).toBe(expected.missingExactly);
    expect(telemetry.contract.missingCount, `${fixture.id}: telemetry missingCount`).toBe(expected.missingExactly);
  }

  if (expected.missingAtLeast !== undefined) {
    expect(simulator.contract.missingCount, `${fixture.id}: simulator missingCount`).toBeGreaterThanOrEqual(expected.missingAtLeast);
    expect(telemetry.contract.missingCount, `${fixture.id}: telemetry missingCount`).toBeGreaterThanOrEqual(expected.missingAtLeast);
  }

  if (expected.requireRealisticFit) {
    expect(simulator.consensus.careerFitAdvice.isRealisticFit, `${fixture.id}: realistic fit`).toBe(true);
  }

  if (expected.forbidRealisticFit) {
    expect(simulator.consensus.careerFitAdvice.isRealisticFit, `${fixture.id}: realistic fit`).toBe(false);
    expect(simulator.consensus.consensusGrade, `${fixture.id}: consensus grade`).not.toMatch(/EXCELLENT|GOOD/);
  }

  if (expected.maxRecencyScore !== undefined) {
    expect(
      simulator.result.layer3Scoring.recencyScore,
      `${fixture.id}: recency without dated evidence`,
    ).toBeLessThanOrEqual(expected.maxRecencyScore);
  }
}

describe('ATS semantic contract: simulator ↔ telemetry', () => {
  for (const fixture of fixtures) {
    it(`${fixture.id}: oba silniki zachowują tę samą semantykę evidence`, () => {
      const simulator = adaptSimulator(fixture.vault, fixture.jd);
      const telemetry = adaptTelemetry(fixture.vault, fixture.jd);

      // To jest właściwy kontrakt cross-engine. Nie porównujemy globalnych score.
      expect(simulator.contract, `${fixture.id}: semantic contract drift`).toEqual(telemetry.contract);
      assertExpectation(fixture, simulator, telemetry);
    });
  }
});
