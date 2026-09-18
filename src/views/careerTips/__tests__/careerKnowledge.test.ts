import { describe, it, expect, beforeEach } from 'vitest';
import {
  INITIAL_MATERIALS,
  KNOWLEDGE_CATEGORIES,
  USER_INTENTS,
  QUICK_GOALS,
  DEFAULT_PLAN_STEPS,
} from '../../../data/careerKnowledge';
import {
  createDefaultLearningPlan,
  getLearningPlan,
  addMaterialToPlan,
  updatePlanItemStatus,
  updatePlanItemNotes,
  removeMaterialFromPlan,
  togglePlanStep,
} from '../../../lib/learningPlanStorage';
import { StorageKeys } from '../../../lib/storage';

describe('Baza Wiedzy i Poradnik Kariery — rzetelność, struktura i plan nauki', () => {
  beforeEach(() => {
    // Reset testowego stanu localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(StorageKeys.learningPlan);
    }
  });

  describe('1. Zunifikowana 9-punktowa struktura i wiarygodność materiałów', () => {
    it('posiada wszystkie materiały z kompletną strukturą 9 punktów', () => {
      expect(INITIAL_MATERIALS.length).toBeGreaterThanOrEqual(10);

      INITIAL_MATERIALS.forEach((mat) => {
        const s = mat.structure;
        // 1. Dla kogo
        expect(s.targetAudience.length).toBeGreaterThan(10);
        // 2. Czego można się nauczyć
        expect(s.whatYouWillLearn.length).toBeGreaterThanOrEqual(2);
        // 3. Wymagania
        expect(s.commonRequirements.length).toBeGreaterThanOrEqual(1);
        // 4. Gdzie zdobyć wiedzę
        expect(s.whereToLearn.length).toBeGreaterThanOrEqual(1);
        // 5. Czas i zaangażowanie
        expect(s.timeAndCommitment.length).toBeGreaterThan(5);
        // 6. Jak sprawdzić jakość
        expect(s.howToCheckQuality.length).toBeGreaterThanOrEqual(1);
        // 7. Stanowiska po drodze
        expect(s.entryRolesAlongTheWay.length).toBeGreaterThanOrEqual(1);
        // 8. Jak przygotować CV
        expect(s.howToPrepareCv.length).toBeGreaterThanOrEqual(1);
        // 9. Konkretny następny krok
        expect(s.concreteNextStep.length).toBeGreaterThan(10);
      });
    });

    it('każdy materiał posiada oficjalne źródło i ostrzeżenie regionalne', () => {
      INITIAL_MATERIALS.forEach((mat) => {
        expect(mat.officialSource).toBeDefined();
        expect(mat.officialSource.sourceName.length).toBeGreaterThan(3);
        expect(mat.officialSource.url).toMatch(/^https?:\/\//);
        expect(mat.officialSource.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(mat.officialSource.regionalNotice.length).toBeGreaterThan(10);
      });
    });

    it('ścieżki zawodowe posiadają poziom wejścia i przykładowe stanowiska', () => {
      const pathways = INITIAL_MATERIALS.filter((m) => m.type === 'pathway');
      expect(pathways.length).toBeGreaterThanOrEqual(3);

      pathways.forEach((p) => {
        expect(['from_scratch', 'requires_experience', 'similar_industry']).toContain(p.entryLevel);
        expect(p.initialRoles).toBeDefined();
        expect(p.initialRoles!.length).toBeGreaterThan(0);
        expect(p.estimatedDuration).toBeDefined();
      });
    });

    it('nie zawiera obietnic sukcesu ani gwarancji zatrudnienia', () => {
      INITIAL_MATERIALS.forEach((mat) => {
        const fullText = JSON.stringify(mat).toLowerCase();
        expect(fullText).not.toContain('gwarantowana praca');
        expect(fullText).not.toContain('pewny zawód');
        expect(fullText).not.toContain('wysokie zarobki');
      });
    });
  });

  describe('2. Kategorie, intencje i szybkie cele', () => {
    it('zawiera wymagane kategorie wiedzy', () => {
      const categoryLabels = KNOWLEDGE_CATEGORIES.map((c) => c.label);
      expect(categoryLabels).toContain('Wszystkie');
      expect(categoryLabels).toContain('CV i aplikowanie');
      expect(categoryLabels).toContain('Rozmowa o pracę');
      expect(categoryLabels).toContain('Nauka i kwalifikacje');
      expect(categoryLabels).toContain('Zmiana zawodu');
      expect(categoryLabels).toContain('Dofinansowania');
      expect(categoryLabels).toContain('Branże i zawody');
      expect(categoryLabels).toContain('Prawo i bezpieczeństwo');
    });

    it('zawiera wymagany filtr intencji użytkownika', () => {
      const intentLabels = USER_INTENTS.map((i) => i.label);
      expect(intentLabels).toContain('Nie wiem, co dalej');
      expect(intentLabels).toContain('Chcę szybko znaleźć pracę');
      expect(intentLabels).toContain('Chcę zdobyć konkretną kwalifikację');
      expect(intentLabels).toContain('Chcę zmienić zawód');
      expect(intentLabels).toContain('Chcę wrócić na rynek pracy');
      expect(intentLabels).toContain('Chcę poprawić CV');
      expect(intentLabels).toContain('Chcę sprawdzić, czy mogę dostać dofinansowanie');
    });

    it('zawiera 5 przycisków w sekcji Nie wiesz, co dalej?', () => {
      expect(QUICK_GOALS).toHaveLength(5);
      const goalLabels = QUICK_GOALS.map((g) => g.label);
      expect(goalLabels).toContain('Chcę zacząć od podstaw');
      expect(goalLabels).toContain('Chcę szybko zdobyć uprawnienia');
      expect(goalLabels).toContain('Chcę zmienić zawód');
      expect(goalLabels).toContain('Chcę znaleźć szkolenie');
      expect(goalLabels).toContain('Chcę sprawdzić dofinansowanie');
    });
  });

  describe('3. Zarządzanie planem nauki (Mój plan nauki & Mój następny krok)', () => {
    it('tworzy domyślny plan z 8 krokami działania', () => {
      const plan = createDefaultLearningPlan();
      expect(plan.goalName).toBe('Mój następny krok');
      expect(plan.steps).toHaveLength(8);
      expect(plan.steps.map((s) => s.label)).toEqual(DEFAULT_PLAN_STEPS);
      expect(plan.steps.every((s) => !s.completed)).toBe(true);
      expect(plan.items).toHaveLength(0);
    });

    it('dodaje materiał do planu i zapobiega duplikatom', () => {
      const sample = INITIAL_MATERIALS[0];
      const res1 = addMaterialToPlan(sample, 'Sprawdzić termin w urzędzie');
      expect(res1.isNew).toBe(true);
      expect(res1.plan.items).toHaveLength(1);
      expect(res1.plan.items[0].materialId).toBe(sample.id);
      expect(res1.plan.items[0].status).toBe('not_started');
      expect(res1.plan.items[0].notes).toBe('Sprawdzić termin w urzędzie');

      // Powtórne dodanie aktualizuje notatkę bez duplikowania rekordu
      const res2 = addMaterialToPlan(sample, 'Zaktualizowana notatka');
      expect(res2.isNew).toBe(false);
      expect(res2.plan.items).toHaveLength(1);
      expect(res2.plan.items[0].notes).toBe('Zaktualizowana notatka');
    });

    it('aktualizuje status, notatkę i pozwala usunąć materiał z planu', () => {
      const sample = INITIAL_MATERIALS[0];
      addMaterialToPlan(sample);

      // Zmiana statusu
      const planWithStatus = updatePlanItemStatus(sample.id, 'in_progress');
      expect(planWithStatus.items[0].status).toBe('in_progress');
      expect(planWithStatus.items[0].statusLabel).toBe('W trakcie');

      // Zmiana notatki i przypomnienia
      const planWithNotes = updatePlanItemNotes(sample.id, 'Termin za 2 dni', '2026-04-15');
      expect(planWithNotes.items[0].notes).toBe('Termin za 2 dni');
      expect(planWithNotes.items[0].reminderDate).toBe('2026-04-15');

      // Usunięcie z planu
      const planAfterRemove = removeMaterialFromPlan(sample.id);
      expect(planAfterRemove.items).toHaveLength(0);
    });

    it('pozwala odhaczać kolejne kroki w checklisty działania', () => {
      const plan = getLearningPlan();
      const firstStepId = plan.steps[0].id;

      const updated = togglePlanStep(firstStepId);
      expect(updated.steps[0].completed).toBe(true);

      const toggledBack = togglePlanStep(firstStepId);
      expect(toggledBack.steps[0].completed).toBe(false);
    });
  });
});
