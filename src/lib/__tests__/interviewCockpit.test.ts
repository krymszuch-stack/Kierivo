import { describe, it, expect, beforeEach } from 'vitest';
import {
  getNegotiationTrapScripts,
  getRedFlagQuestions,
  loadCockpitProgress,
  saveCockpitProgress,
  toggleLessonCompletion,
} from '../interviewCockpitEngine';
import { MemoryStorage } from './helpers/memoryStorage';
import { resetLastGoodCache } from '../storage';

describe('Interview Cockpit Engine', () => {
  beforeEach(() => {
    resetLastGoodCache();
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

    const allScriptText = JSON.stringify(traps);
    expect(allScriptText).toContain('[prawdziwy powód]');
    expect(allScriptText).not.toContain('ustabilizowaliśmy system');
    expect(allScriptText).not.toContain('20% czasu');
    expect(allScriptText).not.toContain('80% na entuzjazm');
    expect(allScriptText).toContain('faktyczny obszar');
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
    const initial = loadCockpitProgress('profile-a');
    expect(initial.completedLessons).toHaveLength(0);

    const updated = toggleLessonCompletion('profile-a', 'pitch_completed');
    expect(updated.completedLessons).toContain('pitch_completed');

    const withCoach = toggleLessonCompletion('profile-a', 'star_coach_completed');
    expect(withCoach.completedLessons).toContain('star_coach_completed');

    const reloaded = loadCockpitProgress('profile-a');
    expect(reloaded.completedLessons).toContain('pitch_completed');
    expect(reloaded.completedLessons).toContain('star_coach_completed');
  });

  it('nie ujawnia prywatnych notatek kokpitu innemu profilowi', () => {
    const progress = loadCockpitProgress('profile-a');
    progress.notes = { private: 'Notatka z przygotowań' };
    saveCockpitProgress('profile-a', progress);

    expect(loadCockpitProgress('profile-b').notes).toEqual({});
    expect(loadCockpitProgress('profile-a').notes).toEqual({ private: 'Notatka z przygotowań' });
  });
});
