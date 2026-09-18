/**
 * Zarządzanie planem nauki i kolejnych kroków zawodowych (Mój plan nauki).
 *
 * Utrwala cele, kroki („Mój następny krok”), zapisane materiały, notatki
 * i statusy w centralnym rejestrze schowka aplikacji.
 */

import {
  KnowledgeMaterial,
  LearningPlan,
  LearningPlanItem,
  DEFAULT_PLAN_STEPS,
} from '../data/careerKnowledge';
import { StorageKeys, readJson, writeJson } from './storage';

export function createDefaultLearningPlan(goalName = 'Mój następny krok'): LearningPlan {
  return {
    goalName,
    steps: DEFAULT_PLAN_STEPS.map((label, idx) => ({
      id: `step-${idx + 1}`,
      label,
      completed: false,
    })),
    items: [],
    updatedAt: new Date().toISOString(),
  };
}

export function getLearningPlan(): LearningPlan {
  const existing = readJson<LearningPlan | null>(StorageKeys.learningPlan, null);
  if (!existing || !Array.isArray(existing.steps) || !Array.isArray(existing.items)) {
    return createDefaultLearningPlan();
  }
  return existing;
}

export function saveLearningPlan(plan: LearningPlan): LearningPlan {
  const updated: LearningPlan = {
    ...plan,
    updatedAt: new Date().toISOString(),
  };
  writeJson(StorageKeys.learningPlan, updated);
  return updated;
}

export function addMaterialToPlan(
  material: KnowledgeMaterial,
  notes?: string
): { plan: LearningPlan; isNew: boolean } {
  const plan = getLearningPlan();
  const existingIndex = plan.items.findIndex((it) => it.materialId === material.id);

  if (existingIndex >= 0) {
    if (notes) {
      plan.items[existingIndex].notes = notes;
    }
    const saved = saveLearningPlan(plan);
    return { plan: saved, isNew: false };
  }

  const newItem: LearningPlanItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    materialId: material.id,
    materialTitle: material.title,
    status: 'not_started',
    statusLabel: 'Nie rozpoczęto',
    addedAt: new Date().toISOString(),
    notes: notes || '',
    nextTask: material.structure.concreteNextStep,
  };

  plan.items = [newItem, ...plan.items];
  const saved = saveLearningPlan(plan);
  return { plan: saved, isNew: true };
}

export function updatePlanItemStatus(
  materialId: string,
  status: LearningPlanItem['status']
): LearningPlan {
  const plan = getLearningPlan();
  const labelMap: Record<LearningPlanItem['status'], LearningPlanItem['statusLabel']> = {
    not_started: 'Nie rozpoczęto',
    in_progress: 'W trakcie',
    completed: 'Gotowe',
  };

  plan.items = plan.items.map((it) => {
    if (it.materialId === materialId) {
      return {
        ...it,
        status,
        statusLabel: labelMap[status],
      };
    }
    return it;
  });

  return saveLearningPlan(plan);
}

export function updatePlanItemNotes(
  materialId: string,
  notes: string,
  reminderDate?: string
): LearningPlan {
  const plan = getLearningPlan();
  plan.items = plan.items.map((it) => {
    if (it.materialId === materialId) {
      return {
        ...it,
        notes,
        reminderDate: reminderDate !== undefined ? reminderDate : it.reminderDate,
      };
    }
    return it;
  });
  return saveLearningPlan(plan);
}

export function removeMaterialFromPlan(materialId: string): LearningPlan {
  const plan = getLearningPlan();
  plan.items = plan.items.filter((it) => it.materialId !== materialId);
  return saveLearningPlan(plan);
}

export function togglePlanStep(stepId: string): LearningPlan {
  const plan = getLearningPlan();
  plan.steps = plan.steps.map((s) => (s.id === stepId ? { ...s, completed: !s.completed } : s));
  return saveLearningPlan(plan);
}
