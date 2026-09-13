import { describe, it, expect } from 'vitest';
import {
  deriveUnlocks,
  levelOf,
  reconcileMilestones,
  UxMilestones,
} from '../uxMilestones';
import { createEmptyVault } from '../sampleVault';
import { JobApplication, MasterVault } from '../../types';

const NOW = new Date('2026-05-20T10:00:00.000Z');

function startedVault(): MasterVault {
  const vault = createEmptyVault('Anna Nowak', 'anna@example.pl');
  return vault;
}

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: 'app-1',
    company: 'Elektrobud',
    position: 'Elektryk',
    salary: '',
    date: '2026-05-19',
    status: 'Wysłana',
    ...overrides,
  };
}

describe('Progresywne odblokowania', () => {
  describe('poziom 1 — nowy użytkownik', () => {
    it('daje dostęp tylko do profilu i aplikowania', () => {
      const unlocks = deriveUnlocks({});

      expect(unlocks.level).toBe(1);
      expect(unlocks.sections).toEqual({
        profil: true,
        aplikuj: true,
        trenuj: false,
        pipeline: false,
      });
    });

    it('mówi wprost, co odblokuje zablokowane sekcje', () => {
      const unlocks = deriveUnlocks({});

      expect(unlocks.reasons.trenuj).toMatch(/liście aplikacji/);
      expect(unlocks.reasons.pipeline).toMatch(/Aplikuj/);
    });

    it('nie pokazuje skrótów klawiszowych', () => {
      expect(deriveUnlocks({}).showShortcutsHint).toBe(false);
      expect(deriveUnlocks({}).interviewToolbox).toBe(false);
    });
  });

  describe('poziom 2 — pierwsza aplikacja', () => {
    it('odblokowuje trening i Pipeline', () => {
      const unlocks = deriveUnlocks({ firstApplicationAt: NOW.toISOString() });

      expect(unlocks.level).toBe(2);
      expect(unlocks.sections.trenuj).toBe(true);
      expect(unlocks.sections.pipeline).toBe(true);
      expect(unlocks.reasons).toEqual({});
    });

    it('nadal nie pokazuje Zasobnika Rozmowy', () => {
      expect(deriveUnlocks({ firstApplicationAt: NOW.toISOString() }).interviewToolbox).toBe(false);
    });
  });

  describe('poziom 3 — umówiona rozmowa', () => {
    const milestones: UxMilestones = {
      firstApplicationAt: NOW.toISOString(),
      firstInterviewAt: NOW.toISOString(),
    };

    it('odblokowuje Zasobnik Rozmowy i podpowiedź o skrótach', () => {
      const unlocks = deriveUnlocks(milestones);

      expect(unlocks.level).toBe(3);
      expect(unlocks.interviewToolbox).toBe(true);
      expect(unlocks.showShortcutsHint).toBe(true);
    });

    it('podpowiedź o skrótach pokazuje się tylko raz', () => {
      const seen = { ...milestones, shortcutsHintSeenAt: NOW.toISOString() };

      expect(deriveUnlocks(seen).showShortcutsHint).toBe(false);
      expect(deriveUnlocks(seen).interviewToolbox).toBe(true);
    });
  });

  describe('dopisywanie kamieni milowych', () => {
    it('odnotowuje rozpoczęty profil', () => {
      const next = reconcileMilestones({}, { vault: startedVault(), applications: [] }, NOW);

      expect(next.vaultStartedAt).toBe(NOW.toISOString());
    });

    it('nie odnotowuje niczego dla pustego profilu bez aplikacji', () => {
      const before: UxMilestones = {};
      const next = reconcileMilestones(before, { vault: createEmptyVault(), applications: [] }, NOW);

      // Ta sama referencja — inaczej efekt zapisujący wynik zapętliłby się.
      expect(next).toBe(before);
    });

    it('odnotowuje pierwszą aplikację i pierwszą rozmowę', () => {
      const next = reconcileMilestones(
        {},
        { vault: startedVault(), applications: [application({ status: 'Rozmowa' })] },
        NOW
      );

      expect(next.firstApplicationAt).toBe(NOW.toISOString());
      expect(next.firstInterviewAt).toBe(NOW.toISOString());
      expect(levelOf(next)).toBe(3);
    });

    it('traktuje otrzymaną ofertę jak przebytą rozmowę', () => {
      const next = reconcileMilestones(
        {},
        { vault: startedVault(), applications: [application({ status: 'Oferta' })] },
        NOW
      );

      expect(levelOf(next)).toBe(3);
    });

    it('nie nadpisuje daty kamienia milowego przy kolejnym przeliczeniu', () => {
      const first = reconcileMilestones(
        {},
        { vault: startedVault(), applications: [application()] },
        NOW
      );
      const later = reconcileMilestones(
        first,
        { vault: startedVault(), applications: [application(), application({ id: 'app-2' })] },
        new Date('2026-06-01T10:00:00.000Z')
      );

      expect(later.firstApplicationAt).toBe(NOW.toISOString());
      expect(later).toBe(first);
    });

    it('nie cofa odblokowania po usunięciu aplikacji', () => {
      const reached = reconcileMilestones(
        {},
        { vault: startedVault(), applications: [application({ status: 'Rozmowa' })] },
        NOW
      );
      const afterDelete = reconcileMilestones(reached, { vault: startedVault(), applications: [] }, NOW);

      expect(levelOf(afterDelete)).toBe(3);
      expect(deriveUnlocks(afterDelete).interviewToolbox).toBe(true);
    });
  });
});
