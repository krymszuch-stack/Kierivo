import { z } from 'zod';

export const EntityTypeEnum = z.enum([
  'profession',
  'skill',
  'tool',
  'item',
  'device',
  'material',
  'brand',
  'technology',
  'industry',
  'certification',
  'task',
  'concept',
]);

export type EntityType = z.infer<typeof EntityTypeEnum>;

export const EntityStatusEnum = z.enum([
  'seed',
  'proposed',
  'verified',
  'rejected',
  'deprecated',
]);

export type EntityStatus = z.infer<typeof EntityStatusEnum>;

export const SourceTypeEnum = z.enum([
  'curated',
  'gemini',
  'imported',
  'manual',
]);

export type SourceType = z.infer<typeof SourceTypeEnum>;

export const RelationTypeEnum = z.enum([
  'alias_of',
  'belongs_to',
  'used_by',
  'used_for',
  'installs',
  'services',
  'repairs',
  'manufactures',
  'requires_skill',
  'related_to',
  'subtype_of',
  'compatible_with',
  'works_in',
  'produces',
  'sells',
  'certifies',
]);

export type RelationType = z.infer<typeof RelationTypeEnum>;

export const RelationStatusEnum = z.enum([
  'proposed',
  'verified',
  'rejected',
]);

export type RelationStatus = z.infer<typeof RelationStatusEnum>;

export const EvidenceRecordSchema = z.object({
  sourceType: SourceTypeEnum,
  note: z.string().max(255),
  createdAt: z.string(),
});

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

export const EntitySchema = z.object({
  id: z.string(),
  type: EntityTypeEnum,
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  status: EntityStatusEnum,
  confidence: z.number().min(0).max(1),
  source: SourceTypeEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Entity = z.infer<typeof EntitySchema>;

export const RelationSchema = z.object({
  id: z.string(),
  fromEntityId: z.string(),
  toEntityId: z.string(),
  type: RelationTypeEnum,
  weight: z.number().min(0).max(1).default(1),
  confidence: z.number().min(0).max(1),
  status: RelationStatusEnum,
  source: SourceTypeEnum,
  evidence: z.array(EvidenceRecordSchema).max(3).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Relation = z.infer<typeof RelationSchema>;

export const ProposalSchema = z.object({
  id: z.string(),
  entity: EntitySchema.optional(),
  relation: RelationSchema.optional(),
  status: RelationStatusEnum,
  proposedBy: z.string().default('gemini'),
  notes: z.string().default(''),
  createdAt: z.string(),
});

export type Proposal = z.infer<typeof ProposalSchema>;
