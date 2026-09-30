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
import { StorageKeys, profileDataKeyFor, readJson, writeJson } from './storage';

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

export function getLearningPlan(profileId: string): LearningPlan {
  const existing = readJson<LearningPlan | null>(profileDataKeyFor(StorageKeys.learningPlan, profileId), null);
  if (!existing || !Array.isArray(existing.steps) || !Array.isArray(existing.items)) {
    return createDefaultLearningPlan();
  }
  return existing;
}

export function saveLearningPlan(profileId: string, plan: LearningPlan): LearningPlan {
  const updated: LearningPlan = {
    ...plan,
    updatedAt: new Date().toISOString(),
  };
  writeJson(profileDataKeyFor(StorageKeys.learningPlan, profileId), updated);
  return updated;
}

export function addMaterialToPlan(
  profileId: string,
  material: KnowledgeMaterial,
  notes?: string
): { plan: LearningPlan; isNew: boolean } {
  const plan = getLearningPlan(profileId);
  const existingIndex = plan.items.findIndex((it) => it.materialId === material.id);

  if (existingIndex >= 0) {
    if (notes) {
      plan.items[existingIndex].notes = notes;
    }
    const saved = saveLearningPlan(profileId, plan);
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
  const saved = saveLearningPlan(profileId, plan);
  return { plan: saved, isNew: true };
}

export function updatePlanItemStatus(
  profileId: string,
  materialId: string,
  status: LearningPlanItem['status']
): LearningPlan {
  const plan = getLearningPlan(profileId);
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

  return saveLearningPlan(profileId, plan);
}

export function updatePlanItemNotes(
  profileId: string,
  materialId: string,
  notes: string,
  reminderDate?: string
): LearningPlan {
  const plan = getLearningPlan(profileId);
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
  return saveLearningPlan(profileId, plan);
}

export function removeMaterialFromPlan(profileId: string, materialId: string): LearningPlan {
  const plan = getLearningPlan(profileId);
  plan.items = plan.items.filter((it) => it.materialId !== materialId);
  return saveLearningPlan(profileId, plan);
}

export function togglePlanStep(profileId: string, stepId: string): LearningPlan {
  const plan = getLearningPlan(profileId);
  plan.steps = plan.steps.map((s) => (s.id === stepId ? { ...s, completed: !s.completed } : s));
  return saveLearningPlan(profileId, plan);
}
