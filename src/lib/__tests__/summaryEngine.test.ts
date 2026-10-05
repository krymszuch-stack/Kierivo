import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSummarySuggestions,
  extractProfileFromVault,
  calculateYearsOfExperience,
} from '../summaryEngine';
import { MasterVault } from '../../types';
import { wipeAppStorage } from '../storage';

describe('Beztokenowy silnik generowania podsumowań (SummaryEngine)', () => {
  beforeEach(() => {
    wipeAppStorage();
  });

  const sampleVault: MasterVault = {
    version: '1.0.0',
    updatedAt: '2026-08-27T00:00:00Z',
    personalInfo: {
      fullName: 'Jan Kowalski',
      title: 'Senior Frontend Engineer',
      email: 'jan@kowalski.dev',
      phone: '+48 123 456 789',
      location: 'Warszawa',
      summary: '',
    },
    history: [
      {
        id: 'hist-1',
        role: 'Senior Frontend Engineer',
        company: 'TechCorp',
        location: 'Warszawa',
        startDate: '01/2020',
        endDate: '12/2023',
        isCurrent: false,
        description: 'Budowa architektury React i Next.js',
        highlights: [],
      },
      {
        id: 'hist-2',
        role: 'Frontend Developer',
        company: 'WebHouse',
        location: 'Warszawa',
        startDate: '01/2018',
        endDate: '12/2019',
        isCurrent: false,
        description: 'Tworzenie modułów UI',
        highlights: [],
      },
    ],
    skillsMatrix: {
      hardSkills: ['React', 'TypeScript', 'TailwindCSS', 'GraphQL', 'Next.js'],
      softSkills: ['Code Review', 'Mentoring'],
      toolsAndTech: ['Git', 'Docker'],
      certifications: [],
    },
    education: [
      {
        id: 'edu-1',
        institution: 'Politechnika Warszawska',
        degree: 'Magister inżynier',
        fieldOfStudy: 'Informatyka',
        startDate: '2013',
        endDate: '2018',
      },
    ],
    projects: [],
    profiler: {
      flags: ['OFFICE_IT'],
      experienceLevel: 'SENIOR',
      location: {
        city: 'Warszawa',
        radiusKm: 30,
        willingnessToTravel: false,
        hybridWork: true,
        remoteOnly: false,
      },
      languages: [],
    },
  };

  it('poprawnie ekstrahuje profil, staż i umiejętności z MasterVault bez zmyślonych ról', () => {
    const profile = extractProfileFromVault(sampleVault);

    expect(profile.title).toBe('Senior Frontend Engineer');
    expect(profile.yearsOfExperience).toBe(6);
    expect(profile.topSkills).toContain('React');
    expect(profile.workEntries.length).toBe(2);
    expect(profile.workEntries[0]).toEqual({
      role: 'Senior Frontend Engineer',
      company: 'TechCorp',
    });
  });

  it('bierze domyślny tytuł i główny punkt z najnowszej pracy, nie z pierwszego wiersza', () => {
    const vault = {
      ...sampleVault,
      personalInfo: { ...sampleVault.personalInfo, title: '' },
      history: [
        { ...sampleVault.history[1], highlights: [{ id: 'old-h', text: 'Starsze osiągnięcie', action: '', target: '', tool: '', metric: '8 starszych sztuk', keywords: [] }] },
        { ...sampleVault.history[0], highlights: [{ id: 'new-h', text: 'Nowsze osiągnięcie', action: '', target: '', tool: '', metric: '120 nowych zgłoszeń', keywords: [] }] },
      ],
    };

    const profile = extractProfileFromVault(vault);

    expect(profile.title).toBe('Senior Frontend Engineer');
    expect(profile.sourceHighlight).toBe('Nowsze osiągnięcie');
    expect(generateSummarySuggestions(vault, 4).some((item) => item.text.includes('Nowsze osiągnięcie'))).toBe(true);
  });

  it('nie podwaja stażu przy równoległych okresach zatrudnienia (unia przedziałów)', () => {
    const parallelHistory: MasterVault['history'] = [
      {
        id: 'p1',
        role: 'Konsultant IT',
        company: 'Firma A',
        location: 'Warszawa',
        startDate: '01/2020',
        endDate: '12/2021',
        isCurrent: false,
        description: '',
        highlights: [],
      },
      {
        id: 'p2',
        role: 'Programista',
        company: 'Firma B',
        location: 'Warszawa',
        startDate: '06/2020',
        endDate: '12/2021',
        isCurrent: false,
        description: '',
        highlights: [],
      },
    ];

    const years = calculateYearsOfExperience(parallelHistory);
    // 01/2020 do 12/2021 to 24 miesiące = 2 lata (a nie 4 lata przy sumowaniu bez unii)
    expect(years).toBe(2);
  });

  it('nie traktuje niedatowanego zakończenia jako pracy obecnej, gdy isCurrent=false', () => {
    const missingEndHistory: MasterVault['history'] = [
      {
        id: 'm1',
        role: 'Stażysta',
        company: 'Firma Dawna',
        location: 'Warszawa',
        startDate: '01/2018',
        endDate: '',
        isCurrent: false,
        description: '',
        highlights: [],
      },
    ];

    const years = calculateYearsOfExperience(missingEndHistory);
    // Niedatowane zakończenie przeszłego stanowiska nie może rozciągać się do roku bieżącego
    expect(years).toBe(0);
  });

  it('generuje deterministyczne, faktograficzne propozycje bez zmyślonych metryk (% lub liczb)', () => {
    const suggestions = generateSummarySuggestions(sampleVault, 4);

    expect(suggestions.length).toBeGreaterThanOrEqual(2);

    for (const sug of suggestions) {
      // Brak niedomkniętych slotów
      expect(sug.text).not.toContain('{');
      expect(sug.text).not.toContain('}');
      expect(sug.text).not.toContain('undefined');
      expect(sug.text).not.toContain('null');

      // Brak zmyślonych procentów typu "redukując koszty o 25%"
      expect(sug.text).not.toMatch(/\d+%/);

      // Zawiera nazwę stanowiska lub kluczowe umiejętności z profilu
      expect(
        sug.text.toLowerCase().includes('engineer') ||
        sug.text.toLowerCase().includes('frontend') ||
        sug.text.toLowerCase().includes('react')
      ).toBe(true);
    }
  });

  it('nie zamienia listy umiejętności w twierdzenie o praktycznym użyciu lub doświadczeniu', () => {
    const skillsOnly = {
      ...sampleVault,
      personalInfo: { ...sampleVault.personalInfo, title: '' },
      history: [],
      skillsMatrix: { ...sampleVault.skillsMatrix, hardSkills: ['Kubernetes', 'Terraform'] },
    };

    const suggestions = generateSummarySuggestions(skillsOnly, 4);
    const allText = suggestions.map((suggestion) => suggestion.text).join('\n');

    expect(suggestions.length).toBeGreaterThan(0);
    expect(allText).toContain('W profilu wymieniono');
    expect(allText).not.toMatch(/doświadczenie w bezpośrednim stosowaniu|w codziennej pracy wykorzystuję|doświadczenie zawodowe oparte na znajomości|praktyczna znajomość/i);
  });

  it('opisuje staż jako łączny wynik dat CV, bez przypisywania go roli lub wymienionym narzędziom', () => {
    const suggestions = generateSummarySuggestions(sampleVault, 4);
    const allText = suggestions.map((suggestion) => suggestion.text).join('\n');

    expect(allText).toContain('6 pełnych lat łącznego stażu zawodowego');
    expect(allText).not.toContain('Senior Frontend Engineer z 6');
    expect(allText).not.toContain('Doświadczenie w bezpośrednim stosowaniu');
    expect(allText).not.toContain('W codziennej pracy wykorzystuję');
  });

  it('generuje identyczne wyniki dla tego samego profilu (determinizm)', () => {
    const run1 = generateSummarySuggestions(sampleVault, 4);
    const run2 = generateSummarySuggestions(sampleVault, 4);

    expect(run1.map((s) => s.text)).toEqual(run2.map((s) => s.text));
  });

  it('obsługuje branże techniczne i fizyczne (monter / hydraulik)', () => {
    const tradeVault: MasterVault = {
      ...sampleVault,
      personalInfo: {
        ...sampleVault.personalInfo,
        title: 'Monter Instalacji Sanitarnych',
      },
      history: [
        {
          id: 'hist-t1',
          role: 'Monter HVAC',
          company: 'InstalSerwis',
          location: 'Kraków',
          startDate: '01/2021',
          endDate: '12/2023',
          isCurrent: false,
          description: '',
          highlights: [],
        },
      ],
      skillsMatrix: {
        hardSkills: ['Zgrzewanie rur', 'Próby ciśnieniowe', 'Lutowanie twarde'],
        softSkills: [],
        toolsAndTech: [],
        certifications: [],
      },
    };

    const suggestions = generateSummarySuggestions(tradeVault, 4);
    expect(suggestions.length).toBeGreaterThan(0);

    const first = suggestions[0].text;
    expect(first).not.toContain('{');
    expect(first.toLowerCase()).toContain('monter');
    expect(first).toContain('Zgrzewanie rur');
  });

  it('zwraca pustą listę propozycji dla zupełnie pustego Vaultu (zero halucynacji)', () => {
    const emptyVault: MasterVault = {
      version: '1.0.0',
      updatedAt: '2026-09-30T00:00:00Z',
      personalInfo: {
        fullName: '',
        title: '',
        email: '',
        phone: '',
        location: '',
        summary: '',
      },
      history: [],
      skillsMatrix: {
        hardSkills: [],
        softSkills: [],
        toolsAndTech: [],
        certifications: [],
      },
      education: [],
      projects: [],
      profiler: {
        flags: [],
        experienceLevel: 'MID',
        location: {
          city: '',
          radiusKm: 0,
          willingnessToTravel: false,
          hybridWork: false,
          remoteOnly: false,
        },
        languages: [],
      },
    };

    const suggestions = generateSummarySuggestions(emptyVault, 4);
    expect(suggestions).toEqual([]);
  });

  it('ekstrakcja nie przypisuje zmyślonego tytułu Specjalista przy braku tytułu i roli', () => {
    const noTitleVault: MasterVault = {
      ...sampleVault,
      personalInfo: {
        ...sampleVault.personalInfo,
        title: '',
      },
      history: [],
    };

    const profile = extractProfileFromVault(noTitleVault);
    expect(profile.title).toBe('');
  });
});
