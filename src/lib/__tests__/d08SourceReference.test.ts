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
  version: 'test',
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
    email: 'jan@example.com',
    phone: '+48 500 600 700',
    location: 'Kraków, Polska',
    title: 'IT Support Specialist',
    summary: 'Specjalista wsparcia IT z doświadczeniem w Microsoft 365 i obsłudze użytkowników.',
    linkedin: 'linkedin.com/in/jankowalski',
  },
  skillsMatrix: {
    hardSkills: ['Microsoft 365', 'PowerShell', 'Active Directory'],
    softSkills: [],
    toolsAndTech: [],
    certifications: [],
  },
  history: [
    {
      id: 'exp-1',
      company: 'Acme Support',
      role: 'IT Support Specialist',
      location: 'Kraków',
      startDate: '2023-01',
      endDate: '',
      isCurrent: true,
      description: 'Wsparcie użytkowników i administracja środowiskiem Microsoft 365.',
      highlights: [
        {
          id: 'hl-1',
          text: 'Skróciłem średni czas obsługi zgłoszeń o 18 procent.',
          action: '',
          target: '',
          tool: '',
          metric: '18%',
          keywords: [],
        },
      ],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'Uniwersytet Testowy',
      degree: 'Licencjat',
      fieldOfStudy: 'Informatyka',
      startDate: '2019',
      endDate: '2022',
    },
  ],
  projects: [],
};

describe('D08 SOURCE_AWARE — referencja renderera CVelocity', () => {
  it('buduje deterministyczny porządek bloków odpowiadający dokumentowi', () => {
    const reference = buildD08DocumentReference(vault);
    const ids = reference.blocks.map((block) => block.id);

    expect(ids.indexOf('header.fullName')).toBeLessThan(ids.indexOf('section.summary'));
    expect(ids.indexOf('section.summary')).toBeLessThan(ids.indexOf('section.skills'));
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
    expect(result.score!).toBeGreaterThan(95);
  });

  it('zachowuje wysoki text F1, ale wykrywa błędną kolejność bloków', async () => {
    const reference = buildD08DocumentReference(vault);
    const reversedText = [...reference.blocks]
      .reverse()
      .map((block) => block.text)
      .join('\n');
    const raw = createCleanD08Signals();

    const enhanced = await applyD08SourceReference(raw, reference, reversedText);
    const result = scoreStructuralReadability(enhanced);

    expect(enhanced.textLayer.sourceTokenCount).toBe(enhanced.textLayer.matchedTokenCount);
    expect(enhanced.readingOrder.measurementConfidence).toBeCloseTo(1, 12);
    expect(enhanced.readingOrder.discordantPairWeight).toBeGreaterThan(0);
    expect(result.hardCaps.some((cap) => cap.ruleCode === 'HC_D08_READING_ORDER_CRITICAL')).toBe(true);
  });

  it('utrata dużej części eksportowanej treści obniża recall i coverage', async () => {
    const reference = buildD08DocumentReference(vault);
    const truncated = [
      vault.personalInfo.fullName,
      vault.personalInfo.email,
      'Podsumowanie Zawodowe',
    ].join('\n');
    const raw = createCleanD08Signals();

    const enhanced = await applyD08SourceReference(raw, reference, truncated);
    const result = scoreStructuralReadability(enhanced);

    expect(enhanced.textLayer.matchedTokenCount!).toBeLessThan(enhanced.textLayer.sourceTokenCount!);
    expect(enhanced.readingOrder.measurementConfidence!).toBeLessThan(0.85);
    expect(result.hardCaps.some((cap) => cap.ruleCode === 'HC_D08_TEXT_LAYER_CRITICAL')).toBe(true);
  });
});
