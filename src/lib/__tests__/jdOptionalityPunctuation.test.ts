import { describe, expect, it } from 'vitest';
import { isNegatedRequirementAt, isPreferredRequirementAt } from '../jdOptionality';

describe('status wymagania z kropką wewnątrz nazwy lub liczby', () => {
  it.each(['.NET', 'Node.js', '1.5 years of experience'])('nie gubi zaprzeczenia po %s', (requirement) => {
    const source = `Requirements\n${requirement} is not required.`;
    expect(isNegatedRequirementAt(source, source.indexOf(requirement))).toBe(true);
  });

  it.each(['.NET', 'Node.js', '1.5 years of experience'])('nie gubi atutu po %s', (requirement) => {
    const source = `Requirements\n${requirement} would be a plus.`;
    expect(isPreferredRequirementAt(source, source.indexOf(requirement))).toBe(true);
  });

  it('osobne zdanie opcjonalne nie zmienia obowiązkowego narzędzia', () => {
    const source = 'Requirements\nNode.js is required. Python would be a plus.';
    expect(isPreferredRequirementAt(source, source.indexOf('Node.js'))).toBe(false);
    expect(isNegatedRequirementAt(source, source.indexOf('Node.js'))).toBe(false);
  });

  it('jawny wymóg po nazwie nie dziedziczy opcjonalności poprzedniego zdania', () => {
    const source = 'Requirements\n.NET is not required.\nPython is required.';
    expect(isPreferredRequirementAt(source, source.indexOf('Python'))).toBe(false);
  });

  it.each(['Experience: min. 5 years', 'Prawo jazdy kat. B'])('skrót w %s nie ukrywa atutu', (requirement) => {
    const source = `${requirement} would be a plus.`;
    expect(isPreferredRequirementAt(source, 0)).toBe(true);
  });
});
