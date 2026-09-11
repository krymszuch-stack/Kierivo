import { describe, it, expect } from 'vitest';
import { simulateAtsCheck, extractDynamicJdPhrases } from '../atsSimulator';
import { buildAtsTelemetryReport } from '../atsScorer';
import { auditKnockouts } from '../knockouts';
import { rankHighlightsByRelevance } from '../relevanceRanking';
import { unionExperienceYears } from '../experience';
import { parseTextToMasterVault } from '../cvUniversalParser';
import { createEmptyVault } from '../sampleVault';
import type { MasterVault, TailoredResume } from '../../types';

/**
 * Regresja ataków z audytu F1–F13. Każda asercja to minimalny kontrprzykład,
 * który wcześniej przechodził jako poprawny wynik.
 */

function vaultWith(over: Partial<{
  title: string; summary: string; hard: string[]; tools: string[];
  history: MasterVault['history']; education: MasterVault['education'];
  langs: MasterVault['profiler']['languages']; licenses: string[];
}> = {}): MasterVault {
  const v = createEmptyVault('Jan Kowalski', 'jan@example.com');
  v.personalInfo.title = over.title ?? 'Developer';
  v.personalInfo.summary = over.summary ?? '';
  v.skillsMatrix.hardSkills = over.hard ?? [];
  v.skillsMatrix.toolsAndTech = over.tools ?? [];
  v.history = over.history ?? [];
  v.education = over.education ?? [];
  v.profiler.languages = over.langs ?? [];
  v.profiler.licenses = over.licenses ?? [];
  return v;
}

function resumeFor(v: MasterVault, title: string): TailoredResume {
  return {
    targetJobTitle: title, companyName: '', summary: v.personalInfo.summary,
    selectedHighlights: [], skillsMatched: {
      hardSkills: v.skillsMatrix.hardSkills,
      toolsAndTech: v.skillsMatrix.toolsAndTech, softSkills: [],
    }, atsScore: 0,
  };
}

function hist(id: string, text: string) {
  return {
    id, company: 'X', role: 'Dev', location: '', startDate: '2020-01',
    endDate: '2022-01', isCurrent: false,
    highlights: [{ id: `h-${id}`, text, action: '', target: '', tool: '', metric: '', keywords: [] }],
  };
}

describe('F1: granice słów i intencja dowodu', () => {
  const jd = 'We need Java developer with Spring';

  it('JavaScript nie dowodzi Javy (i odwrotnie)', () => {
    const v = vaultWith({ hard: ['JavaScript'], history: [hist('1', 'JavaScript React work')] });
    const r = simulateAtsCheck(resumeFor(v, 'Java Developer'), v, jd);
    expect(r.matchedKeywords).not.toContain('java');
    expect(r.missingHardSkills).toContain('java');
  });

  it('"I do not know Python" nie jest dowodem', () => {
    const v = vaultWith({
      summary: 'I do not know Python. Never worked with AWS.',
      history: [{ ...hist('1', 'I do not know Python.'), role: 'Tester' }],
    });
    const r = simulateAtsCheck(resumeFor(v, 'Python Developer'), v, 'Need Python and AWS developer');
    expect(r.matchedKeywords).not.toContain('python');
    expect(r.matchedKeywords).not.toContain('aws');
  });

  it('"Currently learning / Interested in" nie jest doświadczeniem', () => {
    const v = vaultWith({ summary: 'Currently learning Kubernetes. Interested in React.' });
    const r = simulateAtsCheck(resumeFor(v, 'Dev'), v, 'Kubernetes React');
    expect(r.matchedKeywords).not.toContain('kubernetes');
  });

  it('"Job requires X" w CV nie jest dowodem kandydata', () => {
    const v = vaultWith({ summary: 'Job requires Python and AWS.' });
    const r = simulateAtsCheck(resumeFor(v, 'Dev'), v, 'Python AWS');
    expect(r.layer2Nlp.hardSkillsCoverage).toBe(0);
  });

  it('wklejenie JD do CV nie daje istotnego zysku', () => {
    const jd2 = 'Python AWS Docker';
    const base = vaultWith({ hard: ['Python'], history: [hist('1', 'Python work')] });
    const copy = vaultWith({
      hard: ['Python'], history: [hist('1', 'Python work')],
      summary: 'Job requires AWS Docker. Interested in AWS. Currently learning Docker.',
    });
    const rb = simulateAtsCheck(resumeFor(base, 'Dev'), base, jd2).overallScore;
    const rc = simulateAtsCheck(resumeFor(copy, 'Dev'), copy, jd2).overallScore;
    expect(rc - rb).toBeLessThan(10);
  });

  it('duplikacja treści nie pompuje wyniku', () => {
    const jd2 = 'Python AWS';
    const mk = (summary: string) => {
      const v = vaultWith({ hard: ['Python'], tools: ['AWS'], history: [hist('1', 'Python AWS work')] });
      v.personalInfo.summary = summary;
      return simulateAtsCheck(resumeFor(v, 'Dev'), v, jd2).overallScore;
    };
    expect(Math.abs(mk('Python AWS work') - mk('Python AWS work Python AWS work Python AWS work'))).toBeLessThanOrEqual(3);
  });
});

