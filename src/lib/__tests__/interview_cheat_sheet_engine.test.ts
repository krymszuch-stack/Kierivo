import { describe, it, expect } from 'vitest';
import {
  buildGlossary,
  buildRedFlagsChecklist,
  buildLocalStarSeeds,
  buildQaBankLocal,
  buildEmergencyPhrasesLocal,
  buildQuestionsToAskLocal,
  buildLocalInterviewCheatSheet,
  mergeGeminiCheatSheetEnrichment,
} from '../interviewCheatSheetEngine';
import { ParsedJobDescription } from '../jdParser';
import { MasterVault } from '../../types';

function makeParsedJD(overrides: Partial<ParsedJobDescription> = {}): ParsedJobDescription {
  return {
    jobTitle: 'Senior Frontend Developer',
    companyName: 'Acme Sp. z o.o.',
    seniorityLevel: 'SENIOR',
    requiredHardSkills: ['React', 'TypeScript'],
    requiredSoftSkills: ['Komunikatywność'],
    toolsAndTech: ['Docker', 'Git'],
    languagesRequired: ['Angielski (B2/C1)'],
    coreResponsibilities: ['Rozwój aplikacji frontendowych', 'Code review'],
    keyKeywords: ['react', 'typescript', 'frontend'],
    mandatoryRequirements: ['Min. 5 lat doświadczenia w React'],
    workModel: 'REMOTE',
    ...overrides,
  };
}

function makeVault(overrides: Partial<MasterVault> = {}): MasterVault {
  return {
    version: '1.0',
    updatedAt: '2026-01-01',
    profiler: {
      flags: [],
      experienceLevel: 'MID',
      location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
      languages: [],
    },
    personalInfo: {
      fullName: 'Jan Kowalski',
      email: 'jan@example.com',
      phone: '000000000',
      location: 'Kraków',
      title: 'Frontend Developer',
      summary: '',
    },
    skillsMatrix: { hardSkills: [], softSkills: [], toolsAndTech: [], certifications: [] },
    history: [
      {
        id: 'exp1',
        company: 'TechCorp',
        role: 'Frontend Developer',
        location: 'Kraków',
        startDate: '2022',
        endDate: 'Obecnie',
        isCurrent: true,
        highlights: [
          {
            id: 'h1',
            text: 'Zbudowałem dashboard w React',
            action: 'Zbudowałem dashboard',
            target: 'panel administracyjny',
            tool: 'React',
            metric: '30% szybsze ładowanie',
            keywords: ['react'],
          },
        ],
      },
    ],
    education: [],
    projects: [],
    ...overrides,
  };
}

describe('interviewCheatSheetEngine determinism', () => {
  it('buildLocalInterviewCheatSheet produces identical content across repeated calls', () => {
    const jd = makeParsedJD();
    const vault = makeVault();

    const runs = Array.from({ length: 10 }, () => {
      const sheet = buildLocalInterviewCheatSheet(jd, vault, jd.jobTitle, jd.companyName);
      // Znacznik czasu jest jedynym polem, które ma się różnić między
      // wywołaniami — reszta ściągi musi być identyczna.
      const { generatedAt: _generatedAt, ...rest } = sheet;
      return JSON.stringify(rest);
    });

    expect(new Set(runs).size).toBe(1);
  });
});

describe('buildGlossary', () => {
  it('gives known dictionary terms their curated definition', () => {
    const glossary = buildGlossary(makeParsedJD());
    const react = glossary.find((g) => g.term.toLowerCase() === 'react');
    expect(react).toBeDefined();
    expect(react!.definition).toMatch(/interfejsów/i);
  });

  /**
   * Reguła 8 z AGENTS.md: domena to prace fizyczne, nie tylko IT. Monter odpada
   * na SEP-ie i UDT, nie na Kubernetesie — glosariusz złożony wyłącznie
   * z terminów programistycznych zostawiłby go z samymi ogólnikami.
   */
  it('defines trade qualifications, not just IT terms', () => {
    const jd = makeParsedJD({
      requiredHardSkills: ['SEP G1', 'UDT', 'MAG'],
      toolsAndTech: ['F-Gaz'],
    });
    const glossary = buildGlossary(jd);

    for (const term of ['SEP G1', 'UDT', 'MAG', 'F-Gaz']) {
      const entry = glossary.find((g) => g.term.toLowerCase() === term.toLowerCase());
      expect(entry, `brak definicji dla ${term}`).toBeDefined();
      expect(entry!.definition).not.toMatch(/Kluczowy termin z oferty/);
    }
  });

  it('gives unknown terms a non-empty generic fallback instead of nothing', () => {
    const glossary = buildGlossary(makeParsedJD({ requiredHardSkills: ['SuperNicheFramework9000'] }));
    const unknown = glossary.find((g) => g.term === 'SuperNicheFramework9000');
    expect(unknown).toBeDefined();
    expect(unknown!.definition.length).toBeGreaterThan(0);
  });
});

