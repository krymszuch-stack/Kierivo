import { describe, it, expect } from 'vitest';
import { mergeImportedVault, mergeUnique, applyParsedCVToVault } from '../vaultImportMerge';
import { createEmptyVault } from '../sampleVault';
import { MasterVault, WorkExperience, Education, Project } from '../../types';

function experience(id: string, company: string, role: string): WorkExperience {
  return {
    id,
    company,
    role,
    location: 'Kraków',
    startDate: '2020-01',
    endDate: '2022-01',
    isCurrent: false,
    description: '',
    highlights: [],
  };
}

function education(id: string, institution: string, degree: string): Education {
  return { id, institution, degree, fieldOfStudy: 'Informatyka', startDate: '2015-10', endDate: '2019-06' };
}

function project(id: string, name: string): Project {
  return { id, name, role: 'Autor', description: '', techStack: [] };
}

function vaultWithHistory(...entries: WorkExperience[]): MasterVault {
  const vault = createEmptyVault('Anna Kowalska', 'anna@example.pl');
  return { ...vault, history: entries };
}

describe('mergeUnique', () => {
  it('zachowuje pozycje bazowe i ich kolejność', () => {
    const base = ['a', 'b'];
    const merged = mergeUnique(base, ['c'], (item) => item);
    expect(merged).toEqual(['a', 'b', 'c']);
  });

  it('pomija duplikaty z importu', () => {
    const merged = mergeUnique(['a', 'b'], ['b', 'c'], (item) => item);
    expect(merged).toEqual(['a', 'b', 'c']);
  });

  it('pomija pozycje z importu bez treści w polach kluczowych', () => {
    const merged = mergeUnique(['a'], ['', 'b'], (item) => item);
    expect(merged).toEqual(['a', 'b']);
  });

  it('nigdy nie usuwa pozycji bazowej, nawet bez klucza', () => {
    const merged = mergeUnique(['', 'a'], ['a'], (item) => item);
    expect(merged).toEqual(['', 'a']);
  });
});

describe('mergeImportedVault', () => {
  /**
   * Regresja na błąd, przez który import CV kasował doświadczenie wpisane
   * ręcznie. To jedyny test, który naprawdę musi tu być — reszta pilnuje
   * szczegółów, ten pilnuje danych użytkownika.
   */
  it('zachowuje dotychczasową historię przy imporcie nowej', () => {
    const prev = vaultWithHistory(experience('1', 'Alfa', 'Programista'));
    const parsed = { history: [experience('2', 'Beta', 'Analityk')] };

    const merged = mergeImportedVault(prev, parsed);

    expect(merged.history.map((h) => h.company)).toEqual(['Alfa', 'Beta']);
  });

  it('nie dubluje wpisu obecnego po obu stronach', () => {
    const prev = vaultWithHistory(experience('1', 'Alfa', 'Programista'));
    const parsed = { history: [experience('2', 'alfa', '  Programista ')] };

    const merged = mergeImportedVault(prev, parsed);

    expect(merged.history).toHaveLength(1);
    expect(merged.history[0].id).toBe('1');
  });

  it('zachowuje dwa okresy pracy u tej samej firmy na tym samym stanowisku', () => {
    const first = experience('1', 'Alfa', 'Programista');
    const second = {
      ...experience('2', 'Alfa', 'Programista'),
      startDate: '2023-01',
      endDate: '2024-06',
    };
    const prev = vaultWithHistory(first);

    const merged = mergeImportedVault(prev, { history: [second] });

    expect(merged.history.map((item) => [item.startDate, item.endDate])).toEqual([
      ['2020-01', '2022-01'],
      ['2023-01', '2024-06'],
    ]);
  });

  it('nie gubi historii, gdy import jej nie zawiera', () => {
    const prev = vaultWithHistory(experience('1', 'Alfa', 'Programista'));

    const merged = mergeImportedVault(prev, {
      personalInfo: { ...prev.personalInfo, fullName: 'Jan Nowak' },
    });

    expect(merged.history).toHaveLength(1);
  });

  it('scala umiejętności bez duplikatów', () => {
    const prev = createEmptyVault();
    prev.skillsMatrix.hardSkills = ['TypeScript'];

    const merged = mergeImportedVault(prev, {
      skillsMatrix: { ...prev.skillsMatrix, hardSkills: ['TypeScript', 'Python'] },
    });

    expect(merged.skillsMatrix.hardSkills).toEqual(['TypeScript', 'Python']);
  });

  it('dokłada wykształcenie i projekty zamiast je nadpisywać', () => {
    const prev = createEmptyVault();
    prev.education = [education('1', 'AGH', 'Informatyka')];
    prev.projects = [project('1', 'Portfolio')];

    const merged = mergeImportedVault(prev, {
      education: [education('2', 'PW', 'Elektronika')],
      projects: [project('2', 'Sklep')],
    });

    expect(merged.education.map((e) => e.institution)).toEqual(['AGH', 'PW']);
    expect(merged.projects.map((p) => p.name)).toEqual(['Portfolio', 'Sklep']);
  });

  it('nie scala dwóch kierunków o tej samej nazwie stopnia w tej samej szkole', () => {
    const prev = createEmptyVault();
    prev.education = [education('1', 'Uniwersytet Alfa', 'Magister')];
    const secondProgram = {
      ...education('2', 'Uniwersytet Alfa', 'Magister'),
      fieldOfStudy: 'Matematyka',
      startDate: '2020-10',
      endDate: '2022-06',
    };

    const merged = mergeImportedVault(prev, { education: [secondProgram] });

    expect(merged.education.map((item) => item.fieldOfStudy)).toEqual([
      'Informatyka',
      'Matematyka',
    ]);
  });

  it('nadpisuje dane osobowe wartościami z CV', () => {
    const prev = createEmptyVault('Anna Kowalska', 'anna@example.pl');

    const merged = mergeImportedVault(prev, {
      personalInfo: { ...prev.personalInfo, fullName: 'Anna Nowak' },
    });

    expect(merged.personalInfo.fullName).toBe('Anna Nowak');
    expect(merged.personalInfo.email).toBe('anna@example.pl');
  });
});