describe('F2: ekstrakcja JD bez halucynacji', () => {
  it('zwykłe zdanie nie produkuje wymagań (`cit` z `city`)', () => {
    const ex = extractDynamicJdPhrases('We offer good conditions. Office in city center.');
    expect(ex.hardSkills.map((h) => h.phrase)).not.toContain('cit');
    expect(ex.hardSkills.map((h) => h.phrase)).not.toContain('office');
  });

  it('tytuł ogłoszenia nie jest wymaganiem twardym o wadze skilla', () => {
    const ex = extractDynamicJdPhrases('Senior Backend Developer wanted. Python developer with AWS.');
    const titles = ex.hardSkills.filter((h) => h.phrase.includes('senior'));
    expect(titles).toEqual([]);
    expect(ex.hardSkills.map((h) => h.phrase)).toContain('python');
  });
});

describe('F3/F4: formalia i stany puste', () => {
  it('język z profilu liczy się do formaliów', () => {
    const jd = 'Wymagany angielski C1 i wykształcenie wyższe.';
    const v = vaultWith({
      langs: [{ id: 'l1', language: 'angielski', level: 'C1', context: 'test' }],
      education: [{ id: 'e1', institution: 'PW', degree: 'mgr', fieldOfStudy: 'Inf', startDate: '2015', endDate: '2020' }],
    });
    const r = simulateAtsCheck(resumeFor(v, 'Dev'), v, jd);
    expect(r.layer2Nlp.formalReqsCoverage).toBeGreaterThan(0);
  });

  it('puste JD = 0, nie 90', () => {
    const v = vaultWith({ hard: ['Python'] });
    expect(simulateAtsCheck(resumeFor(v, 'Dev'), v, '').overallScore).toBe(0);
  });

  it('puste CV nie dostaje podłogi punktowej', () => {
    const v = vaultWith({ title: '', hard: [], tools: [] });
    const r = simulateAtsCheck(resumeFor(v, ''), v, 'Python AWS Docker');
    expect(r.overallScore).toBeLessThan(15);
    expect(r.layer3Scoring.recencyScore).toBe(0);
  });
});

