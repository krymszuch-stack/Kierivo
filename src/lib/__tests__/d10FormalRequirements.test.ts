import { describe, expect, it } from 'vitest';
import { extractD10Requirements } from '../audit-core/d10/requirementParser';
import { runD10FormalAudit } from '../audit-core/d10/engine';

const referenceDateIso = '2026-09-11T00:00:00.000Z';

function vault(overrides: Record<string, unknown> = {}) {
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
      languages: [],
      licenses: [],
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
    ...overrides,
  } as any;
}

describe('D10 Formal Requirements', () => {
  it('returns NOT_APPLICABLE when JD has no formal requirements', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Zakres obowiązków:\nBudowa API w Node.js.\nPraca z PostgreSQL.',
      vault: vault(),
      referenceDateIso,
    });
    expect(result.applicability).toBe('NOT_APPLICABLE');
    expect(result.score).toBeNull();
  });

  it('does not reward irrelevant certificates', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagany język angielski B2',
      vault: vault({
        skillsMatrix: {
          hardSkills: [],
          softSkills: [],
          toolsAndTech: [],
          certifications: [{ id: 'x', name: 'PMP', issuer: 'PMI' }],
        },
      }),
      referenceDateIso,
    });
    expect(result.score).toBe(0);
    expect(result.formal.matches[0].status).toBe('NOT_FOUND');
  });

  it('accepts C1 as satisfying B2', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagany język angielski B2',
      vault: vault({
        profiler: {
          flags: [],
          experienceLevel: 'MID',
          location: { city: 'Kraków', radiusKm: 20, willingnessToTravel: false, hybridWork: true, remoteOnly: false },
          licenses: [],
          languages: [{ id: 'en', language: 'English', level: 'C1', context: 'work' }],
        },
      }),
      referenceDateIso,
    });
    expect(result.score).toBe(100);
    expect(result.formal.matches[0].status).toBe('CONFIRMED');
  });

  it('treats B1 below required B2 as partial, not almost-complete', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagany język angielski B2',
      vault: vault({
        profiler: {
          flags: [],
          experienceLevel: 'MID',
          location: { city: 'Kraków', radiusKm: 20, willingnessToTravel: false, hybridWork: true, remoteOnly: false },
          licenses: [],
          languages: [{ id: 'en', language: 'English', level: 'B1', context: 'work' }],
        },
      }),
      referenceDateIso,
    });
    expect(result.score).toBe(45);
    expect(result.formal.matches[0].status).toBe('PARTIAL');
  });

  it('caps score when an explicit CORE_MUST is materially unmet', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nMandatory: język angielski B2\nMile widziane:\nPMP certification',
      vault: vault({
        skillsMatrix: {
          hardSkills: [], softSkills: [], toolsAndTech: [],
          certifications: [{ id: 'pmp', name: 'PMP', issuer: 'PMI' }],
        },
      }),
      referenceDateIso,
    });
    expect(result.hardCaps.some((cap) => cap.triggered && cap.capLimit === 35)).toBe(true);
    expect(result.score).toBeLessThanOrEqual(35);
  });

  it('returns INSUFFICIENT_DATA instead of FAIL when missing MUST is hidden behind low extraction completeness', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagany język angielski B2',
      candidateText: 'Fragment OCR bez sekcji językowej',
      sourceCompletenessConfidence: 0.4,
      referenceDateIso,
    });
    expect(result.applicability).toBe('INSUFFICIENT_DATA');
    expect(result.score).toBeNull();
    expect(result.formal.matches[0].status).toBe('UNKNOWN');
  });

  it('renormalizes preferred-only requirements without inventing a mandatory group', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Mile widziane:\nPMP certification',
      vault: vault({
        skillsMatrix: {
          hardSkills: [], softSkills: [], toolsAndTech: [],
          certifications: [{ id: 'pmp', name: 'Project Management Professional', issuer: 'PMI' }],
        },
      }),
      referenceDateIso,
    });
    expect(result.score).toBe(100);
    expect(result.formal.mandatoryCoverage).toBeNull();
    expect(result.formal.preferredCoverage).toBe(1);
  });

  it('does not infer a language level when only the language name is present', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagany język angielski B2',
      candidateText: 'Languages: English',
      sourceCompletenessConfidence: 0.95,
      referenceDateIso,
    });
    expect(result.applicability).toBe('INSUFFICIENT_DATA');
    expect(result.score).toBeNull();
    expect(result.formal.matches[0].status).toBe('UNKNOWN');
  });

  it('recognizes CE as satisfying C but not unrelated categories', async () => {
    const pass = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagane prawo jazdy kat. C',
      vault: vault({
        profiler: {
          flags: [], experienceLevel: 'MID',
          location: { city: 'Kraków', radiusKm: 20, willingnessToTravel: false, hybridWork: true, remoteOnly: false },
          languages: [], licenses: ['Prawo jazdy kat. CE'],
        },
      }),
      referenceDateIso,
    });
    const fail = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagane prawo jazdy kat. C',
      vault: vault({
        profiler: {
          flags: [], experienceLevel: 'MID',
          location: { city: 'Kraków', radiusKm: 20, willingnessToTravel: false, hybridWork: true, remoteOnly: false },
          languages: [], licenses: ['Prawo jazdy kat. B'],
        },
      }),
      referenceDateIso,
    });
    expect(pass.score).toBe(100);
    expect(fail.score).toBe(0);
  });

  it('accepts a higher education level but still checks explicit field constraint', async () => {
    const pass = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagane wykształcenie bachelor, kierunek: informatyka',
      vault: vault({
        education: [{
          id: 'e1', institution: 'AGH', degree: 'Magister', fieldOfStudy: 'Informatyka',
          startDate: '2018-10', endDate: '2023-06', description: '',
        }],
      }),
      referenceDateIso,
    });
    const fail = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagane wykształcenie bachelor, kierunek: informatyka',
      vault: vault({
        education: [{
          id: 'e1', institution: 'UJ', degree: 'Magister', fieldOfStudy: 'Historia sztuki',
          startDate: '2018-10', endDate: '2023-06', description: '',
        }],
      }),
      referenceDateIso,
    });
    expect(pass.score).toBe(100);
    expect(fail.score).toBe(0);
  });

  it('requires validity evidence when the JD explicitly requires a valid credential', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagany ważny certyfikat AZ-900',
      vault: vault({
        skillsMatrix: {
          hardSkills: [], softSkills: [], toolsAndTech: [],
          certifications: [{ id: 'az', name: 'AZ-900', issuer: 'Microsoft', date: '2025-01' }],
        },
      }),
      referenceDateIso,
    });
    expect(result.applicability).toBe('INSUFFICIENT_DATA');
    expect(result.score).toBeNull();
    expect(result.formal.matches[0].status).toBe('UNKNOWN');
  });

  it('stops formal requirement scope at neutral JD sections', async () => {
    const extraction = await extractD10Requirements([
      'Wymagania:',
      'Wymagany język angielski B2',
      'Zakres obowiązków:',
      'Współpraca z zespołem posiadającym certyfikat PMP',
    ].join('\n'));
    expect(extraction.requirements).toHaveLength(1);
    expect(extraction.requirements[0].canonicalId).toBe('language.english');
  });

  it('keeps score ledger equal to the final module score', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagany język angielski B2\nMile widziane:\nPMP certification',
      vault: vault({
        profiler: {
          flags: [], experienceLevel: 'MID',
          location: { city: 'Kraków', radiusKm: 20, willingnessToTravel: false, hybridWork: true, remoteOnly: false },
          licenses: [],
          languages: [{ id: 'en', language: 'English', level: 'B2', context: 'work' }],
        },
      }),
      referenceDateIso,
    });
    expect(result.ledger?.finalScore).toBe(result.score);
    expect(result.ledger?.componentRows.length).toBeGreaterThan(0);
    expect(result.ledger?.equationText).toContain('=');
  });

  it('never lets an irrelevant preferred credential compensate a missing CORE_MUST', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nMandatory: uprawnienia SEP G1\nMile widziane:\nPMP certification\nAZ-900 certification',
      vault: vault({
        skillsMatrix: {
          hardSkills: [], softSkills: [], toolsAndTech: [],
          certifications: [
            { id: 'pmp', name: 'PMP', issuer: 'PMI' },
            { id: 'az', name: 'AZ-900', issuer: 'Microsoft' },
          ],
        },
      }),
      referenceDateIso,
    });
    expect(result.formal.missingCoreMustIds.length).toBe(1);
    expect(result.score).toBeLessThanOrEqual(35);
  });

  it('matches a previously unseen certification without a hand-written dictionary entry', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagany certyfikat Foo Bar Professional',
      vault: vault({
        skillsMatrix: {
          hardSkills: [], softSkills: [], toolsAndTech: [],
          certifications: [{ id: 'foo', name: 'Foo Bar Professional', issuer: 'Example Institute' }],
        },
      }),
      referenceDateIso,
    });
    expect(result.score).toBe(100);
    expect(result.formal.matches[0].requirement.canonicalId).toBe('cert.generic.foo-bar-professional');
    expect(result.formal.matches[0].status).toBe('CONFIRMED');
  });

  it('normalizes Polish fluent-language wording before CEFR inference', async () => {
    const result = await runD10FormalAudit({
      jobDescription: 'Wymagania:\nWymagany język angielski B2',
      candidateText: 'Język angielski: biegły',
      sourceCompletenessConfidence: 0.98,
      referenceDateIso,
    });
    expect(result.score).toBe(100);
    expect(result.formal.matches[0].status).toBe('CONFIRMED');
  });
});
