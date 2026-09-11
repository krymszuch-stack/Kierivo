import type {
  ApplicabilityState,
  AuditMode,
  EvidenceRequirement,
  MissingEvidence,
} from './contracts';

export interface ApplicabilityInput {
  mode: AuditMode;
  requirements: EvidenceRequirement[];
  fulfilledRequirementCodes: ReadonlySet<string>;
  moduleEnabledInMode: boolean;
  pipelineHealthy: boolean;
}

export interface ApplicabilityDecision {
  state: ApplicabilityState;
  missingRequiredCodes: string[];
  missingOptionalCodes: string[];
  expectedWeight: number;
  fulfilledWeight: number;
}

function appliesToMode(requirement: EvidenceRequirement, mode: AuditMode): boolean {
  return !requirement.modes || requirement.modes.includes(mode);
}

export function decideApplicability(input: ApplicabilityInput): ApplicabilityDecision {
  if (!input.moduleEnabledInMode) {
    return {
      state: 'NOT_APPLICABLE',
      missingRequiredCodes: [],
      missingOptionalCodes: [],
      expectedWeight: 0,
      fulfilledWeight: 0,
    };
  }

  const active = input.requirements.filter((requirement) => appliesToMode(requirement, input.mode));
  const expectedWeight = active.reduce((sum, requirement) => sum + Math.max(0, requirement.expectedWeight), 0);
  const fulfilledWeight = active
    .filter((requirement) => input.fulfilledRequirementCodes.has(requirement.code))
    .reduce((sum, requirement) => sum + Math.max(0, requirement.expectedWeight), 0);

  if (!input.pipelineHealthy) {
    return {
      state: 'INSUFFICIENT_DATA',
      missingRequiredCodes: active.filter((r) => r.required).map((r) => r.code),
      missingOptionalCodes: active.filter((r) => !r.required).map((r) => r.code),
      expectedWeight,
      fulfilledWeight,
    };
  }

  const missingRequiredCodes = active
    .filter((requirement) => requirement.required && !input.fulfilledRequirementCodes.has(requirement.code))
    .map((requirement) => requirement.code);
  const missingOptionalCodes = active
    .filter((requirement) => !requirement.required && !input.fulfilledRequirementCodes.has(requirement.code))
    .map((requirement) => requirement.code);

  const state: ApplicabilityState =
    missingRequiredCodes.length > 0
      ? 'INSUFFICIENT_DATA'
      : missingOptionalCodes.length > 0
        ? 'PARTIALLY_APPLICABLE'
        : 'APPLICABLE';

  return {
    state,
    missingRequiredCodes,
    missingOptionalCodes,
    expectedWeight,
    fulfilledWeight,
  };
}

export function buildMissingEvidenceFromDecision(
  decision: ApplicabilityDecision,
  requirements: EvidenceRequirement[],
): MissingEvidence[] {
  const byCode = new Map(requirements.map((requirement) => [requirement.code, requirement]));
  return [
    ...decision.missingRequiredCodes.map((code): MissingEvidence => ({
      id: `MISS_${code}`,
      requirementCode: code,
      targetScope: code,
      description: `Brakuje wymaganego dowodu ${code}.`,
      severity: 'HIGH',
      expectedEvidenceWeight: byCode.get(code)?.expectedWeight ?? 0,
      suggestedAction: 'Dostarcz brakujące dane albo popraw ekstrakcję źródła.',
    })),
    ...decision.missingOptionalCodes.map((code): MissingEvidence => ({
      id: `MISS_${code}`,
      requirementCode: code,
      targetScope: code,
      description: `Brakuje opcjonalnego dowodu ${code}.`,
      severity: 'LOW',
      expectedEvidenceWeight: byCode.get(code)?.expectedWeight ?? 0,
      suggestedAction: 'Uzupełnij dane, jeśli są dostępne.',
    })),
  ];
}
