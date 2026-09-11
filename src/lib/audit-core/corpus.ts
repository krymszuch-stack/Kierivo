import type { AuditMode, HardCapScope } from './contracts';

export const AUDIT_CORE_CORPUS_VERSION = 'audit-core-corpus-v2-2026-09-11';
export const AUDIT_CORE_CORPUS_JSON_PATH = 'src/lib/audit-core/corpus/golden-v2.json';

export interface GoldenCorpusExpectation {
  applicability?: 'APPLICABLE' | 'PARTIALLY_APPLICABLE' | 'NOT_APPLICABLE' | 'INSUFFICIENT_DATA';
  expectedHardCaps?: Array<{ scope: HardCapScope; ruleCode: string }>;
  minConfidence?: number;
  maxConfidence?: number;
  notes: string[];
}

export interface GoldenCorpusCase {
  id: string;
  mode: AuditMode;
  cvInput: { fixture: string; mutations: string[] };
  vaultInput: { fixture: string; mutations: string[] };
  jobInput: { fixture: string; mutations: string[] } | null;
  tags: string[];
  expectation: GoldenCorpusExpectation;
}

export interface GoldenCorpusRelation {
  betterCaseId: string;
  worseCaseId: string;
  rationale: string;
}

export interface GoldenCorpusDocument {
  version: string;
  cases: GoldenCorpusCase[];
  relations: GoldenCorpusRelation[];
}

export function validateGoldenCorpus(document: GoldenCorpusDocument): string[] {
  const errors: string[] = [];
  if (document.version !== AUDIT_CORE_CORPUS_VERSION) {
    errors.push(`Nieoczekiwana wersja corpus: ${document.version}.`);
  }
  const ids = new Set<string>();
  for (const item of document.cases) {
    if (ids.has(item.id)) errors.push(`Zduplikowany caseId: ${item.id}`);
    ids.add(item.id);
    if (!item.cvInput || !item.vaultInput) errors.push(`${item.id}: brak CV lub Vault input.`);
    if (item.mode === 'TARGETED_APPLICATION' && !item.jobInput) {
      errors.push(`${item.id}: TARGETED_APPLICATION bez Job input.`);
    }
    if (item.mode === 'GENERAL_CV' && item.jobInput !== null) {
      errors.push(`${item.id}: GENERAL_CV nie powinien wymagać Job input.`);
    }
    if (item.expectation.notes.length === 0) errors.push(`${item.id}: brak oczekiwania relacyjnego/diagnostycznego.`);
  }
  for (const relation of document.relations) {
    if (!ids.has(relation.betterCaseId) || !ids.has(relation.worseCaseId)) {
      errors.push(`Relacja ${relation.betterCaseId}>${relation.worseCaseId} wskazuje brakujący case.`);
    }
  }
  return errors;
}
