import { describe, expect, it } from 'vitest';
import type { MasterVault } from '../../types';
import { buildPlainTextCanonicalDocument } from '../audit-core/document';
import { runD09FromCanonicalDocument, runD09FromVault } from '../audit-core/d09/engine';

function baseVault(): MasterVault {
  return {
    version: 'test',
    updatedAt: '2026-09-11T00:00:00.000Z',
    profiler: {
      flags: ['OFFICE_IT'],
      experienceLevel: 'MID',
      location: {
        city: 'Kraków',
        radiusKm: 30,
        willingnessToTravel: true,
        hybridWork: true,
        remoteOnly: false,
      },
      languages: [],
      licenses: [],
    },
    personalInfo: {
      fullName: 'Test Candidate',
      email: 'candidate@example.test',
      phone: '+48 500 000 000',
      location: 'Kraków',
      title: 'Software Engineer',
      summary: '',
    },
    skillsMatrix: {
      hardSkills: [],
      softSkills: [],
      toolsAndTech: [],
      certifications: [],
    },
    history: [],
    education: [],
    projects: [],
  };
}

const JD = `
Requirements:
- Java
- PostgreSQL

Nice to have:
- AWS
`;

describe('D09 — pełny pipeline', () => {
  it('uruchamia JD parser, Vault evidence i Score Ledger jako jeden przepływ', async () => {
    const vault = baseVault();
    vault.skillsMatrix.hardSkills = ['Java', 'PostgreSQL'];
    vault.projects.push({
      id: 'p1',
      name: 'Cloud app',
      role: 'Developer',
      description: 'Wdrożenie aplikacji Java z PostgreSQL na AWS.',
      techStack: ['Java', 'PostgreSQL', 'AWS'],
    });

    const result = await runD09FromVault({ vault, jobDescription: JD });

    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThan(75);
    expect(result.alignment.requirementMatches).toHaveLength(3);
    expect(result.alignment.requirementMatches.every((match) => match.status !== 'UNKNOWN')).toBe(true);
    expect(result.ledger?.finalScore).toBe(result.score);
    expect(result.verdict).toContain('nie prawdopodobieństwo zatrudnienia');
  });

  it('mocniejszy dowód w doświadczeniu daje wyższy wynik niż ta sama lista skills bez kontekstu', async () => {
    const listOnly = baseVault();
    listOnly.skillsMatrix.hardSkills = ['Java', 'PostgreSQL'];

    const inExperience = baseVault();
    inExperience.history.push({
      id: 'e1',
      company: 'Example',
      role: 'Developer',
      location: 'Kraków',
      startDate: '2024-01',
      endDate: '',
      isCurrent: true,
      description: 'Rozwijam usługi Java korzystające z PostgreSQL.',
      highlights: [
        {
          id: 'h1',
          text: 'Projektowanie usług Java z PostgreSQL.',
          action: 'Projektowanie',
          target: 'usług',
          tool: 'Java PostgreSQL',
          metric: '',
          keywords: ['Java', 'PostgreSQL'],
        },
      ],
    });

    const weak = await runD09FromVault({ vault: listOnly, jobDescription: JD });
    const strong = await runD09FromVault({ vault: inExperience, jobDescription: JD });

    expect(weak.score).not.toBeNull();
    expect(strong.score).not.toBeNull();
    expect(strong.score!).toBeGreaterThan(weak.score!);
  });

  it('niepewna ekstrakcja dokumentu nie zamienia niewidocznych kompetencji w fałszywe braki', async () => {
    const document = buildPlainTextCanonicalDocument(`
TEST CANDIDATE
candidate@example.test

EXPERIENCE
Helpdesk and infrastructure support.

EDUCATION
Example University
`, {
      extractionConfidence: 0.40,
      source: 'EXTERNAL_DOCUMENT',
    });

    const result = await runD09FromCanonicalDocument({ document, jobDescription: JD });

    expect(result.score).toBeNull();
    expect(result.applicability).toBe('INSUFFICIENT_DATA');
    const mustMatches = result.alignment.requirementMatches.filter((match) => match.requirement.priority === 'MUST');
    expect(mustMatches.every((match) => match.status === 'UNKNOWN')).toBe(true);
    expect(result.alignment.uncertainty.width).toBeGreaterThan(30);
  });

  it('poradnik nie jest zerowym Job Alignment, tylko NON_CV / N/A', async () => {
    const document = buildPlainTextCanonicalDocument(`
Poradnik CV
Jak napisać dobre CV
Metoda 5 Why
Góra lodowa
`, {
      extractionConfidence: 0.95,
      source: 'EXTERNAL_DOCUMENT',
    });

    const result = await runD09FromCanonicalDocument({ document, jobDescription: JD });
    expect(result.score).toBeNull();
    expect(result.applicability).toBe('NOT_APPLICABLE');
    expect(result.verdictCode).toBe('D09_NON_CV_INPUT');
  });
});
