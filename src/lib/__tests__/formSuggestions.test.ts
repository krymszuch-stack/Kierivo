import { describe, expect, it } from 'vitest';
import { ownEntriesFor, suggestForField, SuggestionContext } from '../formSuggestions';
import { createEmptyVault } from '../sampleVault';
import { MasterVault, JobApplication, WorkExperience } from '../../types';

function job(overrides: Partial<WorkExperience> = {}): WorkExperience {
  return {
    id: 'exp-1',
    company: 'GROMGAZ',
    role: 'Monter instalacji gazowych',
    location: 'Kraków',
    startDate: '2020-01',
    endDate: '2023-01',
    isCurrent: false,
    highlights: [],
    ...overrides,
  };
}

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: 'app-1',
    company: 'Termika Serwis',
    position: 'Serwisant',
    salary: '',
    date: '2026-01-01',
    status: 'Wysłana',
    ...overrides,
  };
}

function context(vault: MasterVault, applications: JobApplication[] = []): SuggestionContext {
  return { vault, applications };
}

const vaultZHistoria = (): MasterVault => ({
  ...createEmptyVault('Jan Kowalski', 'jan@example.com'),
  history: [job()],
});

describe('źródła własnych wpisów', () => {
  it('firmy zbierają się z historii zatrudnienia i z listy aplikacji', () => {
    const wynik = ownEntriesFor('company', vaultZHistoria(), [application()]);
    expect(wynik).toEqual(['GROMGAZ', 'Termika Serwis']);
  });

  it('pomija puste wpisy i nie dubluje tej samej firmy', () => {
    const vault: MasterVault = {
      ...createEmptyVault(),
      history: [job(), job({ id: 'exp-2', company: '  gromgaz  ' }), job({ id: 'exp-3', company: '' })],
    };
    expect(ownEntriesFor('company', vault, [])).toEqual(['GROMGAZ']);
  });
});

