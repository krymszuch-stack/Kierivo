import { describe, expect, it, vi, afterAll } from 'vitest';
import cases from './fixtures/release-golden.json';
import { createEmptyVault } from '../sampleVault';
import { simulateAtsCheck, simulateMultiEngineATS } from '../atsSimulator';
import { auditKnockouts } from '../knockouts';
import { scoreCanonicalAts, getUnmetBlockingRequirements } from '../canonicalAts';
import type { TailoredResume } from '../../types';

// Jawne etykiety diagnostyczne, bez dopasowywania progów do obecnych procentów.
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-10-13T00:00:00Z'));
afterAll(() => vi.useRealTimers());

describe('release golden — syntetyczne CV/JD PL/EN, rzeczywisty konsument ATS', () => {
  it.each(cases)('$id', fixture => {
    const vault = createEmptyVault('Kandydat testowy', 'candidate@example.invalid');
    vault.personalInfo.title = fixture.title || '';
    vault.skillsMatrix.hardSkills = [...fixture.skills];
    if (fixture.description) vault.history = [{
      id: 'synthetic-history', company: 'Firma testowa', role: fixture.title || 'Specjalista',
      location: '', startDate: '2022-01', endDate: '2025-12', isCurrent: false,
      description: fixture.description, highlights: [],
    }];
    const resume: TailoredResume = {
      targetJobTitle: fixture.title || '', companyName: '', summary: '', selectedHighlights: [],
      skillsMatched: { hardSkills: [...fixture.skills], toolsAndTech: [], softSkills: [] }, atsScore: 0,
    };
    const original = JSON.stringify({ vault, resume });
    const result = simulateAtsCheck(resume, vault, fixture.jd);
    const canonical = scoreCanonicalAts(vault, fixture.jd);
    const consensus = simulateMultiEngineATS(vault, fixture.jd, fixture.title || '');
    for (const skill of fixture.missing || []) {
      expect(result.matchedKeywords, `fałszywe potwierdzenie: ${skill}`).not.toContain(skill);
      expect(result.missingHardSkills, `niewykazany brak: ${skill}`).toContain(skill);
    }
    for (const skill of fixture.matched || []) expect(result.matchedKeywords).toContain(skill);
    for (const skill of fixture.notMissing || []) expect(result.missingHardSkills).not.toContain(skill);
    if (fixture.noOverall) expect(result.overallScore).toBeNull();
    if (fixture.insufficient) expect(consensus.careerFitAdvice.assessment).toBe('INSUFFICIENT_EVIDENCE');
    if (fixture.formalGap) {
      // SEP/UDT są klasyfikowane jako hard skills w starszym symulatorze.
      // O blokadzie decyduje kanoniczny knockout, nie nazwa dawnego komponentu.
      expect(auditKnockouts(fixture.jd, vault).blocking.length).toBeGreaterThan(0);
      expect(getUnmetBlockingRequirements(canonical).length).toBeGreaterThan(0);
      expect(result.keywordCoverageScore).not.toBe(100);
      expect(consensus.careerFitAdvice.isRealisticFit).toBe(false);
    }
    expect(JSON.stringify({ vault, resume }), 'audyt zmienił fakty źródłowe').toBe(original);
    expect(simulateAtsCheck(resume, vault, fixture.jd)).toEqual(result);
  });
});