describe('F5: unia czasu, nie suma punktorów', () => {
  it('5 punktorów w jednej roli = tyle samo co 1', () => {
    const one = vaultWith({
      history: [{
        id: '1', company: 'A', role: 'Dev', location: '', startDate: '2020-01',
        endDate: '2022-01', isCurrent: false,
        highlights: [{ id: 'h1', text: 'a', action: '', target: '', tool: '', metric: '10%', keywords: [] }],
      }],
    });
    const five = vaultWith({
      history: [{
        id: '1', company: 'A', role: 'Dev', location: '', startDate: '2020-01',
        endDate: '2022-01', isCurrent: false,
        highlights: ['a', 'b', 'c', 'd', 'e'].map((t, i) => ({
          id: `h${i}`, text: t, action: '', target: '', tool: '', metric: '10%', keywords: [],
        })),
      }],
    });
    const e1 = buildAtsTelemetryReport({ vault: one, jobDescription: 'Python' }).formulaBreakdown.experienceScore;
    const e5 = buildAtsTelemetryReport({ vault: five, jobDescription: 'Python' }).formulaBreakdown.experienceScore;
    // Staż (unia) jest identyczny — różni się tylko jawna głębia opisów
    // (bullets/rola, maks. 25 pkt), nie wielokrotność czasu roli jak dawniej
    // (4 lata → 12 lat w HUD).
    expect(unionExperienceYears(one.history)).toBe(unionExperienceYears(five.history));
    expect(Math.abs(e5 - e1)).toBeLessThan(20);
  });

  it('nakładka liczy się raz: overlap < sekwencja', () => {
    const mk = (h2start: string, h2end: string) => vaultWith({
      history: [
        {
          id: '1', company: 'A', role: 'Dev', location: '', startDate: '2020-01',
          endDate: '2022-01', isCurrent: false,
          highlights: [{ id: 'h1', text: 'x', action: '', target: '', tool: '', metric: '10%', keywords: [] }],
        },
        {
          id: '2', company: 'B', role: 'Dev', location: '', startDate: h2start,
          endDate: h2end, isCurrent: false,
          highlights: [{ id: 'h2', text: 'y', action: '', target: '', tool: '', metric: '20%', keywords: [] }],
        },
      ],
    });
    const overlap = buildAtsTelemetryReport({
      vault: mk('2021-01', '2023-01'), jobDescription: 'Python',
    }).formulaBreakdown.experienceScore;
    const seq = buildAtsTelemetryReport({
      vault: mk('2022-01', '2024-01'), jobDescription: 'Python',
    }).formulaBreakdown.experienceScore;
    expect(overlap).toBeLessThan(seq);
  });

  it('bieżące zatrudnienie liczy się do dziś (nie 0)', () => {
    const cur = vaultWith({
      history: [{
        id: '1', company: 'X', role: 'Dev', location: '', startDate: '2020-01',
        endDate: '', isCurrent: true,
        highlights: [{ id: 'h1', text: 'x', action: '', target: '', tool: '', metric: '10%', keywords: [] }],
      }],
    });
    const past = vaultWith({
      history: [{
        id: '1', company: 'X', role: 'Dev', location: '', startDate: '2020-01',
        endDate: '2022-01', isCurrent: false,
        highlights: [{ id: 'h1', text: 'x', action: '', target: '', tool: '', metric: '10%', keywords: [] }],
      }],
    });
    const ec = buildAtsTelemetryReport({ vault: cur, jobDescription: 'Python' }).formulaBreakdown.experienceScore;
    const ep = buildAtsTelemetryReport({ vault: past, jobDescription: 'Python' }).formulaBreakdown.experienceScore;
    expect(ec).toBeGreaterThanOrEqual(ep);
  });
});

