import { describe, expect, it } from 'vitest';
import { getCvExportCompletenessError } from '../cvExportPreflight';
import type { MasterVault } from '../../types';

const complete: MasterVault['history'][number] = {
  id: 'synthetic', company: 'Firma testowa', role: 'Monter', location: '',
  startDate: '2024-01', endDate: '2025-01', isCurrent: false, highlights: [],
};

describe('preflight eksportu doświadczenia', () => {
  it.each([
    { role: '' }, { role: '   ' }, { startDate: '' }, { endDate: '' },
  ])('blokuje brak wymaganej informacji %j bez zmiany źródła', patch => {
    const vault = { history: [{ ...complete, ...patch }] };
    const before = JSON.stringify(vault);
    expect(getCvExportCompletenessError(vault)).toContain('Niekompletny wpis doświadczenia nr 1');
    expect(JSON.stringify(vault)).toBe(before);
  });
  it('dopuszcza brak doświadczenia, kompletny wpis i jawne obecnie bez daty końca', () => {
    expect(getCvExportCompletenessError({ history: [] })).toBeNull();
    expect(getCvExportCompletenessError({ history: [complete] })).toBeNull();
    expect(getCvExportCompletenessError({ history: [{ ...complete, endDate: '', isCurrent: true }] })).toBeNull();
  });
});
