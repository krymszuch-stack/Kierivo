import { describe, expect, it } from 'vitest';
import { runD10FormalAudit } from '../audit-core/d10/engine';
import { buildD10PresentationModel } from '../audit-core/d10/presentation';

const referenceDateIso = '2026-09-11T00:00:00.000Z';

function vault() {
  return {
    version: 'test',
    updatedAt: referenceDateIso,
    profiler: {
      flags: [],
      experienceLevel: 'MID',
      location: {
        city: 'Kraków',
        radiusKm: 20,
        willingnessToTravel: false,
        hybridWork: true,
        remoteOnly: false,
      },
      languages: [{ id: 'en', language: 'English', level: 'B2', context: 'work' }],
      licenses: ['Prawo jazdy kat. B'],
    },
    personalInfo: {
      fullName: 'Test Candidate',
      email: 'test@example.invalid',
      phone: '+48000000000',
      location: 'Kraków',
      title: 'Tester',
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
  } as any;
}

describe('D10 presentation ledger', () => {
  it('makes visible direct requirement points sum to the mathematical pre-cap score when there are no groups', async () => {
    const result = await runD10FormalAudit({
      jobDescription: [
        'Wymagania:',
        'Wymagany język angielski B2',
        'Wymagane prawo jazdy kat. B',
        'Mile widziane:',
        'PMP certification',
      ].join('\n'),
      vault: vault(),
      referenceDateIso,
    });
    const view = buildD10PresentationModel(result);
    const visibleEarned = view.rows.reduce((sum, row) => sum + (row.earnedPoints ?? 0), 0);

    expect(view.preCapScore).not.toBeNull();
    expect(view.groups).toHaveLength(0);
    expect(visibleEarned).toBeCloseTo(view.preCapScore!, 2);
    expect(view.rows.find((row) => row.canonicalId === 'language.english')?.tone).toBe('POSITIVE');
    expect(view.rows.find((row) => row.canonicalId === 'cert.pmp')?.tone).toBe('NEGATIVE');
    expect(view.equationText).toContain('=');
  });

  it('shows a core blocker separately from raw requirement points', async () => {
    const base = vault();
    base.profiler.languages = [];
    base.skillsMatrix.certifications = [{ id: 'pmp', name: 'PMP', issuer: 'PMI' }];

    const result = await runD10FormalAudit({
      jobDescription: [
        'Wymagania:',
        'Mandatory: język angielski B2',
        'Wymagane prawo jazdy kat. B',
        'Mile widziane:',
        'PMP certification',
      ].join('\n'),
      vault: base,
      referenceDateIso,
    });
    const view = buildD10PresentationModel(result);

    expect(view.preCapScore).toBeGreaterThan(35);
    expect(view.finalScore).toBe(35);
    expect(view.activeCapText).toContain('HC_D10_MISSING_CORE_FORMAL_REQUIREMENT');
    expect(view.rows.find((row) => row.canonicalId === 'language.english')?.tone).toBe('NEGATIVE');
    expect(view.rows.find((row) => row.canonicalId === 'cert.pmp')?.tone).toBe('POSITIVE');
  });

  it('does not manufacture point values when mandatory evidence is unknown', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagany język angielski B2',
      candidateText: 'uszkodzony fragment OCR',
      sourceCompletenessConfidence: 0.3,
      referenceDateIso,
    });
    const view = buildD10PresentationModel(result);

    expect(result.applicability).toBe('INSUFFICIENT_DATA');
    expect(view.finalScore).toBeNull();
    expect(view.rows[0].tone).toBe('UNKNOWN');
    expect(view.rows[0].earnedPoints).toBeNull();
    expect(view.rows[0].maxPoints).toBeNull();
  });

  it('renders ANY_OF as one scoring row and keeps alternatives as evidence-only rows', async () => {
    const base = vault();
    base.skillsMatrix.certifications = [{ id: 'pmp', name: 'PMP', issuer: 'PMI' }];
    const result = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nPMP lub PRINCE2',
      vault: base,
      referenceDateIso,
    });
    const view = buildD10PresentationModel(result);
    const visibleEarned = [
      ...view.rows.filter((row) => row.contributesDirectly),
      ...view.groups,
    ].reduce((sum, row) => sum + (row.earnedPoints ?? 0), 0);

    expect(view.groups).toHaveLength(1);
    expect(view.groups[0].operator).toBe('ANY_OF');
    expect(view.groups[0].tone).toBe('POSITIVE');
    expect(view.groups[0].earnedPoints).toBeCloseTo(100, 2);
    expect(view.rows.every((row) => row.contributesDirectly === false)).toBe(true);
    expect(view.rows.every((row) => row.earnedPoints === null && row.maxPoints === null)).toBe(true);
    expect(visibleEarned).toBeCloseTo(view.preCapScore!, 2);
  });
});
