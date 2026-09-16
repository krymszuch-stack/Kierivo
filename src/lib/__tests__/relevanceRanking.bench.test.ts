import { describe, it, expect } from 'vitest';
import type { WorkExperience } from '../../types';
import { rankExperienceByRelevance } from '../relevanceRanking';

/**
 * Pomiar kosztu rankingu trafności (relevanceRanking.ts) — Zadanie Z-2.
 *
 * Zgodnie z AGENTS.md (reguła 6) i opisem zadania Z-2:
 * - brak progów czasowych w asercjach (testy z twardym limitem sypią się na współdzielonym CI);
 * - asercje sprawdzają wyłącznie poprawny rozmiar danych wejściowych;
 * - wyniki są wypisywane przez console.log w formacie tabeli Markdown do opisu PR.
 */

const KEYWORDS_100: string[] = [
  'react', 'typescript', 'javascript', 'html5', 'css3', 'node.js', 'express', 'postgresql',
  'mongodb', 'redis', 'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform',
  'ci/cd', 'github actions', 'git', 'linux', 'graphql', 'rest api', 'microservices', 'jest',
  'vitest', 'cypress', 'playwright', 'webpack', 'vite', 'tailwind', 'sass', 'redux',
  'zustand', 'next.js', 'vue.js', 'angular', 'python', 'django', 'fastapi', 'flask',
  'java', 'spring boot', 'c#', '.net', 'sql', 'nosql', 'kafka', 'rabbitmq',
  'elasticsearch', 'prometheus', 'grafana', 'datadog', 'sentry', 'oauth', 'jwt', 'security',
  'agile', 'scrum', 'kanban', 'jira', 'confluence', 'figma', 'ui/ux', 'seo',
  'performance', 'accessibility', 'wcag', 'i18n', 'tdd', 'clean code', 'solid', 'design patterns',
  'devops', 'ansible', 'helm', 'argocd', 'cloud architecture', 'serverless', 'lambda', 's3',
  'dynamodb', 'cloudwatch', 'open-source', 'code review', 'mentoring', 'leadership', 'communication', 'problem solving',
  'english', 'german', 'project management', 'product discovery', 'user stories', 'bdd', 'mobile', 'react native',
  'pwa', 'responsive design', 'cross-browser', 'profiling'
];

const KEYWORDS_20: string[] = KEYWORDS_100.slice(0, 20);

function buildExperienceFixture(count: number): WorkExperience[] {
  return Array.from({ length: count }, (_, expIndex) => ({
    id: `bench-exp-${expIndex}`,
    company: `Firma Inżynieryjna nr ${expIndex}`,
    role:
      expIndex % 3 === 0
        ? 'Senior Fullstack Engineer'
        : expIndex % 3 === 1
        ? 'React Frontend Developer'
        : 'Cloud Platform Architect',
    location: 'Warszawa, Polska',
    startDate: '2020-01',
    endDate: '2023-01',
    isCurrent: false,
    highlights: Array.from({ length: 8 }, (_, h) => ({
      id: `exp-${expIndex}-h-${h}`,
      text: `Rozwój modułu ${h} w React, TypeScript i Node.js, konteneryzacja Docker oraz orkiestracja w Kubernetes na platformie AWS.`,
      action: 'Wdrożenie',
      target: 'Platforma',
      tool: 'Docker',
      metric: `${h * 5 + 10}%`,
      keywords: ['react', 'typescript', 'docker', 'kubernetes', 'aws'],
    })),
  } as unknown as WorkExperience));
}

describe('koszt rankingu trafności (relevanceRanking.bench.test.ts)', () => {
  const history10 = buildExperienceFixture(10);
  const history50 = buildExperienceFixture(50);
  const history200 = buildExperienceFixture(200);

  it('dane wejściowe mają zakładany rozmiar (10, 50, 200 exp po 8 punktów, 20 i 100 słów kluczowych)', () => {
    expect(history10).toHaveLength(10);
    expect(history10.every((e) => (e.highlights || []).length === 8)).toBe(true);

    expect(history50).toHaveLength(50);
    expect(history50.every((e) => (e.highlights || []).length === 8)).toBe(true);

    expect(history200).toHaveLength(200);
    expect(history200.every((e) => (e.highlights || []).length === 8)).toBe(true);

    expect(KEYWORDS_20).toHaveLength(20);
    expect(KEYWORDS_100).toHaveLength(100);
  });

  it(
    'mierzy czas wykonania dla siatki 6 kombinacji i wypisuje tabelę Markdown',
    () => {
      const grid = [
        { expCount: 10, history: history10, kwCount: 20, keywords: KEYWORDS_20, reps: 100 },
        { expCount: 10, history: history10, kwCount: 100, keywords: KEYWORDS_100, reps: 100 },
        { expCount: 50, history: history50, kwCount: 20, keywords: KEYWORDS_20, reps: 40 },
        { expCount: 50, history: history50, kwCount: 100, keywords: KEYWORDS_100, reps: 40 },
        { expCount: 200, history: history200, kwCount: 20, keywords: KEYWORDS_20, reps: 15 },
        { expCount: 200, history: history200, kwCount: 100, keywords: KEYWORDS_100, reps: 15 },
      ];

      // Rozgrzewka (JIT warmup)
      for (let w = 0; w < 10; w++) {
        rankExperienceByRelevance(history10, KEYWORDS_20, 'React Frontend Developer');
      }

    const results: Array<{
      expCount: number;
      bulletsCount: number;
      kwCount: number;
      avgTimeMs: number;
      reps: number;
    }> = [];

    for (const item of grid) {
      const start = performance.now();
      for (let r = 0; r < item.reps; r++) {
        rankExperienceByRelevance(item.history, item.keywords, 'React Frontend Developer');
      }
      const elapsed = performance.now() - start;
      const avgTimeMs = elapsed / item.reps;

      results.push({
        expCount: item.expCount,
        bulletsCount: item.expCount * 8,
        kwCount: item.kwCount,
        avgTimeMs,
        reps: item.reps,
      });
    }

    // Formatowanie tabeli Markdown
    let table = '\n### Wyniki pomiaru rankingu trafności (relevanceRanking.ts)\n\n';
    table += '| Doświadczenia | Punkty (highlights) | Słowa kluczowe | Średni czas (1 wywołanie) | Powtórzenia w próbie |\n';
    table += '|---|---|---|---|---|\n';
    for (const r of results) {
      table += `| ${r.expCount} | ${r.bulletsCount} | ${r.kwCount} | **${r.avgTimeMs.toFixed(3)} ms** | ${r.reps} |\n`;
    }

    console.log(table);

    // Asercje wyłącznie sprawdzają, że wszystkie 6 pomiarów dały wynik dodatni
    expect(results).toHaveLength(6);
    expect(results.every((r) => r.avgTimeMs > 0)).toBe(true);
  }, 30000);
});
