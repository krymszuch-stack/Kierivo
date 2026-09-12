import type { SignalFamily, SignalOwnership } from './contracts';

export const DEFAULT_SIGNAL_OWNERSHIP: readonly SignalOwnership[] = [
  {
    family: 'STRUCTURE',
    primaryModuleId: 'MOD_STRUCTURAL_READABILITY',
    secondaryConsumers: ['MOD_LANGUAGE_NATURALNESS', 'MOD_APPLICATION_READINESS'],
  },
  {
    family: 'CONTACT',
    primaryModuleId: 'MOD_APPLICATION_READINESS',
    secondaryConsumers: ['MOD_CONSISTENCY'],
  },
  {
    family: 'TEMPORAL',
    primaryModuleId: 'MOD_CONSISTENCY',
    secondaryConsumers: ['MOD_SKILL_RECENCY', 'MOD_ROLE_SENIORITY'],
  },
  {
    family: 'SKILL_PRESENCE',
    primaryModuleId: 'MOD_JOB_ALIGNMENT',
    secondaryConsumers: ['MOD_SKILL_RECENCY', 'MOD_ROLE_SENIORITY'],
  },
  {
    family: 'SKILL_CONTEXT',
    primaryModuleId: 'MOD_JOB_ALIGNMENT',
    secondaryConsumers: ['MOD_SKILL_RECENCY', 'MOD_ROLE_SENIORITY'],
  },
  {
    family: 'FORMAL_REQUIREMENT',
    primaryModuleId: 'MOD_FORMAL_REQUIREMENTS',
    secondaryConsumers: ['MOD_APPLICATION_READINESS'],
  },
  {
    family: 'ROLE_ALIGNMENT',
    primaryModuleId: 'MOD_ROLE_SENIORITY',
    secondaryConsumers: ['MOD_APPLICATION_READINESS'],
  },
  {
    family: 'METRIC_IMPACT',
    primaryModuleId: 'MOD_METRICS_EVIDENCE',
    secondaryConsumers: ['MOD_LANGUAGE_NATURALNESS'],
  },
  {
    family: 'LANGUAGE_QUALITY',
    primaryModuleId: 'MOD_LANGUAGE_NATURALNESS',
    secondaryConsumers: ['MOD_STRUCTURAL_READABILITY'],
  },
  {
    family: 'FACT_CONSISTENCY',
    primaryModuleId: 'MOD_CONSISTENCY',
    secondaryConsumers: ['MOD_APPLICATION_READINESS'],
  },
] as const;

export function validateSignalOwnership(
  ownership: readonly SignalOwnership[] = DEFAULT_SIGNAL_OWNERSHIP,
): string[] {
  const errors: string[] = [];
  const seen = new Set<SignalFamily>();
  for (const entry of ownership) {
    if (seen.has(entry.family)) errors.push(`SignalFamily ${entry.family} ma więcej niż jednego primary ownera.`);
    seen.add(entry.family);
    if (!entry.primaryModuleId.trim()) errors.push(`SignalFamily ${entry.family} nie ma primaryModuleId.`);
    if (entry.secondaryConsumers.includes(entry.primaryModuleId)) {
      errors.push(`Primary owner ${entry.primaryModuleId} nie może być jednocześnie secondary consumerem ${entry.family}.`);
    }
    if (new Set(entry.secondaryConsumers).size !== entry.secondaryConsumers.length) {
      errors.push(`SignalFamily ${entry.family} ma zduplikowanych secondary consumers.`);
    }
  }
  return errors;
}

export function ownerOfSignalFamily(
  family: SignalFamily,
  ownership: readonly SignalOwnership[] = DEFAULT_SIGNAL_OWNERSHIP,
): SignalOwnership | null {
  return ownership.find((entry) => entry.family === family) ?? null;
}

export function mayScoreSignalFamily(
  moduleId: string,
  family: SignalFamily,
  ownership: readonly SignalOwnership[] = DEFAULT_SIGNAL_OWNERSHIP,
): boolean {
  return ownerOfSignalFamily(family, ownership)?.primaryModuleId === moduleId;
}

export function mayConsumeSignalForDiagnostics(
  moduleId: string,
  family: SignalFamily,
  ownership: readonly SignalOwnership[] = DEFAULT_SIGNAL_OWNERSHIP,
): boolean {
  const entry = ownerOfSignalFamily(family, ownership);
  return Boolean(entry && (entry.primaryModuleId === moduleId || entry.secondaryConsumers.includes(moduleId)));
}
