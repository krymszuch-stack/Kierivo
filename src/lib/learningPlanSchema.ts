import { z } from 'zod';
import { DEFAULT_PLAN_STEPS, type LearningPlan, type LearningPlanItem } from '../data/careerKnowledge';

const planStepSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  completed: z.boolean(),
}).passthrough();

const planItemSchema = z.object({
  id: z.string().min(1),
  materialId: z.string().min(1),
  materialTitle: z.string(),
  status: z.enum(['not_started', 'in_progress', 'completed']),
  addedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  notes: z.string().optional(),
  nextTask: z.string().optional(),
  reminderDate: z.string().optional(),
}).passthrough();

export interface LearningPlanRecovery {
  root?: unknown;
  fields?: Record<string, unknown>;
  steps?: unknown[];
  items?: unknown[];
}

export interface ParsedLearningPlan {
  plan: LearningPlan;
  recovery?: LearningPlanRecovery;
}

const STATUS_LABELS: Record<LearningPlanItem['status'], LearningPlanItem['statusLabel']> = {
  not_started: 'Nie rozpoczęto',
  in_progress: 'W trakcie',
  completed: 'Gotowe',
};

export function createLearningPlanDefaults(goalName = 'Mój następny krok'): LearningPlan {
  return {
    goalName,
    steps: DEFAULT_PLAN_STEPS.map((label, idx) => ({ id: `step-${idx + 1}`, label, completed: false })),
    items: [],
    updatedAt: new Date().toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecovery(value: unknown): LearningPlanRecovery {
  if (!isRecord(value)) return {};
  return {
    ...(Object.hasOwn(value, 'root') ? { root: value.root } : {}),
    ...(isRecord(value.fields) ? { fields: { ...value.fields } } : {}),
    ...(Array.isArray(value.steps) ? { steps: [...value.steps] } : {}),
    ...(Array.isArray(value.items) ? { items: [...value.items] } : {}),
  };
}

function hasRecovery(recovery: LearningPlanRecovery): boolean {
  return Object.keys(recovery).length > 0;
}

/** Waliduje rekord, kwarantannuje wadliwe wiersze i zachowuje je poza listą renderowaną w UI. */
export function parseLearningPlan(value: unknown): ParsedLearningPlan {
  if (!isRecord(value)) {
    return { plan: createLearningPlanDefaults(), recovery: { root: value } };
  }

  const recovery = readRecovery(value.__kierivoRecovery);
  const fields = recovery.fields ?? {};
  const quarantineField = (field: string, raw: unknown) => { fields[field] = raw; };
  const knownFields = new Set(['goalName', 'steps', 'items', 'updatedAt', '__kierivoRecovery']);
  for (const [key, raw] of Object.entries(value)) {
    if (!knownFields.has(key)) fields[key] = raw;
  }

  const goalName = typeof value.goalName === 'string'
    ? value.goalName
    : (Object.hasOwn(value, 'goalName') ? (quarantineField('goalName', value.goalName), 'Mój następny krok') : 'Mój następny krok');

  const steps: LearningPlan['steps'] = [];
  const seenStepIds = new Set<string>();
  if (Array.isArray(value.steps)) {
    for (const raw of value.steps) {
      const parsed = planStepSchema.safeParse(raw);
      if (!parsed.success || seenStepIds.has(parsed.data?.id ?? '')) {
        recovery.steps = [...(recovery.steps ?? []), raw];
        continue;
      }
      seenStepIds.add(parsed.data.id);
      steps.push(parsed.data);
    }
  } else if (Object.hasOwn(value, 'steps')) {
    quarantineField('steps', value.steps);
  }

  const items: LearningPlanItem[] = [];
  const seenItemIds = new Set<string>();
  const seenMaterialIds = new Set<string>();
  if (Array.isArray(value.items)) {
    for (const raw of value.items) {
      const parsed = planItemSchema.safeParse(raw);
      if (!parsed.success || seenItemIds.has(parsed.data?.id ?? '') || seenMaterialIds.has(parsed.data?.materialId ?? '')) {
        recovery.items = [...(recovery.items ?? []), raw];
        continue;
      }
      seenItemIds.add(parsed.data.id);
      seenMaterialIds.add(parsed.data.materialId);
      items.push({ ...parsed.data, statusLabel: STATUS_LABELS[parsed.data.status] });
    }
  } else if (Object.hasOwn(value, 'items')) {
    quarantineField('items', value.items);
  }

  // Ten ekranów dzieliłoby postęp przez zero; plan zawsze ma przynajmniej checklistę startową.
  const safeSteps = steps.length > 0 ? steps : createLearningPlanDefaults().steps;
  const updatedAt = typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))
    ? value.updatedAt
    : new Date().toISOString();
  if (Object.hasOwn(value, 'updatedAt') && updatedAt !== value.updatedAt) quarantineField('updatedAt', value.updatedAt);

  recovery.fields = Object.keys(fields).length > 0 ? fields : undefined;
  if (recovery.fields === undefined) delete recovery.fields;

  return {
    plan: { goalName, steps: safeSteps, items, updatedAt },
    ...(hasRecovery(recovery) ? { recovery } : {}),
  };
}
