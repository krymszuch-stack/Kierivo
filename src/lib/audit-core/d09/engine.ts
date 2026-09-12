import type { MasterVault } from '../../../types';
import type { CanonicalDocumentRepresentation } from '../document';
import { classifyDocumentForAudit } from '../ingestion/documentGate';
import {
  buildD09CandidateEvidenceFromDocument,
  buildD09CandidateEvidenceFromVault,
} from './candidateEvidence';
import { extractD09Requirements } from './requirementParser';
import { scoreD09JobAlignment } from './scorer';
import type { D09AuditResult, D09CandidateEvidence } from './types';

export async function runD09FromVault(input: {
  vault: MasterVault;
  jobDescription: string;
  inferredEvidence?: D09CandidateEvidence[];
  /**
   * Do czasu wdrożenia D18 Master Vault nie wolno zakładać, że puste pole
   * oznacza świadome „nie posiadam”. Caller może podać 1 dopiero po preflight
   * kompletności. Domyślnie zachowujemy epistemiczną ostrożność.
   */
  vaultCompletenessConfidence?: number;
}): Promise<D09AuditResult> {
  const extraction = await extractD09Requirements(input.jobDescription);
  const vaultEvidence = await buildD09CandidateEvidenceFromVault(input.vault);
  const completeness = Math.min(1, Math.max(0, input.vaultCompletenessConfidence ?? 0.65));
  return scoreD09JobAlignment({
    extraction,
    candidateEvidence: [...vaultEvidence, ...(input.inferredEvidence ?? [])],
    documentClass: 'CV',
    sourceCompletenessConfidence: completeness,
    // scorerCore ma dziś semantykę „VAULT = brak jest świadomie potwierdzony”.
    // Dopóki D18 nie dostarczy field-state completeness, używamy tego trybu
    // tylko po przekroczeniu progu wystarczającej kompletności.
    sourceMode: completeness >= 0.75 ? 'VAULT' : 'EXTRACTED_DOCUMENT',
  });
}

export async function runD09FromCanonicalDocument(input: {
  document: CanonicalDocumentRepresentation;
  jobDescription: string;
  inferredEvidence?: D09CandidateEvidence[];
}): Promise<D09AuditResult> {
  const extraction = await extractD09Requirements(input.jobDescription);
  const candidateEvidence = await buildD09CandidateEvidenceFromDocument(input.document);
  const documentGate = classifyDocumentForAudit(input.document.fullText);

  return scoreD09JobAlignment({
    extraction,
    candidateEvidence: [...candidateEvidence, ...(input.inferredEvidence ?? [])],
    documentClass: documentGate.documentClass,
    sourceCompletenessConfidence: input.document.extractionConfidence,
    sourceMode: 'EXTRACTED_DOCUMENT',
  });
}