describe('applyParsedCVToVault', () => {
  const parsedMock = {
    personalInfo: { fullName: 'Jan Kowalski', title: 'Monter', email: 'jan@monter.pl' },
    hardSkills: ['SEP G1', 'Spawanie TIG'],
    softSkills: ['Dokładność'],
    toolsAndTech: ['Miernik Sonel'],
    certifications: [{ id: 'c1', name: 'Uprawnienia SEP G1', issuer: 'SEP', date: '2023' }],
    languages: [{ id: 'l1', language: 'Angielski', level: 'B2' }],
    projects: [{ id: 'p1', name: 'Instalacja fotowoltaiczna 50kW', role: 'Główny monter', description: '', techStack: [] }],
    history: [
      experience('exp-1', 'Elektro-Mont', 'Elektromonter'),
      experience('exp-2', 'Solar-Tech', 'Monter PV'),
    ],
    education: [
      education('edu-1', 'Technikum Elektryczne', 'Technik elektryk'),
    ],
    detectedFormat: 'PDF',
    rawText: '...',
    hasCyrillicScript: false,
    warnings: [],
  };

  it('poprawnie przenosi historię i wykształcenie do wynikowego obiektu vault (strategia merge)', () => {
    const prev = vaultWithHistory(experience('exp-0', 'Stara Firma', 'Pomocnik'));
    const { vault, added } = applyParsedCVToVault(prev, parsedMock as any, {
      personal: 'replace',
      skills: 'merge',
      experience: 'merge',
      education: 'merge',
    });

    expect(vault.history).toHaveLength(3);
    expect(vault.history.map((h) => h.company)).toEqual(['Stara Firma', 'Elektro-Mont', 'Solar-Tech']);
    expect(vault.education).toHaveLength(1);
    expect(vault.education[0].institution).toBe('Technikum Elektryczne');
    expect(added.history).toBe(2);
    expect(added.education).toBe(1);
  });

  it('zastępuje historię gdy wybrana jest strategia replace', () => {
    const prev = vaultWithHistory(experience('exp-0', 'Stara Firma', 'Pomocnik'));
    const { vault } = applyParsedCVToVault(prev, parsedMock as any, {
      personal: 'keep',
      skills: 'merge',
      experience: 'replace',
      education: 'replace',
    });

    expect(vault.history).toHaveLength(2);
    expect(vault.history.map((h) => h.company)).toEqual(['Elektro-Mont', 'Solar-Tech']);
  });

  it('zachowuje obecną historię gdy wybrana jest strategia keep', () => {
    const prev = vaultWithHistory(experience('exp-0', 'Stara Firma', 'Pomocnik'));
    const { vault, added } = applyParsedCVToVault(prev, parsedMock as any, {
      personal: 'keep',
      skills: 'keep',
      experience: 'keep',
      education: 'keep',
    });

    expect(vault.history).toHaveLength(1);
    expect(vault.history[0].company).toBe('Stara Firma');
    expect(added.history).toBe(0);
  });

  it('strategia merge w imporcie zachowuje różne okresy pracy i programy nauki', () => {
    const prev = vaultWithHistory(experience('old-job', 'Alfa', 'Programista'));
    prev.education = [education('old-education', 'Uniwersytet Alfa', 'Magister')];
    const parsed = {
      ...parsedMock,
      history: [{ ...experience('new-job', 'Alfa', 'Programista'), startDate: '2023-01' }],
      education: [{
        ...education('new-education', 'Uniwersytet Alfa', 'Magister'),
        fieldOfStudy: 'Matematyka',
        startDate: '2020-10',
      }],
    };

    const { vault, added } = applyParsedCVToVault(prev, parsed as any, {
      personal: 'keep',
      skills: 'keep',
      experience: 'merge',
      education: 'merge',
    });

    expect(vault.history).toHaveLength(2);
    expect(vault.education).toHaveLength(2);
    expect(added.history).toBe(1);
    expect(added.education).toBe(1);
  });
});

