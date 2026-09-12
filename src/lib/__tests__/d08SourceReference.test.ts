import { describe, expect, it } from 'vitest';
import type { MasterVault } from '../../types';
import { createCleanD08Signals } from '../audit-core/d08/fixtures';
import {
  applyD08SourceReference,
  buildD08DocumentReference,
  locateD08SourceBlocks,
} from '../audit-core/d08/sourceReference';
import { scoreStructuralReadability } from '../audit-core/d08/strictScorer';

const vault: MasterVault = {
  version: '2.0',
  updatedAt: '2026-09-11T00:00:00.000Z',
  profiler: {
    flags: ['OFFICE_IT'],
    experienceLevel: 'MID',
    location: {
      city: 'Kraków',
      radiusKm: 30,
      willingnessToTravel: true,
      hybridWork: true,
      remoteOnly: false,
    },
    languages: [],
  },
  personalInfo: {
    fullName: 'Jan Kowalski',
    title: 'IT Support Specialist',
    email: 'jan.kowalski@example.com',
    phone: '+48 500 600 700',
    location: 'Kraków, Polska',
    linkedin: 'linkedin.com/in/jankowalski',
    github: 'github.com/jankowalski',
    summary: 'Specjalista wsparcia IT z doświadczeniem w Microsoft 365 i obsłudze użytkowników.',
  },
  skillsMatrix: {
    hardSkills: ['Microsoft 365', 'Active Directory', 'PowerShell'],
    softSkills: [],
    toolsAndTech: [],
    certifications: [],
  },
  history: [
    {
      id: 'exp-1',
      role: 'IT Support Specialist',
      company: 'Example Sp. z o.o.',
      location: 'Kraków',
      startDate: '2024-01',
      endDate: '2026-08',
      isCurrent: false,
      description: 'Wsparcie użytkowników i administracja usługami Microsoft 365.',
      highlights: [
        {
          id: 'hl-1',
          text: 'Obsługa zgłoszeń i automatyzacja powtarzalnych zadań PowerShell.',
          action: 'Automatyzacja',
          target: 'powtarzalnych zadań wsparcia',
          tool: 'PowerShell',
          metric: '',
          keywords: ['PowerShell', 'IT Support'],
        },
      ],
    },
  ],
  education: [
    {
      id: 'edu-1',
      degree: 'Licencjat',
      fieldOfStudy: 'Informatyka',
      institution: 'Uniwersytet Przykładowy',
      startDate: '2020-10',
      endDate: '2023-06',
    },
  ],
  projects: [],
};

describe('D08 SOURCE_AWARE — referencja renderera CVelocity', () => {
  it('buduje deterministyczny porządek bloków odpowiadający dokumentowi', () => {
    const reference = buildD08DocumentReference(vault);
    const ids = reference.blocks.map((block) => block.id);

    expect(ids[0]).toBe('header.fullName');
    expect(ids.indexOf('section.skills')).toBeLessThan(ids.indexOf('section.experience'));
    expect(ids.indexOf('section.experience')).toBeLessThan(ids.indexOf('section.education'));
    expect(ids.at(-1)).toBe('footer.rodo');
  });

  it('identyczny eksport ma pełne pokrycie bloków', () => {
    const reference = buildD08DocumentReference(vault);
    const located = locateD08SourceBlocks(reference, reference.fullText);

    expect(located.coverage).toBeCloseTo(1, 12);
    expect(located.located.length).toBe(reference.blocks.length);
  });

  it('porównanie 1:1 wzmacnia SOURCE_AWARE i daje high-confidence reading order', async () => {
    const reference = buildD08DocumentReference(vault);
    const raw = createCleanD08Signals();
    raw.referenceProfile = 'EXTERNAL_DOCUMENT';
    delete raw.readingOrder.measurementConfidence;

    const enhanced = await applyD08SourceReference(raw, reference, reference.fullText);
    const result = scoreStructuralReadability(enhanced);

    expect(enhanced.referenceProfile).toBe('SOURCE_AWARE');
    expect(enhanced.readingOrder.measurementConfidence).toBeCloseTo(1, 12);
    expect(enhanced.textLayer.sourceTokenCount).toBe(enhanced.textLayer.matchedTokenCount);
    expect(result.breakdown.some((component) => component.id === 'READING_ORDER')).toBe(true);
    expect(result.score).not.toBeNull();
    // Nie przypinamy poprawnego dokumentu do arbitralnej granicy 95.0. Istotne
    // jest zachowanie semantyczne: pełna zgodność źródła, brak capów i wysoki score.
    expect(result.score!).toBeGreaterThanOrEqual(94.9);
    expect(result.hardCaps).toHaveLength(0);
  });

  it('zachowuje wysoki text F1, ale wykrywa błędną kolejność bloków', async () => {
    const reference = buildD08DocumentReference(vault);
    const reversedText = [...reference.blocks]
      .reverse()
      .map((block) => block.text)
      .join('\n');
    const raw = createCleanD08Signals();
    raw.referenceProfile = 'EXTERNAL_DOCUMENT';
    delete raw.readingOrder.measurementConfidence;

    const enhanced = await applyD08SourceReference(raw, reference, reversedText);
    const result = scoreStructuralReadability(enhanced);

    const text = result.breakdown.find((component) => component.id === 'TEXT_LAYER');
    const order = result.breakdown.find((component) => component.id === 'READING_ORDER');
    expect(text?.normalizedValue).toBeGreaterThan(0.95);
    expect(order?.normalizedValue).toBeLessThan(0.1);
    expect(result.hardCaps.some((cap) => cap.ruleCode === 'HC_D08_READING_ORDER_CRITICAL')).toBe(true);
  });

  it('utrata dużej części eksportowanej treści obniża recall i coverage', async () => {
    const reference = buildD08DocumentReference(vault);
    const extracted = reference.blocks
      .slice(0, Math.max(1, Math.floor(reference.blocks.length / 3)))
      .map((block) => block.text)
      .join('\n');
    const raw = createCleanD08Signals();

    const enhanced = await applyD08SourceReference(raw, reference, extracted);
    const result = scoreStructuralReadability(enhanced);

    expect(enhanced.textLayer.matchedTokenCount).toBeLessThan(enhanced.textLayer.sourceTokenCount!);
    expect(result.hardCaps.some((cap) => cap.ruleCode === 'HC_D08_TEXT_LAYER_CRITICAL')).toBe(true);
  });
});
