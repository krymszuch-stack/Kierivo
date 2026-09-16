import { describe, it, expect } from 'vitest';
import { rankHighlightsByRelevance, rankExperienceByRelevance, getRelevanceOrderedExperienceIds } from '../relevanceRanking';
import { WorkExperience } from '../../types';

const jdKeywords = ['react', 'typescript', 'docker', 'kubernetes'];

function highlight(id: string, text: string): any {
  return { id, text, action: '', target: '', tool: '', metric: '', keywords: [] };
}

describe('relevanceRanking (0-token block/bullet reordering)', () => {
  it('sortuje punkty wg pokrycia słów kluczowych z ogłoszenia, malejąco', () => {
    const highlights = [
      highlight('h1', 'Obsługa klientów i wsparcie telefoniczne'),
      highlight('h2', 'Rozwój aplikacji w React i TypeScript'),
      highlight('h3', 'Wdrożenie React, TypeScript, Dockera i Kubernetes na produkcji'),
    ];

    const ranked = rankHighlightsByRelevance(highlights, jdKeywords);

    expect(ranked[0].highlight.id).toBe('h3');
    expect(ranked[0].score).toBeGreaterThan(ranked[2].score);
    expect(ranked.map((r) => r.highlight.id)).toContain('h1');
    expect(ranked[ranked.length - 1].highlight.id).toBe('h1');
  });

  it('zachowuje oryginalną kolejność przy remisie (stabilne sortowanie)', () => {
    const highlights = [highlight('a', 'Ogólne zadania'), highlight('b', 'Inne ogólne zadania')];
    const ranked = rankHighlightsByRelevance(highlights, jdKeywords);
    expect(ranked.map((r) => r.highlight.id)).toEqual(['a', 'b']);
  });

  it('sortuje doświadczenia wg trafności i faworyzuje zgodność tytułu stanowiska', () => {
    const history: WorkExperience[] = [
      {
        id: 'exp_old',
        company: 'Call Center Sp. z o.o.',
        role: 'Konsultant Telefoniczny',
        location: '',
        startDate: '2018',
        endDate: '2020',
        isCurrent: false,
        highlights: [highlight('h1', 'Obsługa klientów, deeskalacja problemów')],
      },
      {
        id: 'exp_recent',
        company: 'TechCorp',
        role: 'React Developer',
        location: '',
        startDate: '2021',
        endDate: 'Obecnie',
        isCurrent: true,
        highlights: [highlight('h2', 'Budowa interfejsów w React i TypeScript, konteneryzacja Docker')],
      },
    ];

    const ranked = rankExperienceByRelevance(history, jdKeywords, 'React Developer');
    expect(ranked[0].experience.id).toBe('exp_recent');

    const orderedIds = getRelevanceOrderedExperienceIds(history, jdKeywords, 'React Developer');
    expect(orderedIds).toEqual(['exp_recent', 'exp_old']);
  });

  it('nie mutuje oryginalnej tablicy historii wejściowej', () => {
    const history: WorkExperience[] = [
      { id: 'a', company: 'A', role: 'X', location: '', startDate: '', endDate: '', isCurrent: false, highlights: [] },
      { id: 'b', company: 'B', role: 'Y', location: '', startDate: '', endDate: '', isCurrent: false, highlights: [] },
    ];
    const original = [...history];
    rankExperienceByRelevance(history, jdKeywords, 'Y');
    expect(history).toEqual(original);
  });

  describe('testy charakteryzujące (Z-2)', () => {
    it('pusta lista słów kluczowych zwraca wynik 0 (toKeywordSet daje zbiór pusty)', () => {
      const highlights = [highlight('h1', 'React Developer w firmie IT')];
      const rankedHighlights = rankHighlightsByRelevance(highlights, []);
      expect(rankedHighlights[0].score).toBe(0);
      expect(rankedHighlights[0].matchedKeywords).toEqual([]);

      // Dla doświadczenia na indeksie >= 5 (gdzie recencyBonus = 0) i bez zgodności tytułu
      const history: WorkExperience[] = Array.from({ length: 6 }, (_, i) => ({
        id: `exp-${i}`,
        company: 'Firma',
        role: 'Rola',
        location: '',
        startDate: '',
        endDate: '',
        isCurrent: false,
        highlights: [highlight(`h-${i}`, 'React TypeScript')],
      }));
      const rankedExp = rankExperienceByRelevance(history, [], '');
      const exp5 = rankedExp.find((r) => r.experience.id === 'exp-5')!;
      expect(exp5.score).toBe(0);
      expect(exp5.matchedKeywords).toEqual([]);
    });

    it('obsługuje puste history i puste highlights bez błędów', () => {
      expect(rankExperienceByRelevance([], jdKeywords)).toEqual([]);
      expect(rankExperienceByRelevance(null, jdKeywords)).toEqual([]);
      expect(rankExperienceByRelevance(undefined, jdKeywords)).toEqual([]);
      expect(rankHighlightsByRelevance([], jdKeywords)).toEqual([]);
      expect(rankHighlightsByRelevance(null, jdKeywords)).toEqual([]);
      expect(rankHighlightsByRelevance(undefined, jdKeywords)).toEqual([]);

      // Doświadczenie z pustą tablicą highlights
      const historyWithEmptyHighlights: WorkExperience[] = [
        {
          id: 'exp-empty',
          company: 'Firma',
          role: 'Konsultant',
          location: '',
          startDate: '',
          endDate: '',
          isCurrent: false,
          highlights: [],
        },
      ];
      const ranked = rankExperienceByRelevance(historyWithEmptyHighlights, jdKeywords, '');
      expect(ranked).toHaveLength(1);
      expect(ranked[0].matchedKeywords).toEqual([]);
      // bestHighlightScore = 0, avgHighlightScore = 0, roleTitleScore = 0, recencyBonus = 0.10
      expect(ranked[0].score).toBeCloseTo(0.1);
    });

    it('obsługuje punkt podany jako string zamiast obiektu (highlightText obsługuje oba)', () => {
      const stringHighlights = [
        'Zwykły punkt bez słów kluczowych',
        'Projektowanie komponentów w React i TypeScript',
      ];
      const rankedHighlights = rankHighlightsByRelevance(stringHighlights as any, jdKeywords);
      expect(rankedHighlights[0].highlight).toBe('Projektowanie komponentów w React i TypeScript');
      expect(rankedHighlights[0].matchedKeywords).toContain('react');
      expect(rankedHighlights[0].score).toBeGreaterThan(0);

      const historyWithStringHighlights: WorkExperience[] = [
        {
          id: 'exp-str',
          company: 'Firma',
          role: 'Inżynier',
          location: '',
          startDate: '',
          endDate: '',
          isCurrent: false,
          highlights: ['Tworzenie mikroserwisów w Docker'] as any,
        },
      ];
      const rankedExp = rankExperienceByRelevance(historyWithStringHighlights, jdKeywords, '');
      expect(rankedExp[0].matchedKeywords).toContain('docker');
    });

    it('ignoruje duplikaty i normalizuje wielkość liter w słowach kluczowych ogłoszenia', () => {
      const messyKeywords = ['React', 'REACT', 'react', '  React  ', 'TypeScript', 'typescript'];
      const highlights = [highlight('h1', 'Programista React')];
      const ranked = rankHighlightsByRelevance(highlights, messyKeywords);

      // Słowa kluczowe unifikują się do setu: ['react', 'typescript'] (rozmiar = 2)
      // 1 dopasowanie na 2 słowa daje score = 0.5
      expect(ranked[0].matchedKeywords).toEqual(['react']);
      expect(ranked[0].score).toBe(0.5);
    });

    it('matchedKeywords nie zawiera powtórzeń przy doświadczeniu z kilkoma punktami', () => {
      const history: WorkExperience[] = [
        {
          id: 'exp-multi',
          company: 'Firma',
          role: 'Developer',
          location: '',
          startDate: '',
          endDate: '',
          isCurrent: false,
          highlights: [
            highlight('h1', 'Budowa frontend w React i konteneryzacja Docker'),
            highlight('h2', 'Testowanie i wdrażanie aplikacji React na Kubernetes'),
          ],
        },
      ];
      const ranked = rankExperienceByRelevance(history, jdKeywords, '');
      const keywords = ranked[0].matchedKeywords;
      const uniqueKeywords = Array.from(new Set(keywords));
      expect(keywords).toEqual(uniqueKeywords);
      expect(keywords).toContain('react');
      expect(keywords).toContain('docker');
      expect(keywords).toContain('kubernetes');
      expect(keywords.filter((k) => k === 'react')).toHaveLength(1);
    });

    it('premia za świeżość (recencyBonus) zeruje się od szóstego doświadczenia', () => {
      // 7 doświadczeń z pustymi highlights i brakiem dopasowania tytułu
      // score = roleTitleScore * 0.15 (0) + recencyBonus = Math.max(0, 0.1 - index * 0.02)
      const history: WorkExperience[] = Array.from({ length: 7 }, (_, i) => ({
        id: `exp-${i}`,
        company: `Firma ${i}`,
        role: 'Rola',
        location: '',
        startDate: '',
        endDate: '',
        isCurrent: false,
        highlights: [],
      }));

      const ranked = rankExperienceByRelevance(history, jdKeywords, '');

      expect(ranked.find((r) => r.experience.id === 'exp-0')!.score).toBeCloseTo(0.10);
      expect(ranked.find((r) => r.experience.id === 'exp-1')!.score).toBeCloseTo(0.08);
      expect(ranked.find((r) => r.experience.id === 'exp-2')!.score).toBeCloseTo(0.06);
      expect(ranked.find((r) => r.experience.id === 'exp-3')!.score).toBeCloseTo(0.04);
      expect(ranked.find((r) => r.experience.id === 'exp-4')!.score).toBeCloseTo(0.02);
      expect(ranked.find((r) => r.experience.id === 'exp-5')!.score).toBeCloseTo(0.00);
      expect(ranked.find((r) => r.experience.id === 'exp-6')!.score).toBeCloseTo(0.00);
    });

    it('titleSimilarity: sprawdza zgodność dokładną, zawieranie się, część wspólną słów oraz brak', () => {
      // Testujemy na doświadczeniach o indeksie 5 (gdzie recencyBonus = 0) i pustych highlights (punkty = 0)
      // Wtedy score = roleTitleScore * 0.15:
      // - dokładna zgodność: roleTitleScore = 1.0 -> score = 0.15
      // - zawieranie się: roleTitleScore = 0.8 -> score = 0.12
      // - część wspólna słów: 0.5 * (common / totalTargetWords) * 0.15
      // - brak: roleTitleScore = 0 -> score = 0
      const createTestExpAtZeroRecency = (role: string, id: string): WorkExperience[] => {
        const padding = Array.from({ length: 5 }, (_, i) => ({
          id: `pad-${id}-${i}`,
          company: 'Pad',
          role: 'Inna rola',
          location: '',
          startDate: '',
          endDate: '',
          isCurrent: false,
          highlights: [],
        }));
        const target: WorkExperience = {
          id,
          company: 'Test Corp',
          role,
          location: '',
          startDate: '',
          endDate: '',
          isCurrent: false,
          highlights: [],
        };
        return [...padding, target];
      };

      const targetTitle = 'React Developer';

      // 1. Zgodność dokładna
      const exactList = createTestExpAtZeroRecency('React Developer', 'exact');
      const rankedExact = rankExperienceByRelevance(exactList, [], targetTitle);
      expect(rankedExact.find((r) => r.experience.id === 'exact')!.score).toBeCloseTo(1.0 * 0.15);

      // 2. Zawieranie się
      const containsList = createTestExpAtZeroRecency('Senior React Developer', 'contains');
      const rankedContains = rankExperienceByRelevance(containsList, [], targetTitle);
      expect(rankedContains.find((r) => r.experience.id === 'contains')!.score).toBeCloseTo(0.8 * 0.15);

      // 3. Część wspólna słów
      const commonList = createTestExpAtZeroRecency('React Backend Specialist', 'common');
      const rankedCommon = rankExperienceByRelevance(commonList, [], 'React Frontend Architect');
      expect(rankedCommon.find((r) => r.experience.id === 'common')!.score).toBeCloseTo((0.5 * (1 / 3)) * 0.15);

      // 4. Brak zgodności
      const noneList = createTestExpAtZeroRecency('Księgowy', 'none');
      const rankedNone = rankExperienceByRelevance(noneList, [], targetTitle);
      expect(rankedNone.find((r) => r.experience.id === 'none')!.score).toBeCloseTo(0);
    });
  });
});
