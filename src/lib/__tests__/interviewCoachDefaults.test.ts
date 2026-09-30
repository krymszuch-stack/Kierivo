import { describe, expect, it } from 'vitest';
import { DEFAULT_INTERVIEW_QUESTIONS, resolveInterviewTargetRole } from '../interviewCoachDefaults';

describe('bazowe ćwiczenia STAR', () => {
  it('nie zakłada stanowiska IT, projektu wdrożeniowego ani liczbowego wyniku', () => {
    const content = JSON.stringify(DEFAULT_INTERVIEW_QUESTIONS);
    expect(DEFAULT_INTERVIEW_QUESTIONS).toHaveLength(3);
    expect(content).toMatch(/pracy, nauce|innym ważnym doświadczeniu/i);
    expect(content).not.toMatch(/Senior Software Engineer|architektur|wdrożeni|Kubernetes|metryk.*wymag/i);
    expect(content).toContain('liczbowej metryki');
  });

  it('pozostawia rolę pustą, kiedy użytkownik nie podał stanowiska', () => {
    expect(resolveInterviewTargetRole(undefined)).toBe('');
    expect(resolveInterviewTargetRole('   ')).toBe('');
    expect(resolveInterviewTargetRole('  Technik IT  ')).toBe('Technik IT');
  });
});
