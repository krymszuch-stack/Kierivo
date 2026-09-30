import { describe, it, expect } from 'vitest';
import {
  suggestTagsForSTARStory,
  buildStarStoriesFromVault,
  filterStarStoriesByTags,
  findStoryForActiveTag,
} from '../starStoryEngine';
import { MasterVault, STARStory } from '../../types';
import { createEmptyVault } from '../sampleVault';

describe('STARStory Engine', () => {
  const createMockVault = (): MasterVault => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    vault.history = [
      {
        id: 'exp_1',
        company: 'Cloud Corp',
        role: 'Senior Developer',
        location: 'Warszawa',
        startDate: '2021-01',
        endDate: '2023-01',
        isCurrent: false,
        highlights: [
          {
            id: 'hl_1',
            text: 'Optymalizacja zapytań PostgreSQL oraz wdrożenie kolejki Kafka, co przyniosło wzrost wydajności o 40%.',
            action: 'Wdrożenie',
            target: 'Kafka',
            tool: 'PostgreSQL',
            metric: '+40% TPS',
            keywords: ['PostgreSQL', 'Kafka'],
          },
        ],
      },
      {
        id: 'exp_2',
        company: 'Tech Plant',
        role: 'Inżynier Utrzymania Ruchu',
        location: 'Katowice',
        startDate: '2023-02',
        endDate: '2024-08',
        isCurrent: false,
        highlights: [
          {
            id: 'hl_2',
            text: 'Prace konserwacyjne maszyn zgodnie z normami BHP i uprawnieniami SEP G1/G2/G3.',
            action: 'Konserwacja',
            target: 'Urządzenia elektryczne',
            tool: 'SEP',
            metric: '0 wypadków',
            keywords: ['SEP', 'BHP'],
          },
        ],
      },
    ];
    vault.projects = [
      {
        id: 'proj_react',
        name: 'Portal Klienta',
        role: 'Lead Architect',
        description: 'Architektura mikrofrontendowa w React i TypeScript z czasem ładowania poniżej 1s.',
        techStack: ['React', 'TypeScript', 'Docker'],
        metrics: '<1s LCP',
      },
    ];
    return vault;
  };

  describe('Model danych STARStory & Ekstrakcja z MasterVault', () => {
    it('buduje szkice STAR ze źródłem i nie dopisuje brakujących elementów', () => {
      const vault = createMockVault();
      const stories = buildStarStoriesFromVault(vault);

      expect(stories.length).toBeGreaterThanOrEqual(3);

      const story = stories[0];
      expect(story.id).toBeTruthy();
      expect(story.title).toBeTruthy();
      expect(story.situation).toBe('');
      expect(story.task).toBe('');
      expect(story.action).toBe('');
      expect(story.result).toBe('');
      expect(story.sourceEvidence).toContain('Optymalizacja zapytań PostgreSQL');
      expect(story.sourceEvidence).not.toMatch(/projekt zakończył się sukcesem|zidentyfikowano potrzebę|bezpieczne wdrożenie/i);
      expect(Array.isArray(story.metrics)).toBe(true);
      expect(Array.isArray(story.tags)).toBe(true);
      expect(story.projectId).toBeTruthy();
      expect(story.durationSec).toBe(90);
    });

    it('nie zamienia samego opisu projektu ani użytej technologii w twierdzenie o wdrożeniu', () => {
      const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
      vault.projects = [{
        id: 'project-description-only',
        name: 'Prototyp panelu',
        role: 'Autor projektu',
        description: 'Przygotowanie makiety i analiza potrzeb użytkowników.',
        techStack: ['React'],
      }];

      const [story] = buildStarStoriesFromVault(vault);
      expect(story.sourceEvidence).toContain('Przygotowanie makiety');
      expect(story.action).toBe('');
      expect(story.result).toBe('');
      expect(story.sourceEvidence).not.toMatch(/wdrożono|spełnił wszystkie założenia|sukcesem/i);
    });
  });

  describe('Lekki silnik NLP (Auto-tag suggestion)', () => {
    it('sugeruje tagi technologiczne (Kafka, PostgreSQL, Optymalizacja) na podstawie treści', () => {
      const story: Partial<STARStory> = {
        title: 'Skalowanie backendu',
        situation: 'System nie radził sobie z ruchem',
        task: 'Optymalizacja bazy danych i wdrożenie kolejki zdarzeń',
        action: 'Zbudowałem mikroserwisy z wykorzystaniem Kafka i PostgreSQL',
        result: 'Wydajność wzrosła o 40%',
        metrics: ['+40% TPS'],
        tags: [],
      };

      const suggestions = suggestTagsForSTARStory(story);

      expect(suggestions).toContain('Kafka');
      expect(suggestions).toContain('PostgreSQL');
      expect(suggestions).toContain('Optymalizacja');
      expect(suggestions).toContain('Mikroserwisy');
      expect(suggestions).toContain('Metryki i Liczby');
    });

    it('sugeruje uprawnienia i tagi rzemieślnicze (SEP, BHP, Utrzymanie Ruchu)', () => {
      const story: Partial<STARStory> = {
        title: 'Modernizacja rozdzielnicy elektrycznej',
        situation: 'Wymiana aparatury pod napięciem',
        task: 'Zabezpieczenie strefy i przegląd urządzeń',
        action: 'Wykorzystałem uprawnienia elektryczne SEP G1 oraz procedury BHP',
        result: 'Bezawaryjna praca linii produkcyjnej',
        metrics: [],
        tags: [],
      };

      const suggestions = suggestTagsForSTARStory(story);

      expect(suggestions).toContain('SEP');
      expect(suggestions).toContain('BHP');
    });

    it('nie powiela tagów już przypisanych do historii', () => {
      const story: Partial<STARStory> = {
        title: 'Aplikacja React',
        action: 'Wdrożenie w React i TypeScript',
        tags: ['React'],
      };

      const suggestions = suggestTagsForSTARStory(story);
      expect(suggestions).not.toContain('React');
      expect(suggestions).toContain('TypeScript');
    });
  });

  describe('Filtrowanie i Integracja z HUD (Slot 3)', () => {
    it('filtruje historie STAR po wybranym tagu z chmury tagów', () => {
      const vault = createMockVault();
      const stories = buildStarStoriesFromVault(vault);

      const filtered = filterStarStoriesByTags(stories, ['React']);
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((s) => s.tags.some((t) => t.toLowerCase() === 'react'))).toBe(true);
    });

    it('findStoryForActiveTag auto-ładuje odpowiednią historię STAR do Slotu 3 HUD', () => {
      const vault = createMockVault();
      const stories = buildStarStoriesFromVault(vault);

      const slot3Story = findStoryForActiveTag(stories, 'Kafka');
      expect(slot3Story).toBeDefined();
      expect(slot3Story?.tags.some((t) => t.toLowerCase().includes('kafka'))).toBe(true);
      expect(slot3Story?.projectId).toBe('exp_1');
    });
  });
});
