import { describe, expect, it } from 'vitest';
import { getCvExportCompletenessError } from '../cvExportPreflight';
import type { MasterVault } from '../../types';
import { createEmptyVault } from '../sampleVault';

const complete: MasterVault['history'][number] = {
  id: 'synthetic', company: 'Firma testowa', role: 'Monter', location: '',
  startDate: '2024-01', endDate: '2025-01', isCurrent: false, highlights: [],
};

describe('preflight eksportu doświadczenia', () => {
  it.each([
    { role: '' }, { role: '   ' }, { startDate: '' }, { endDate: '' }, { company: '' },
  ])('blokuje brak wymaganej informacji %j bez zmiany źródła', patch => {
    const vault = { history: [{ ...complete, ...patch }] };
    const before = JSON.stringify(vault);
    expect(getCvExportCompletenessError(vault)).toContain('Niekompletny wpis doświadczenia nr 1');
    expect(JSON.stringify(vault)).toBe(before);
  });
  it('nie eksportuje pustej edukacji ani projektu bez nazwy', () => {
    const vault = createEmptyVault('Profil testowy');
    vault.education = [{ id: 'draft', institution: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '' }];
    expect(getCvExportCompletenessError(vault)).toContain('Niekompletny wpis edukacji');
    vault.education = [];
    vault.projects = [{ id: 'draft', name: '', role: 'Autor', description: '', techStack: [] }];
    expect(getCvExportCompletenessError(vault)).toContain('Niekompletny wpis projektu');
  });
  it('nie wymaga uzyskanego stopnia dla trwającej edukacji ani sztucznej roli projektu', () => {
    const vault = createEmptyVault('Profil testowy');
    vault.education = [{ id: 'ongoing', institution: 'Szkoła testowa', degree: '', fieldOfStudy: 'Informatyka', startDate: '', endDate: 'Obecnie' }];
    vault.projects = [{ id: 'named', name: 'Projekt testowy', role: '', description: '', techStack: [] }];
    expect(getCvExportCompletenessError(vault)).toBeNull();
  });
  it('dopuszcza brak doświadczenia, kompletny wpis i jawne obecnie bez daty końca', () => {
    expect(getCvExportCompletenessError({ history: [] })).toBeNull();
    expect(getCvExportCompletenessError({ history: [complete] })).toBeNull();
    expect(getCvExportCompletenessError({ history: [{ ...complete, endDate: '', isCurrent: true }] })).toBeNull();
  });
});
