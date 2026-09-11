import type { MasterVault } from '../../../types';
import type { AdaptiveCalibrationSnapshot } from '../adaptive/types';
import {
  buildD10CandidateEvidenceFromText,
  buildD10CandidateEvidenceFromVault,
} from './candidateEvidence';
import { extractD10Requirements } from './requirementParser';
import { scoreD10FormalRequirements } from './scorer';
import type { D10AuditResult } from './types';

export interface RunD10FormalAuditInput {
  jobDescription: string;
  vault?: MasterVault | Partial<MasterVault> | null;
  candidateText?: string | null;
  /**
   * Epistemiczna kompletność źródła. Dla Vaultu domyślnie 1, dla tekstu
   * wyekstrahowanego z pliku powinna pochodzić z D08 confidence, nie D08 score.
   */
  sourceCompletenessConfidence?: number;
  referenceDateIso: string;
  adaptiveSnapshot?: AdaptiveCalibrationSnapshot | null;
}

export async function runD10FormalAudit(input: RunD10FormalAuditInput): Promise<D10AuditResult> {
  const extraction = await extractD10Requirements(
    input.jobDescription,
    input.adaptiveSnapshot ?? null,
  );

  const hasVault = Boolean(input.vault);
  const candidateEvidence = hasVault
    ? await buildD10CandidateEvidenceFromVault(input.vault!)
    : await buildD10CandidateEvidenceFromText(
      input.candidateText ?? '',
      Math.max(0, Math.min(1, input.sourceCompletenessConfidence ?? 0.75)),
    );

  return scoreD10FormalRequirements({
    extraction,
    candidateEvidence,
    sourceMode: hasVault ? 'VAULT' : 'EXTRACTED_DOCUMENT',
    sourceCompletenessConfidence: hasVault
      ? Math.max(0, Math.min(1, input.sourceCompletenessConfidence ?? 1))
      : Math.max(0, Math.min(1, input.sourceCompletenessConfidence ?? 0.75)),
    referenceDateIso: input.referenceDateIso,
  });
}
