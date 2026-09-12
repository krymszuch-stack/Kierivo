import type { D09CandidateEvidence, D09ScoringInput } from './types';
import {
  D09_CONFIG,
  D09_MODULE_ID,
  D09_MODULE_NAME,
  scoreD09JobAlignment as scoreD09JobAlignmentCore,
} from './scorerCore';

export { D09_CONFIG, D09_MODULE_ID, D09_MODULE_NAME };

/**
 * scorerCore v1 modeluje evidence depth z minimalnym floor. Ten adapter
 * utrzymuje osobno siłę twierdzenia semantycznego (`claimStrength`).
 * Dzięki temu heurystyczne/NLI evidence nie dostaje pełnej wartości tylko
 * dlatego, że zostało zmapowane do prawidłowej encji kanonicznej.
 */
function applyClaimStrength(candidate: D09CandidateEvidence): D09CandidateEvidence | null {
  const claimStrength = Math.min(1, Math.max(0, candidate.claimStrength));
  if (claimStrength >= 1 - 1e-9) return candidate;

  const floor = D09_CONFIG.depthFloor;
  const explicitDepthStrength = floor + (1 - floor) * Math.min(1, Math.max(0, candidate.evidenceDepth));
  const desiredStrength = claimStrength * explicitDepthStrength;

  // scorerCore nie reprezentuje match strength poniżej depthFloor. Taki
  // inference jest zbyt słaby, aby punktować. Pozostaje w warstwie evidence
  // diagnostycznego, ale nie wchodzi do fulfillment.
  if (desiredStrength < floor) return null;

  const effectiveDepth = Math.min(1, Math.max(0, (desiredStrength - floor) / (1 - floor)));
  return {
    ...candidate,
    evidenceDepth: effectiveDepth,
  };
}

export function scoreD09JobAlignment(input: D09ScoringInput) {
  const candidateEvidence = input.candidateEvidence
    .map(applyClaimStrength)
    .filter((item): item is D09CandidateEvidence => item !== null);
  return scoreD09JobAlignmentCore({ ...input, candidateEvidence });
}
