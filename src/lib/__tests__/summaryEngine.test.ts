import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSummarySuggestions,
  extractProfileFromVault,
  recordPositiveFeedback,
  loadLearnedLexicon,
  harvestNewPatterns,
  LEXICON,
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
        endDate: '',
        isCurrent: true,
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

  it('poprawnie ekstrahuje profil, staż i seniority z MasterVault', () => {
    const profile = extractProfileFromVault(sampleVault);

    expect(profile.title).toBe('Senior Frontend Engineer');
    expect(profile.yearsOfExperience).toBeGreaterThanOrEqual(5);
    expect(profile.seniority).toBe('senior');
    expect(profile.industry).toBe('it');
    expect(profile.topSkills).toContain('React');
  });

  it('generuje 5 poprawnych gramatycznie propozycji o różnym stylu', () => {
    const suggestions = generateSummarySuggestions(sampleVault, 5);

    expect(suggestions.length).toBeGreaterThanOrEqual(3);

    for (const sug of suggestions) {
      // Brak niedomkniętych slotów
      expect(sug.text).not.toContain('{');
      expect(sug.text).not.toContain('}');
      expect(sug.text).not.toContain('undefined');
      expect(sug.text).not.toContain('null');

      // Poprawność słów
      expect(sug.wordCount).toBeGreaterThan(10);
      expect(sug.wordCount).toBeLessThan(70);

      // Zawiera nazwę stanowiska lub kluczowe umiejętności
      expect(
        sug.text.toLowerCase().includes('engineer') ||
        sug.text.toLowerCase().includes('frontend') ||
        sug.text.toLowerCase().includes('react')
      ).toBe(true);
    }
  });

  it('generuje deterministyczne wyniki dla tego samego seeda / profilu', () => {
    const run1 = generateSummarySuggestions(sampleVault, 5);
    const run2 = generateSummarySuggestions(sampleVault, 5);

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
          endDate: '',
          isCurrent: true,
          description: '',
          highlights: [],
        },
      ],
      skillsMatrix: {
        hardSkills: ['Zgrzewanie rur', 'Próby ciśnieniowe', 'SEP 1kV', 'Lutowanie twarde'],
        softSkills: [],
        toolsAndTech: [],
        certifications: [],
      },
    };

    const suggestions = generateSummarySuggestions(tradeVault, 5);
    expect(suggestions.length).toBeGreaterThan(0);

    const first = suggestions[0].text;
    expect(first).not.toContain('{');
    expect(first.toLowerCase()).toContain('monter');
  });

  it('zawiera wzmocniony bank leksemów (LEXICON) o objętości powyżej 200 pozycji (wzrost 3x)', () => {
    expect(LEXICON.adjectives.junior.length).toBeGreaterThanOrEqual(12);
    expect(LEXICON.adjectives.mid.length).toBeGreaterThanOrEqual(12);
    expect(LEXICON.adjectives.senior.length).toBeGreaterThanOrEqual(12);
    expect(LEXICON.adjectives.lead.length).toBeGreaterThanOrEqual(12);

    expect(LEXICON.achieveVerbs.it.length).toBeGreaterThanOrEqual(15);
    expect(LEXICON.achieveVerbs.trades.length).toBeGreaterThanOrEqual(15);
    expect(LEXICON.achieveVerbs.medical.length).toBeGreaterThanOrEqual(15);
    expect(LEXICON.achieveVerbs.sales.length).toBeGreaterThanOrEqual(15);
    expect(LEXICON.achieveVerbs.general.length).toBeGreaterThanOrEqual(15);

    expect(LEXICON.connectors.length).toBeGreaterThanOrEqual(15);
    expect(LEXICON.valuePrefixes.length).toBeGreaterThanOrEqual(12);

    const totalEntries =
      Object.values(LEXICON.adjectives).flat().length +
      Object.values(LEXICON.achieveVerbs).flat().length +
      LEXICON.connectors.length +
      Object.values(LEXICON.impactPhrases).flat().length +
      LEXICON.valuePrefixes.length;

    expect(totalEntries).toBeGreaterThanOrEqual(200);
  });

  describe('Samouczący się bank leksemów i adaptacyjne wagi (RLAIF / Knowledge Distillation)', () => {
    it('zapisuje sygnał nagrody feedbacku i podnosi wagi wybranych elementów', () => {
      recordPositiveFeedback('style_results', {
        verb: 'projektowałem i wdrażałem',
        impact: 'skracając czas wdrożeń i podnosząc stabilność',
      }, 1.0);

      const store = loadLearnedLexicon();
      expect(store.feedbackCount).toBe(1);
      expect(store.weights['style_results']).toBe(2.0);
      expect(store.weights['verb:projektowałem i wdrażałem']).toBe(2.0);
      expect(store.weights['impact:skracając czas wdrożeń i podnosząc stabilność']).toBe(2.0);
    });

    it('pozyskuje nowe zweryfikowane czasowniki i odrzuca zakazany żargon', () => {
      const result = harvestNewPatterns('it', [
        'refaktoryzowałem architekturę i', // poprawny
        'dynamiczny pracownik',             // zakazany żargon
      ], [
        'zmniejszając opóźnienia API o 40%', // poprawny
        'praca pod presją czasu',            // zakazany żargon
      ]);

      expect(result.addedVerbs).toBe(1);
      expect(result.addedImpacts).toBe(1);

      const store = loadLearnedLexicon();
      expect(store.customVerbs['it']).toContain('refaktoryzowałem architekturę i');
      expect(store.customVerbs['it']).not.toContain('dynamiczny pracownik');
    });

    it('faworyzuje warianty o wyższych wagach i umieszcza je na szczycie listy', () => {
      // Dajemy dużą nagrodę dla stylu Specjalistyczny
      recordPositiveFeedback('style_tech', {
        verb: 'projektowałem i wdrażałem',
      }, 5.0);

      const suggestions = generateSummarySuggestions(sampleVault, 5);
      expect(suggestions[0].styleId).toBe('style_tech');
      expect(suggestions[0].weight).toBeGreaterThan(5.0);
    });
  });
});
