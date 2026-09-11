import { describe, it, expect } from 'vitest';
import { scoreCanonicalAts, recomputeCanonicalTotal, CANONICAL_WEIGHTS } from '../canonicalAts';
import { createEmptyVault } from '../sampleVault';
import type { MasterVault } from '../../types';

/**
 * Kanoniczny wynik ATS: specyfikacja i własności (fazy 3, 6, 9, 11).
 */

function vaultWith(over: Partial<{
  title: string; summary: string; hard: string[]; tools: string[];
  history: MasterVault['history'];
}> = {}): MasterVault {
  const v = createEmptyVault('Jan Kowalski', 'jan@example.com');
  v.personalInfo.title = over.title ?? 'Developer';
  v.personalInfo.summary = over.summary ?? '';
  v.skillsMatrix.hardSkills = over.hard ?? [];
  v.skillsMatrix.toolsAndTech = over.tools ?? [];
  v.history = over.history ?? [];
  return v;
}

function hist(id: string, text: string, start = '2020-01', end = '2024-01') {
  return {
    id, company: 'X', role: 'Developer', location: '', startDate: start,
    endDate: end, isCurrent: false,
    highlights: [{ id: `h-${id}`, text, action: '', target: '', tool: '', metric: '', keywords: [] }],
  };
}

const JD = 'We need Python developer. Requirements: Python, AWS, Docker.';

describe('kanon: kształt i granice', () => {
  it('wagi sumują się do 1', () => {
    expect(
      CANONICAL_WEIGHTS.skills + CANONICAL_WEIGHTS.experience +
      CANONICAL_WEIGHTS.structure + CANONICAL_WEIGHTS.formal
    ).toBeCloseTo(1, 10);
  });

  it('0 <= score <= 100 i uzgodnienie z komponentami', () => {
    const v = vaultWith({ hard: ['Python'], tools: ['AWS'], history: [hist('1', 'Python AWS work')] });
    const r = scoreCanonicalAts(v, JD, 'Developer');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(recomputeCanonicalTotal(r.components)).toBe(r.score);
    expect(r.state).toBe('SCORABLE');
  });

  it('stany puste: score 0 + jawny stan', () => {
    const full = vaultWith({ hard: ['Python'], history: [hist('1', 'Python')] });
    expect(scoreCanonicalAts(full, '   ').state).toBe('INSUFFICIENT_JD');
    expect(scoreCanonicalAts(full, '   ').score).toBe(0);
    const empty = vaultWith({ title: '', hard: [] });
    const re = scoreCanonicalAts(empty, JD);
    expect(re.state).toBe('INSUFFICIENT_CV');
    expect(re.score).toBe(0);
    expect(scoreCanonicalAts(full, 'Ładna kultura pracy i owoce w biurze.').state)
      .toBe('NO_REQUIREMENTS_DETECTED');
  });
});

describe('kanon: własności', () => {
  it('DETERMINIZM: ten sam wkład → ten sam wynik', () => {
    const mk = () => vaultWith({ hard: ['Python'], tools: ['AWS'], history: [hist('1', 'Python AWS work')] });
    expect(scoreCanonicalAts(mk(), JD).score).toBe(scoreCanonicalAts(mk(), JD).score);
  });

  it('MONOTONICZNOŚĆ: zweryfikowany dowód nie obniża skills', () => {
    const base = vaultWith({ hard: ['Python'], history: [hist('1', 'Python work')] });
    const plus = vaultWith({ hard: ['Python', 'AWS'], history: [hist('1', 'Python AWS work')] });
    expect(scoreCanonicalAts(plus, JD).components.skills)
      .toBeGreaterThanOrEqual(scoreCanonicalAts(base, JD).components.skills);
  });

  it('USUWANIE: utrata dowodu nie podnosi skills', () => {
    const full = vaultWith({ hard: ['Python', 'AWS'], history: [hist('1', 'Python AWS work')] });
    const less = vaultWith({ hard: ['Python'], history: [hist('1', 'Python work')] });
    expect(scoreCanonicalAts(less, JD).components.skills)
      .toBeLessThanOrEqual(scoreCanonicalAts(full, JD).components.skills);
  });

  it('NEGACJA: `do not know Python` nie spełnia', () => {
    const v = vaultWith({ summary: 'I do not know Python.', history: [hist('1', 'I do not know Python.')] });
    const r = scoreCanonicalAts(v, 'Need Python developer');
    expect(r.missingRequirements).toContain('python');
    expect(r.matchedRequirements).not.toContain('python');
  });

  it('DUPLIKACJA: ×3 treści ≈ ten sam wynik', () => {
    const one = vaultWith({ hard: ['Python'], tools: ['AWS'], history: [hist('1', 'Python AWS')] });
    const tri = vaultWith({ hard: ['Python'], tools: ['AWS'], history: [hist('1', 'Python AWS Python AWS Python AWS')] });
    tri.personalInfo.summary = 'Python AWS Python AWS';
    expect(Math.abs(scoreCanonicalAts(tri, JD).score - scoreCanonicalAts(one, JD).score)).toBeLessThanOrEqual(5);
  });

  it('BIAŁE ZNAKI: wariant formatowania ≈ ten sam wynik', () => {
    const a = vaultWith({ hard: ['Python'], history: [hist('1', 'Python AWS work')] });
    const b = vaultWith({ hard: ['Python'], history: [hist('1', '  python   AWS\n\nwork  ')] });
    expect(Math.abs(scoreCanonicalAts(a, JD).score - scoreCanonicalAts(b, JD).score)).toBeLessThanOrEqual(3);
  });
});
