import { describe, it, expect } from 'vitest';
import { hasPositiveSkillEvidence, expandWithAliases } from '../skillEvidence';

describe('skillEvidence — kanoniczny matcher dowodów', () => {
  it('Java != JavaScript w obie strony', () => {
    expect(hasPositiveSkillEvidence('JavaScript React developer', 'java')).toBe(false);
    expect(hasPositiveSkillEvidence('Java Spring developer', 'javascript')).toBe(false);
    expect(hasPositiveSkillEvidence('Znam JavaScript i TypeScript', 'Java')).toBe(false);
  });

  it('C != C++ i C# (granice techniczne)', () => {
    expect(hasPositiveSkillEvidence('C++ developer', 'c')).toBe(false);
    expect(hasPositiveSkillEvidence('C# .NET developer', 'c')).toBe(false);
    expect(hasPositiveSkillEvidence('C developer, język C', 'c')).toBe(true);
    expect(hasPositiveSkillEvidence('C++ developer', 'c++')).toBe(true);
  });

  it('AI != pain/air, Go != good', () => {
    expect(hasPositiveSkillEvidence('I feel pain in the air', 'ai')).toBe(false);
    expect(hasPositiveSkillEvidence('good conditions and long category', 'go')).toBe(false);
    expect(hasPositiveSkillEvidence('Go developer, Golang', 'go')).toBe(true);
  });

  it('odmiana polska nadal matchuje (pythona → python)', () => {
    expect(hasPositiveSkillEvidence('Robiłem rzeczy w Pythonie i z Pythonem', 'python')).toBe(true);
    expect(hasPositiveSkillEvidence('Programista Pythona', 'python')).toBe(true);
  });

  it('negacja nie jest dowodem (EN + PL)', () => {
    expect(hasPositiveSkillEvidence('I do not know Python.', 'python')).toBe(false);
    expect(hasPositiveSkillEvidence('Never worked with AWS.', 'aws')).toBe(false);
    expect(hasPositiveSkillEvidence('Nie znam Pythona.', 'python')).toBe(false);
    expect(hasPositiveSkillEvidence('Nie pracowałem z AWS.', 'aws')).toBe(false);
    expect(hasPositiveSkillEvidence('Brak doświadczenia z Kubernetes.', 'kubernetes')).toBe(false);
    // Kontrast: pozytyw w tym samym zdaniu przed "but" nadal liczy się.
    expect(hasPositiveSkillEvidence('I know Python but do not know Rust.', 'python')).toBe(true);
    expect(hasPositiveSkillEvidence('I know Python but do not know Rust.', 'rust')).toBe(false);
  });

  it('nauka/chęć nie jest doświadczeniem', () => {
    expect(hasPositiveSkillEvidence('Currently learning Kubernetes.', 'kubernetes')).toBe(false);
    expect(hasPositiveSkillEvidence('Interested in React.', 'react')).toBe(false);
    expect(hasPositiveSkillEvidence('Uczę się Pythona.', 'python')).toBe(false);
    expect(hasPositiveSkillEvidence('Zainteresowany Reactem.', 'react')).toBe(false);
  });

  it('wyciek wymagań nie jest dowodem kandydata', () => {
    expect(hasPositiveSkillEvidence('Job requires Python and AWS.', 'python')).toBe(false);
    expect(hasPositiveSkillEvidence('Oferta wymaga prawa jazdy kat. B.', 'prawo jazdy')).toBe(false);
  });

  it('aliasy jawne działają, dorobione nie', () => {
    expect(hasPositiveSkillEvidence('Pracuję w JS na co dzień.', 'javascript')).toBe(true);
    expect(hasPositiveSkillEvidence('Postgres i PSQL w produkcji.', 'postgresql')).toBe(true);
    expect(hasPositiveSkillEvidence('Klastry k8s w produkcji.', 'kubernetes')).toBe(true);
    // React Native nie jest aliasem React (jawnie brak w grafie).
    expect(expandWithAliases('react')).not.toContain('react native');
  });

  it('śmieci nie są dowodem', () => {
    expect(hasPositiveSkillEvidence('--- ...', '---')).toBe(false);
    expect(hasPositiveSkillEvidence('docker', '')).toBe(false);
  });

  it('CASE INVARIANCE: Python == python == PYTHON', () => {
    expect(hasPositiveSkillEvidence('PYTHON developer', 'python')).toBe(true);
    expect(hasPositiveSkillEvidence('python developer', 'PYTHON')).toBe(true);
  });
});
