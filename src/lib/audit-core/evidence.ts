import type {
  Evidence,
  EvidenceProvenance,
  SignalFamily,
  SourcePointer,
} from './contracts';
import { buildEvidenceId, sha256Hex } from './hash';

export interface CreateEvidenceInput {
  schemaVersion: string;
  provenance: EvidenceProvenance;
  pointer: SourcePointer;
  description: string;
  normalizedPayload?: Record<string, string | number | boolean | null>;
  redactedSnippet?: string;
  extractionConfidence: number;
  correlationKey?: string;
  evidenceImportance?: number;
  signalFamily?: SignalFamily;
  /** Treść tylko do hasha. Nie jest zapisywana w Evidence. */
  contentForHash?: string;
}

export async function createEvidence(input: CreateEvidenceInput): Promise<Evidence> {
  const id = await buildEvidenceId(
    input.schemaVersion,
    input.pointer.source,
    input.pointer.jsonPath,
    input.normalizedPayload ?? {},
    input.provenance,
  );
  const contentHash = input.contentForHash === undefined
    ? undefined
    : await sha256Hex(input.contentForHash);

  return {
    id,
    provenance: input.provenance,
    pointer: { ...input.pointer },
    description: input.description,
    normalizedPayload: input.normalizedPayload ? { ...input.normalizedPayload } : undefined,
    redactedSnippet: input.redactedSnippet,
    contentHash,
    extractionConfidence: Math.max(0, Math.min(1, input.extractionConfidence)),
    correlationKey: input.correlationKey,
    evidenceImportance: input.evidenceImportance,
    signalFamily: input.signalFamily,
  };
}

export function validateEvidenceGraph(evidence: readonly Evidence[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const atom of evidence) {
    if (ids.has(atom.id)) errors.push(`Zduplikowane Evidence ID: ${atom.id}`);
    ids.add(atom.id);
    if (!/^EV_[0-9a-f]{20}$/i.test(atom.id)) errors.push(`Evidence ${atom.id} ma niekanoniczne ID.`);
    if (!atom.pointer.jsonPath.trim()) errors.push(`Evidence ${atom.id} nie ma jsonPath.`);
    if (atom.extractionConfidence < 0 || atom.extractionConfidence > 1 || !Number.isFinite(atom.extractionConfidence)) {
      errors.push(`Evidence ${atom.id} ma extractionConfidence poza 0..1.`);
    }
    if (atom.evidenceImportance !== undefined && (!Number.isFinite(atom.evidenceImportance) || atom.evidenceImportance < 0)) {
      errors.push(`Evidence ${atom.id} ma niepoprawne evidenceImportance.`);
    }
  }
  return errors;
}

/**
 * Minimalna redakcja do explainability UI. Nie jest pełnym systemem DLP, tylko
 * ochroną przed przypadkowym pokazaniem najczęstszych PII w ledgerze.
 */
export function redactCommonPii(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
    .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, '[PHONE]');
}
