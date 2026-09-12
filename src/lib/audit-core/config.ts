import { z } from 'zod';
import type { AuditDomainId, EvidenceProvenance } from './contracts';
import type { ConfidenceWeights } from './confidence';
import type { DomainAggregationPolicy } from './aggregation';

const domainIds = [
  'DOCUMENT_QUALITY',
  'JOB_FIT',
  'EVIDENCE_QUALITY',
  'INTEGRITY',
  'FORMAL_READINESS',
] as const;

const provenanceIds = [
  'USER_ASSERTED_CANONICAL',
  'EXPLICIT_DOCUMENT_FACT',
  'CROSS_SOURCE_CONSISTENT',
  'DERIVED_DETERMINISTIC',
  'EXTERNALLY_VERIFIED',
  'INFERRED_HEURISTIC',
  'CONTRADICTION',
  'ADVERSARIAL_SIGNAL',
] as const;

const confidenceWeightsSchema = z.object({
  coverage: z.number().nonnegative(),
  provenance: z.number().nonnegative(),
  extraction: z.number().nonnegative(),
  sample: z.number().nonnegative(),
});

const domainPolicySchema = z.object({
  domainId: z.enum(domainIds),
  moduleWeights: z.record(z.string(), z.number().nonnegative()),
  requiredModuleIds: z.array(z.string()).default([]),
});

export const auditCoreConfigSchema = z.object({
  configVersion: z.string().min(1),
  engineVersion: z.string().min(1),
  corpusSchemaVersion: z.string().min(1),
  calibrationRequired: z.literal(true),
  aggregation: z.object({
    baselineP: z.literal(0),
    delta: z.number().positive().max(5),
  }),
  confidenceWeights: confidenceWeightsSchema,
  provenanceReliability: z.record(z.enum(provenanceIds), z.number().min(0).max(1)),
  domainWeights: z.record(z.enum(domainIds), z.number().nonnegative()),
  domainPolicies: z.array(domainPolicySchema),
});

export type AuditCoreConfig = z.infer<typeof auditCoreConfigSchema>;

const equalDomainWeights: Record<AuditDomainId, number> = {
  DOCUMENT_QUALITY: 1,
  JOB_FIT: 1,
  EVIDENCE_QUALITY: 1,
  INTEGRITY: 1,
  FORMAL_READINESS: 1,
};

/**
 * Priory inżynierskie, nie empiryczna kalibracja. `calibrationRequired: true`
 * jest częścią schema i nie da się go przypadkiem wyłączyć w tej wersji.
 */
export const DEFAULT_AUDIT_CORE_CONFIG: AuditCoreConfig = {
  configVersion: 'audit-core-config-v2.0.1-precalibration',
  engineVersion: 'audit-core-1.0.0-precalibration',
  corpusSchemaVersion: 'audit-core-corpus-v2',
  calibrationRequired: true,
  aggregation: {
    baselineP: 0,
    delta: 1,
  },
  confidenceWeights: {
    coverage: 0.40,
    provenance: 0.25,
    extraction: 0.20,
    sample: 0.15,
  },
  provenanceReliability: {
    EXTERNALLY_VERIFIED: 1.00,
    CROSS_SOURCE_CONSISTENT: 0.90,
    USER_ASSERTED_CANONICAL: 0.75,
    EXPLICIT_DOCUMENT_FACT: 0.70,
    DERIVED_DETERMINISTIC: 0.70,
    INFERRED_HEURISTIC: 0.45,
    CONTRADICTION: 0.30,
    ADVERSARIAL_SIGNAL: 0.70,
  },
  domainWeights: equalDomainWeights,
  domainPolicies: [
    {
      domainId: 'DOCUMENT_QUALITY',
      moduleWeights: {
        MOD_STRUCTURAL_READABILITY: 1,
        MOD_LANGUAGE_NATURALNESS: 1,
      },
      requiredModuleIds: [],
    },
    {
      domainId: 'JOB_FIT',
      moduleWeights: {
        MOD_JOB_ALIGNMENT: 1,
        MOD_SKILL_RECENCY: 1,
        MOD_ROLE_SENIORITY: 1,
      },
      requiredModuleIds: [],
    },
    {
      domainId: 'EVIDENCE_QUALITY',
      moduleWeights: { MOD_METRICS_EVIDENCE: 1 },
      requiredModuleIds: [],
    },
    {
      domainId: 'INTEGRITY',
      moduleWeights: { MOD_CONSISTENCY: 1 },
      requiredModuleIds: [],
    },
    {
      domainId: 'FORMAL_READINESS',
      moduleWeights: { MOD_FORMAL_REQUIREMENTS: 1 },
      requiredModuleIds: [],
    },
  ],
};

export function validateAuditCoreConfig(config: unknown): AuditCoreConfig {
  const parsed = auditCoreConfigSchema.parse(config);
  const confidenceSum = Object.values(parsed.confidenceWeights).reduce((sum, value) => sum + value, 0);
  if (Math.abs(confidenceSum - 1) > 1e-9) {
    throw new Error(`Wagi confidence muszą sumować się do 1, otrzymano ${confidenceSum}.`);
  }
  const domainWeightSum = Object.values(parsed.domainWeights).reduce((sum, value) => sum + value, 0);
  if (domainWeightSum <= Number.EPSILON) throw new Error('Co najmniej jedna domena musi mieć dodatnią wagę.');

  const seenDomains = new Set<AuditDomainId>();
  for (const policy of parsed.domainPolicies) {
    if (seenDomains.has(policy.domainId)) {
      throw new Error(`Domena ${policy.domainId} ma więcej niż jedną politykę agregacji.`);
    }
    seenDomains.add(policy.domainId);
  }
  return parsed;
}

export function confidenceWeightsFromConfig(config: AuditCoreConfig): ConfidenceWeights {
  return { ...config.confidenceWeights };
}

export function domainPoliciesFromConfig(config: AuditCoreConfig): DomainAggregationPolicy[] {
  return config.domainPolicies.map((policy) => ({
    domainId: policy.domainId,
    moduleWeights: { ...policy.moduleWeights },
    requiredModuleIds: [...policy.requiredModuleIds],
  }));
}

export function provenanceReliabilityFromConfig(
  config: AuditCoreConfig,
): Record<EvidenceProvenance, number> {
  return { ...config.provenanceReliability } as Record<EvidenceProvenance, number>;
}
