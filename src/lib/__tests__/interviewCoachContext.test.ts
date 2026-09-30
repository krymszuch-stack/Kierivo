import { describe, expect, it } from 'vitest';
import { buildInterviewCoachProfileContext } from '../interviewCoachContext';
import { createEmptyVault } from '../sampleVault';

describe('kontekst Trenera STAR', () => {
  it('wysyła wyłącznie ograniczone, pseudonimizowane dane potrzebne do pytań', () => {
    const vault = createEmptyVault('Jan Kowalski', 'jan.kowalski@example.com');
    vault.personalInfo.location = 'Kraków';
    vault.personalInfo.title = 'Specjalista wsparcia IT';
    vault.skillsMatrix.hardSkills = ['Windows 11', 'Microsoft 365'];
    vault.history = [{
      id: 'experience-1',
      company: 'Tajny Klient Sp. z o.o.',
      role: 'Technik IT',
      location: 'Kraków',
      startDate: '2024-01',
      endDate: '2025-01',
      isCurrent: false,
      highlights: [{
        id: 'highlight-1',
        text: 'Jan Kowalski obsłużył 600 700 800 zgłoszeń dla tajnego klienta.',
        metric: '',
        target: '',
        action: '',
        tool: '',
        keywords: [],
      }],
    }];

    const context = buildInterviewCoachProfileContext(vault);
    const serialized = JSON.stringify(context);

    expect(context.roleTitle).toBe('Specjalista wsparcia IT');
    expect(context.hardSkills).toEqual(['Windows 11', 'Microsoft 365']);
    expect(context.experience[0].role).toBe('Technik IT');
    expect(serialized).not.toContain('Jan Kowalski');
    expect(serialized).not.toContain('jan.kowalski@example.com');
    expect(serialized).not.toContain('600 700 800');
    expect(serialized).not.toContain('Kraków');
    expect(serialized).not.toContain('Tajny Klient');
    expect(serialized).not.toContain('photoUrl');
  });

  it('ogranicza liczbę umiejętności, doświadczeń i punktów wysyłanych do API', () => {
    const vault = createEmptyVault();
    vault.skillsMatrix.hardSkills = Array.from({ length: 12 }, (_, index) => `Umiejętność ${index}`);
    vault.skillsMatrix.toolsAndTech = Array.from({ length: 12 }, (_, index) => `Narzędzie ${index}`);
    vault.history = Array.from({ length: 5 }, (_, index) => ({
      id: `exp-${index}`,
      company: `Firma ${index}`,
      role: `Rola ${index}`,
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      highlights: Array.from({ length: 4 }, (__, highlightIndex) => ({
        id: `hl-${highlightIndex}`,
        text: `Punkt ${highlightIndex}`,
        metric: '',
        target: '',
        action: '',
        tool: '',
        keywords: [],
      })),
    }));

    const context = buildInterviewCoachProfileContext(vault);
    expect(context.hardSkills).toHaveLength(8);
    expect(context.toolsAndTech).toHaveLength(8);
    expect(context.experience).toHaveLength(3);
    expect(context.experience.every((entry) => entry.highlights.length === 2)).toBe(true);
    expect(JSON.stringify(context)).not.toContain('Firma 0');
  });
});