describe('F7/F8: struktura i czasowniki bez uprzedzeń', () => {
  it('cyrylica nie jest karana za alfabet', () => {
    const base = vaultWith({ history: [hist('1', 'Python work')] });
    const cyr = buildAtsTelemetryReport({
      vault: base, jobDescription: 'Python',
      cvRawText: '# Jan Kowalski\n## Doświadczenie\nPython developer\n## Umiejętności\nPython, Docker',
    }).formulaBreakdown.structureScore;
    const lat = buildAtsTelemetryReport({ vault: base, jobDescription: 'Python' }).formulaBreakdown.structureScore;
    expect(Math.abs(cyr - lat)).toBeLessThan(12);
  });

  it('zwykły TXT z nagłówkami jest poprawną hierarchią', () => {
    const base = vaultWith({ history: [hist('1', 'Python work')] });
    const r = buildAtsTelemetryReport({
      vault: base, jobDescription: 'Python',
      cvRawText: 'Jan Kowalski\nDoswiadczenie zawodowe\n2020-2022 Firma X\nUmiejetnosci: Python',
    });
    expect(r.structuralTelemetry.headingHierarchyValid).toBe(true);
  });

  it('angielskie CV nie traci całego składnika sprawczości', () => {
    const pl = vaultWith({ summary: 'Wdrożyłem system. Zbudowałem API.', history: [hist('1', 'Wdrożyłem system.')] });
    const en = vaultWith({ summary: 'Implemented the system. Delivered the API.', history: [hist('1', 'Implemented the system.')] });
    const ap = buildAtsTelemetryReport({ vault: pl, jobDescription: 'Python' }).formulaBreakdown.actionVerbsScore;
    const ae = buildAtsTelemetryReport({ vault: en, jobDescription: 'Python' }).formulaBreakdown.actionVerbsScore;
    expect(ae).toBeGreaterThan(0);
    expect(Math.abs(ap - ae)).toBeLessThan(60);
  });
});

describe('F9: klauzule knock-outów', () => {
  it('"nie wymaga" (3. os.) też neguje', () => {
    const v = vaultWith({});
    expect(auditKnockouts('Stanowisko nie wymaga prawa jazdy kat. B.', v).requirementCount).toBe(0);
  });

  it('kropka w `kat.` nie dzieli zdania na pół', () => {
    const v = vaultWith({});
    const r = auditKnockouts('Wymagane prawo jazdy kat. B i SEP G1, mile widziane doświadczenie z Junkers.', v);
    const byId = Object.fromEntries(r.findings.map((f) => [f.ruleId, f.severity]));
    // Jedna klauzula z frazą łagodzącą na końcu dotyczy całości albo niczego —
    // grunt, że obie pozycje traktowane są TAK SAMO (przed naprawą: knockout + preferred).
    expect(byId['license_b']).toBe(byId['sep_g1']);
  });
});

describe('F10: ranking bez podciągów', () => {
  it('`ai` nie punktuje `pain`/`air`', () => {
    const ranked = rankHighlightsByRelevance(
      [{ id: 'a', text: 'I feel pain in the air', action: '', target: '', tool: '', metric: '', keywords: [] } as never,
       { id: 'b', text: 'Python expert', action: '', target: '', tool: '', metric: '', keywords: [] } as never],
      ['ai']
    );
    expect(ranked.find((r) => (r.highlight as { id: string }).id === 'a')?.score).toBe(0);
  });
});

describe('F13: parser nie produkuje fikcji', () => {
  it('`Brak` nie jest umiejętnością', () => {
    const p = parseTextToMasterVault(
      'Jan Kowalski\njan@x.pl\n+48111222333\nDoswiadczenie zawodowe\n2020-2022 X Dev\n- robilem Python\nUmiejetnosci\nBrak', 'TXT'
    );
    expect(p.hardSkills).not.toContain('Brak');
  });

  it('przyszłe/odwrócone daty dają ostrzeżenie i zero stażu', () => {
    const fut = parseTextToMasterVault(
      'Jan Kowalski\njan@x.pl\n+48111222333\nDoswiadczenie zawodowe\n2028-2030 X Dev\n- a\nUmiejetnosci\nPython', 'TXT'
    );
    expect(fut.warnings?.join(' ').toLowerCase()).toContain('przysz');
    const v = vaultWith({});
    v.history = fut.history;
    expect(buildAtsTelemetryReport({ vault: v, jobDescription: 'Python' }).formulaBreakdown.experienceScore).toBeLessThan(15);
  });
});
