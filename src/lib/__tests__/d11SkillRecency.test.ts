import { describe, expect, it } from 'vitest';
import type { MasterVault } from '../../types';
import { DEFAULT_AUDIT_CORE_CONFIG } from '../audit-core/config';
import { runD11FromVault } from '../audit-core/d11/engine';
import { halfLifeDecay } from '../audit-core/d11/scorer';
import { toMonthIndex } from '../audit-core/temporal';

function vaultWithHistory(history: MasterVault['history']): MasterVault {
  return {
    version: 'test',
    updatedAt: '2026-09-11T00:00:00.000Z',
    profiler: {
      flags: ['OFFICE_IT'],
      experienceLevel: 'MID',
      location: {
        city: 'Kraków',
        radiusKm: 30,
        willingnessToTravel: false,
        hybridWork: true,
        remoteOnly: false,
      },
      languages: [],
    },
    personalInfo: {
      fullName: 'Test User',
      email: '',
      phone: '',
      location: 'Kraków',
      title: 'Developer',
      summary: '',
    },
    skillsMatrix: {
      hardSkills: ['React', 'Python'],
      softSkills: [],
      toolsAndTech: [],
      certifications: [],
    },
    history,
    education: [],
    projects: [],
  };
}

const referenceMonth = toMonthIndex(2026, 9);
const jdReact = ['Wymagania', '- React'].join('\n');

function experience(input: {
  id: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  text: string;
}): MasterVault['history'][number] {
  return {
    id: input.id,
    company: 'Example',
    role: 'Software Engineer',
    location: 'Remote',
    startDate: input.startDate,
    endDate: input.endDate,
    isCurrent: input.isCurrent ?? false,
    highlights: [{
      id: `${input.id}-h`,
      text: input.text,
      action: '',
      target: '',
      tool: '',
      metric: '',
      keywords: [],
    }],
  };
}

describe('D11 Competency Recency & Half-Life Decay', () => {
  it('JOB_FIT agreguje kanoniczny identyfikator D09, a nie nazwę legacy', () => {
    const jobFit = DEFAULT_AUDIT_CORE_CONFIG.domainPolicies.find((policy) => policy.domainId === 'JOB_FIT');
    expect(jobFit?.moduleWeights.MOD_JOB_ALIGNMENT).toBe(1);
    expect(jobFit?.moduleWeights.MOD_KEYWORDS_REQUIREMENTS).toBeUndefined();
  });

  it('ma dokładnie 50% wartości po jednym half-life', () => {
    expect(halfLifeDecay(48, 48)).toBeCloseTo(0.5, 10);
    expect(halfLifeDecay(0, 48)).toBe(1);
  });

  it('ocenia bieżące użycie jako świeże niezależnie od pozycji wpisu w tablicy', async () => {
    const vault = vaultWithHistory([
      experience({ id: 'old', startDate: '2019-01', endDate: '2020-09', text: 'React' }),
      experience({ id: 'current', startDate: '2025-01', endDate: '', isCurrent: true, text: 'React' }),
    ]);

    const result = await runD11FromVault({ vault, jobDescription: jdReact, referenceMonth, vaultCompletenessConfidence: 1 });

    expect(result.score).toBeCloseTo(100, 8);
    expect(result.recency.requirements[0]?.freshestAgeMonths).toBe(0);
    expect(result.applicability).toBe('APPLICABLE');
  });

  it('nie daje legacy floor 40 ani domyślnego 80, tylko ciągły decay', async () => {
    const vault = vaultWithHistory([
      experience({ id: 'old', startDate: '2021-01', endDate: '2022-09', text: 'React' }),
    ]);

    const result = await runD11FromVault({ vault, jobDescription: jdReact, referenceMonth, halfLifeMonths: 48, vaultCompletenessConfidence: 1 });

    expect(result.score).toBeCloseTo(50, 6);
    expect(result.score).not.toBe(40);
    expect(result.score).not.toBe(80);
  });

  it('nie traktuje brakującej daty jako starej kompetencji', async () => {
    const vault = vaultWithHistory([
      experience({ id: 'undated', startDate: '', endDate: '', text: 'React' }),
    ]);

    const result = await runD11FromVault({ vault, jobDescription: jdReact, referenceMonth, vaultCompletenessConfidence: 1 });

    expect(result.score).toBeNull();
    expect(result.applicability).toBe('INSUFFICIENT_DATA');
    expect(result.missingEvidence.some((item) => item.requirementCode === 'D11_INVALID_TEMPORAL_EVIDENCE')).toBe(true);
  });

  it('nie nalicza drugi raz braku kompetencji, bo presence należy do D09', async () => {
    const vault = vaultWithHistory([]);
    vault.skillsMatrix.hardSkills = [];

    const result = await runD11FromVault({ vault, jobDescription: jdReact, referenceMonth, vaultCompletenessConfidence: 1 });

    expect(result.score).toBeNull();
    expect(result.applicability).toBe('NOT_APPLICABLE');
    expect(result.recency.matchedSkillRequirementCount).toBe(0);
  });

  it('odrzuca przyszłą datę zamiast uznawać ją za super-świeży dowód', async () => {
    const vault = vaultWithHistory([
      experience({ id: 'future', startDate: '2027-01', endDate: '2027-03', text: 'React' }),
    ]);

    const result = await runD11FromVault({ vault, jobDescription: jdReact, referenceMonth, vaultCompletenessConfidence: 1 });

    expect(result.score).toBeNull();
    expect(result.applicability).toBe('INSUFFICIENT_DATA');
    expect(result.missingEvidence.some((item) => item.requirementCode === 'D11_INVALID_TEMPORAL_EVIDENCE')).toBe(true);
  });
});
