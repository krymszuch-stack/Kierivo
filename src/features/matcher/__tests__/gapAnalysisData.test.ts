import { describe, expect, it } from 'vitest';
import type { AtsCheckResult } from '../../../types';
import { createEmptyVault } from '../../../lib/sampleVault';
import { scoreCanonicalAts } from '../../../lib/canonicalAts';
import { buildGapMetrics } from '../gapAnalysisData';

describe('wiersze analizy luk raportu ATS', () => {
  it('w raporcie bieżącym pokazuje kanoniczne umiejętności zamiast sprzecznego legacy', () => {
    const profile = createEmptyVault('Alicja Testowa');
    profile.personalInfo.summary = 'Doświadczenie w utrzymaniu aplikacji webowych i pracy zespołowej.';
    profile.skillsMatrix.hardSkills = ['TypeScript', 'React'];
    const canonical = scoreCanonicalAts(profile, 'Wymagania: TypeScript, React.');
    const legacy = {
      keywordCoverageScore: 17,
      layer2Nlp: { hardSkillsCoverage: 17 },
    } as AtsCheckResult;

    const metrics = buildGapMetrics(legacy, canonical);

    expect(canonical.components.skills).toBe(100);
    expect(metrics[0]).toEqual({ label: 'Umiejętności wymagane w ofercie', value: 100 });
    expect(metrics).toHaveLength(4);
  });

  it('migawka bez wyniku kanonicznego zachowuje diagnostykę historyczną', () => {
    const legacy = {
      keywordCoverageScore: 17,
      layer2Nlp: { hardSkillsCoverage: 17 },
      layer3Scoring: { recencyScore: 30, titleMatchScore: 45 },
    } as AtsCheckResult;

    expect(buildGapMetrics(legacy)[0]).toEqual({ label: 'Kompetencje Twarde & Technologie', value: 17 });
    expect(buildGapMetrics(legacy).map(({ label }) => label)).toContain('Dopasowanie Tytułu Stanowiska (Title Density)');
  });

  it('nie zamienia błędnych historycznych procentów w wiarygodnie wyglądające wyniki', () => {
    const legacy = {
      layer2Nlp: { hardSkillsCoverage: 150, formalReqsCoverage: -1 },
      layer3Scoring: { recencyScore: Number.NaN, titleMatchScore: Number.POSITIVE_INFINITY },
    } as AtsCheckResult;

    expect(buildGapMetrics(legacy).map(({ value }) => value)).toEqual([undefined, undefined, undefined, undefined]);
  });
});