describe('buildRedFlagsChecklist', () => {
  it('produces exactly one MUST_KNOW item per mandatory requirement', () => {
    const jd = makeParsedJD({ mandatoryRequirements: ['Wymóg A', 'Wymóg B', 'Wymóg C'] });
    const items = buildRedFlagsChecklist(jd);
    const mustKnow = items.filter((i) => i.severity === 'MUST_KNOW');
    expect(mustKnow.length).toBe(3);
  });

  it('produces zero MUST_KNOW items when there are no mandatory requirements, without throwing', () => {
    const jd = makeParsedJD({ mandatoryRequirements: [] });
    expect(() => buildRedFlagsChecklist(jd)).not.toThrow();
    const items = buildRedFlagsChecklist(jd);
    expect(items.filter((i) => i.severity === 'MUST_KNOW').length).toBe(0);
  });
});

describe('buildLocalStarSeeds', () => {
  it('returns an empty array for an empty work history instead of throwing', () => {
    const jd = makeParsedJD();
    const vault = makeVault({ history: [] });
    expect(() => buildLocalStarSeeds(jd, vault)).not.toThrow();
    expect(buildLocalStarSeeds(jd, vault)).toEqual([]);
  });

  it('keeps the source highlight and leaves unsupported STAR quadrants empty', () => {
    const jd = makeParsedJD();
    const vault = makeVault();
    const seeds = buildLocalStarSeeds(jd, vault);
    expect(seeds.length).toBeGreaterThan(0);
    expect(seeds[0].sourceExperienceId).toBe('exp1');
    expect(seeds[0].sourceEvidence).toMatch(/30% szybsze ładowanie/);
    expect(seeds[0].situation).toBe('');
    expect(seeds[0].task).toBe('');
    expect(seeds[0].action).toBe('');
    expect(seeds[0].result).toBe('');
    expect(seeds[0].sourceEvidence).not.toMatch(/zidentyfikowano potrzebę|odpowiadałem za|Efekt:/i);
  });
});

describe('local skeleton always non-empty for a minimal/near-empty offer', () => {
  it('glossary, qaBank, emergencyPhrases and questionsToAsk are never empty', () => {
    const minimalJd = makeParsedJD({
      requiredHardSkills: [],
      toolsAndTech: [],
      keyKeywords: [],
      mandatoryRequirements: [],
      coreResponsibilities: [],
    });
    const vault = makeVault({ history: [] });
    const sheet = buildLocalInterviewCheatSheet(minimalJd, vault, minimalJd.jobTitle, minimalJd.companyName);

    expect(buildQaBankLocal(minimalJd).length).toBeGreaterThan(0);
    expect(buildEmergencyPhrasesLocal().length).toBeGreaterThan(0);
    expect(buildQuestionsToAskLocal(minimalJd).length).toBeGreaterThan(0);
    expect(sheet.qaBank.length).toBeGreaterThan(0);
    expect(sheet.emergencyPhrases.length).toBeGreaterThan(0);
    expect(sheet.questionsToAsk.length).toBeGreaterThan(0);
  });
});

describe('mergeGeminiCheatSheetEnrichment', () => {
  it('replaces only starTalkingPoints/personalizedFraming/generationMode, leaving other fields untouched', () => {
    const jd = makeParsedJD();
    const vault = makeVault();
    const local = buildLocalInterviewCheatSheet(jd, vault, jd.jobTitle, jd.companyName);

    const enrichment = {
      starTalkingPoints: [
        {
          id: 'ai-1',
          relatedRequirement: 'React',
          situation: 'Sytuacja AI',
          task: 'Zadanie AI',
          action: 'Akcja AI',
          result: 'Wynik AI',
        },
      ],
      personalizedFraming: 'Framing AI',
    };

    const merged = mergeGeminiCheatSheetEnrichment(local, enrichment);

    expect(merged.starTalkingPoints).toEqual(enrichment.starTalkingPoints);
    expect(merged.personalizedFraming).toBe('Framing AI');
    expect(merged.generationMode).toBe('GEMINI_ENRICHED');
    expect(merged.glossary).toEqual(local.glossary);
    expect(merged.qaBank).toEqual(local.qaBank);
    expect(merged.redFlagsChecklist).toEqual(local.redFlagsChecklist);
    expect(merged.questionsToAsk).toEqual(local.questionsToAsk);
  });

  it('keeps the local emergency phrases when the enrichment does not provide any', () => {
    const jd = makeParsedJD();
    const vault = makeVault();
    const local = buildLocalInterviewCheatSheet(jd, vault, jd.jobTitle, jd.companyName);

    const merged = mergeGeminiCheatSheetEnrichment(local, {
      starTalkingPoints: [],
      personalizedFraming: 'x',
    });

    expect(merged.emergencyPhrases).toEqual(local.emergencyPhrases);
  });
});
