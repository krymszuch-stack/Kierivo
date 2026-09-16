import { describe, it, expect, beforeEach } from 'vitest';
import {
  getNegotiationTrapScripts,
  getRedFlagQuestions,
  loadCockpitProgress,
  toggleLessonCompletion,
} from '../interviewCockpitEngine';
import { MemoryStorage } from './helpers/memoryStorage';

describe('Interview Cockpit Engine', () => {
  beforeEach(() => {
    // Podstawienie atrapy localStorage
    const memory = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: memory,
      configurable: true,
      writable: true,
    });
  });

  it('zwraca bazę skryptów na trudne pytania rekrutacyjne i pułapki', () => {
    const traps = getNegotiationTrapScripts();
    expect(traps.length).toBeGreaterThanOrEqual(3);

    const salaryTrap = traps.find((t) => t.id === 'trap_salary');
    expect(salaryTrap).toBeDefined();
    expect(salaryTrap?.variants.length).toBeGreaterThanOrEqual(2);
    expect(salaryTrap?.proTip).toBeTruthy();
  });

  it('zwraca bazę pytań do rekrutera z analizą Red Flags', () => {
    const redFlags = getRedFlagQuestions();
    expect(redFlags.length).toBeGreaterThanOrEqual(4);

    const techDebt = redFlags.find((q) => q.category === 'TECH_DEBT');
    expect(techDebt).toBeDefined();
    expect(techDebt?.greenFlagAnswer).toBeTruthy();
    expect(techDebt?.redFlagWarning).toBeTruthy();
  });

  it('zarządza utrwalaniem ukończonych materiałów w LocalStorage', () => {
    const initial = loadCockpitProgress();
    expect(initial.completedLessons).toHaveLength(0);

    const updated = toggleLessonCompletion('pitch_completed');
    expect(updated.completedLessons).toContain('pitch_completed');

    const withCoach = toggleLessonCompletion('star_coach_completed');
    expect(withCoach.completedLessons).toContain('star_coach_completed');

    const reloaded = loadCockpitProgress();
    expect(reloaded.completedLessons).toContain('pitch_completed');
    expect(reloaded.completedLessons).toContain('star_coach_completed');
  });
});