describe('podpowiedzi w formularzach', () => {
  it('własny wcześniejszy wpis stoi przed słownikiem', () => {
    const vault: MasterVault = {
      ...createEmptyVault(),
      skillsMatrix: { ...createEmptyVault().skillsMatrix, hardSkills: ['SQL zaawansowany'] },
    };

    const wynik = suggestForField('hardSkill', 'SQL', context(vault));
    expect(wynik[0].value).toBe('SQL zaawansowany');
    expect(wynik[0].source).toBe('own');
  });

  it('dokładny prefiks ze słownika wyprzedza luźne trafienie z historii', () => {
    // Użytkownik wpisujący „Warsz" celuje w „Warszawa", a nie w swój dawny
    // „Zakład Warsztatowy" — mimo że własne wpisy mają wyższe źródło.
    const vault: MasterVault = {
      ...createEmptyVault(),
      history: [job({ location: 'Zakład Warsztatowy' })],
    };

    const wynik = suggestForField('location', 'Warsz', context(vault));
    expect(wynik[0].value).toBe('Warszawa');
  });

  it('nie proponuje wartości, którą użytkownik już wybrał', () => {
    const vault = vaultZHistoria();
    const wynik = suggestForField('company', 'GROM', {
      ...context(vault),
      excluded: ['gromgaz'],
    });
    expect(wynik.some((item) => item.value === 'GROMGAZ')).toBe(false);
  });

  it('nie podpowiada tego, co użytkownik ma już wpisane w całości', () => {
    const wynik = suggestForField('company', 'GROMGAZ', context(vaultZHistoria()));
    expect(wynik.some((item) => item.value === 'GROMGAZ')).toBe(false);
  });

  it('ta sama wartość z dwóch źródeł pojawia się raz, z mocniejszym źródłem', () => {
    const vault: MasterVault = {
      ...createEmptyVault(),
      skillsMatrix: { ...createEmptyVault().skillsMatrix, hardSkills: ['Python'] },
    };

    // Fraza celowo niepełna: wartość wpisana w całości jest odfiltrowywana
    // jako „użytkownik ma to już przed oczami" — sprawdza to osobny test.
    const wynik = suggestForField('hardSkill', 'Pyth', context(vault));
    const trafienia = wynik.filter((item) => item.value.toLowerCase() === 'python');
    expect(trafienia).toHaveLength(1);
    expect(trafienia[0].source).toBe('own');
  });

  it('dopasowuje mimo odmiany — „magazyn” trafia w „Kierownik Magazynu”', () => {
    const wynik = suggestForField('jobTitle', 'magazynu', context(createEmptyVault()));
    expect(wynik.some((item) => /magazyn/i.test(item.value))).toBe(true);
  });

  it('pusta fraza daje przekrój branż, nie sam blok IT', () => {
    const wynik = suggestForField('jobTitle', '', context(createEmptyVault()));
    expect(wynik.length).toBeGreaterThan(3);
    // Tablica źródłowa zaczyna się od stu stanowisk IT; gdyby lista startowa
    // była zwykłym `slice`, wszystkie pozycje pochodziłyby z tego bloku.
    const samoIt = wynik.every((item) => /developer|engineer|devops|data|qa/i.test(item.value));
    expect(samoIt).toBe(false);
  });

  it('pusty korpus nie generuje ani jednej podpowiedzi', () => {
    const wynik = suggestForField('company', 'Xyzzy', { ...context(createEmptyVault()), corpus: [] });
    expect(wynik).toEqual([]);
  });

  it('korpus zbiorczy dokłada firmy, których nie ma w historii', () => {
    const wynik = suggestForField('company', 'Term', {
      ...context(createEmptyVault()),
      corpus: ['Termet Serwis'],
    });
    expect(wynik[0].value).toBe('Termet Serwis');
    expect(wynik[0].source).toBe('corpus');
  });

  it('monter dostaje sprzęt ze swojej branży, nie frameworki', () => {
    const vault: MasterVault = {
      ...createEmptyVault(),
      personalInfo: { ...createEmptyVault().personalInfo, title: 'Monter instalacji gazowych' },
    };

    const wynik = suggestForField('tool', '', context(vault));
    const zBranzy = wynik.filter((item) => item.source === 'catalog').map((item) => item.value);
    expect(zBranzy.join(' ')).toMatch(/spalin|gazow|manometr/i);
  });

  it('nie proponuje danych przykładowych z katalogu branż', () => {
    // `ProfessionSubRole` niesie `sampleCompany` i `sampleMetrics` — wstawienie
    // ich do CV byłoby wpisaniem komuś zmyślonego pracodawcy (reguła 1).
    const vault: MasterVault = {
      ...createEmptyVault(),
      personalInfo: { ...createEmptyVault().personalInfo, title: 'Monter instalacji gazowych' },
    };

    for (const field of ['company', 'jobTitle', 'tool', 'hardSkill'] as const) {
      const wartosci = suggestForField(field, '', context(vault)).map((item) => item.value);
      expect(wartosci).not.toContain('Serwis Gazowy / Junkers-Ariston Tech');
      expect(wartosci.join(' ')).not.toMatch(/Ponad 450 wykonanych przeglądów/);
    }
  });

  it('respektuje limit', () => {
    const wynik = suggestForField('jobTitle', 'a', { ...context(createEmptyVault()), limit: 3 });
    expect(wynik.length).toBeLessThanOrEqual(3);
  });

  it('dwa wywołania na tych samych danych dają tę samą listę', () => {
    const vault = vaultZHistoria();
    const a = suggestForField('jobTitle', 'monter', context(vault)).map((item) => item.value);
    const b = suggestForField('jobTitle', 'monter', context(vault)).map((item) => item.value);
    expect(a).toEqual(b);
  });

  it('podpowiada uczelnie z własnej historii i słownika', () => {
    const vault: MasterVault = {
      ...createEmptyVault(),
      education: [
        {
          id: 'edu-1',
          institution: 'Akademia Górniczo-Hutnicza w Krakowie',
          degree: 'Inżynier',
          fieldOfStudy: 'Automatyka i Robotyka',
          startDate: '2016-10',
          endDate: '2020-02',
        },
      ],
    };

    const wlasna = suggestForField('institution', 'Akademia', context(vault));
    expect(wlasna[0].value).toBe('Akademia Górniczo-Hutnicza w Krakowie');
    expect(wlasna[0].source).toBe('own');

    const slownik = suggestForField('institution', 'Politechnika', context(createEmptyVault()));
    expect(slownik.length).toBeGreaterThan(0);
    expect(slownik[0].source).toBe('dictionary');
  });

  it('podpowiada wystawców certyfikatów z własnych wpisów i słownika', () => {
    const vault: MasterVault = {
      ...createEmptyVault(),
      skillsMatrix: {
        ...createEmptyVault().skillsMatrix,
        certifications: [
          {
            id: 'c-1',
            name: 'SEP G1 do 1 kV',
            issuer: 'Oddział Krakowski SEP',
          },
        ],
      },
    };

    const wlasny = suggestForField('certificateIssuer', 'Oddział', context(vault));
    expect(wlasny[0].value).toBe('Oddział Krakowski SEP');
    expect(wlasny[0].source).toBe('own');

    const slownik = suggestForField('certificateIssuer', 'UDT', context(createEmptyVault()));
    expect(slownik.some((s) => s.value.includes('UDT'))).toBe(true);
  });

  it('podpowiada technologie dla projektów ze Skills Matrix i istniejących projektów', () => {
    const vault: MasterVault = {
      ...createEmptyVault(),
      skillsMatrix: {
        ...createEmptyVault().skillsMatrix,
        hardSkills: ['Next.js', 'PostgreSQL'],
        toolsAndTech: ['Docker', 'Git'],
      },
      projects: [
        {
          id: 'p-1',
          name: 'Portal E-commerce',
          role: 'Lead',
          description: '',
          techStack: ['Tailwind CSS', 'Next.js'],
        },
      ],
    };

    const wynik = suggestForField('projectTech', 'Next', context(vault));
    expect(wynik[0].value).toBe('Next.js');
    expect(wynik[0].source).toBe('own');
  });
});

