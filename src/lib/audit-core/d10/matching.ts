import {
  CEFR_RANK,
  EDUCATION_RANK,
  drivingCategoryFulfillment,
  fieldSimilarity,
  ordinalThresholdFulfillment,
} from './taxonomy';
import type {
  D10CandidateEvidence,
  D10FormalRequirement,
  D10RequirementMatch,
} from './types';

function parseIsoDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

function bestByFulfillment(
  candidates: Array<{ evidence: D10CandidateEvidence; fulfillment: number; explanation: string; unknown?: boolean }>,
): D10RequirementMatch | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    if (a.unknown !== b.unknown) return a.unknown ? 1 : -1;
    if (b.fulfillment !== a.fulfillment) return b.fulfillment - a.fulfillment;
    return b.evidence.extractionConfidence - a.evidence.extractionConfidence;
  });
  const best = sorted[0];
  return {
    requirement: null as never,
    status: best.unknown
      ? 'UNKNOWN'
      : best.fulfillment >= 0.999
        ? 'CONFIRMED'
        : best.fulfillment > 0
          ? 'PARTIAL'
          : 'NOT_FOUND',
    fulfillment: best.fulfillment,
    bestEvidenceId: best.evidence.evidence.id,
    bestEvidenceLabel: best.evidence.label,
    explanation: best.explanation,
  };
}

export function matchD10Requirement(
  requirement: D10FormalRequirement,
  candidateEvidence: readonly D10CandidateEvidence[],
  sourceCompletenessConfidence: number,
  referenceDateIso: string,
): D10RequirementMatch {
  const compatible = candidateEvidence.filter((item) => {
    if (requirement.kind === 'LICENSE') return item.kind === 'LICENSE';
    if (requirement.kind === 'CERTIFICATION') return item.kind === 'CERTIFICATION';
    if (requirement.kind === 'DRIVING_LICENSE') return item.kind === 'DRIVING_LICENSE';
    return item.kind === requirement.kind;
  });

  const evaluations: Array<{
    evidence: D10CandidateEvidence;
    fulfillment: number;
    explanation: string;
    unknown?: boolean;
  }> = [];

  for (const evidence of compatible) {
    if (requirement.kind === 'LANGUAGE') {
      if (evidence.canonicalId !== requirement.canonicalId) continue;
      if (!requirement.languageLevel) {
        evaluations.push({ evidence, fulfillment: 1, explanation: 'Język obecny; JD nie określa minimalnego CEFR.' });
        continue;
      }
      if (!evidence.languageLevel) {
        evaluations.push({ evidence, fulfillment: 0, unknown: true, explanation: 'Język wykryty, ale brak wiarygodnego poziomu CEFR.' });
        continue;
      }
      const fulfillment = ordinalThresholdFulfillment(
        CEFR_RANK[evidence.languageLevel],
        CEFR_RANK[requirement.languageLevel],
      );
      evaluations.push({
        evidence,
        fulfillment,
        explanation: fulfillment >= 1
          ? `${evidence.languageLevel} spełnia minimum ${requirement.languageLevel}.`
          : `${evidence.languageLevel} jest poniżej wymaganego ${requirement.languageLevel}.`,
      });
      continue;
    }

    if (requirement.kind === 'EDUCATION') {
      if (!requirement.educationLevel || !evidence.educationLevel) continue;
      const levelFulfillment = ordinalThresholdFulfillment(
        EDUCATION_RANK[evidence.educationLevel],
        EDUCATION_RANK[requirement.educationLevel],
      );
      let fulfillment = levelFulfillment;
      let explanation = `${evidence.educationLevel} vs wymagane ${requirement.educationLevel}.`;
      if (requirement.fieldConstraint) {
        if (!evidence.fieldOfStudy) {
          evaluations.push({
            evidence,
            fulfillment: 0,
            unknown: true,
            explanation: 'Poziom edukacji wykryty, ale brak danych o wymaganym kierunku.',
          });
          continue;
        }
        const similarity = fieldSimilarity(evidence.fieldOfStudy, requirement.fieldConstraint);
        if (similarity < 0.2) fulfillment = 0;
        else if (similarity < 0.5) fulfillment *= 0.5;
        explanation += ` Podobieństwo kierunku: ${similarity.toFixed(2)}.`;
      }
      evaluations.push({ evidence, fulfillment, explanation });
      continue;
    }

    if (requirement.kind === 'DRIVING_LICENSE') {
      const required = requirement.canonicalId.replace('driving.', '').toUpperCase();
      const candidate = evidence.canonicalId.replace('driving.', '').toUpperCase();
      const fulfillment = drivingCategoryFulfillment(candidate, required);
      evaluations.push({
        evidence,
        fulfillment,
        explanation: fulfillment > 0
          ? `Kategoria ${candidate} spełnia wymaganie ${required}.`
          : `Kategoria ${candidate} nie spełnia wymagania ${required}.`,
      });
      continue;
    }

    if (evidence.canonicalId !== requirement.canonicalId) continue;

    if (requirement.issuerConstraint) {
      if (!evidence.issuer) {
        evaluations.push({
          evidence,
          fulfillment: 0,
          unknown: true,
          explanation: 'Nazwa dokumentu pasuje, ale brak danych o wymaganym issuerze.',
        });
        continue;
      }
      const issuerOk = evidence.issuer.toLocaleLowerCase().includes(requirement.issuerConstraint.toLocaleLowerCase());
      if (!issuerOk) {
        evaluations.push({ evidence, fulfillment: 0, explanation: 'Dokument ma innego issuera niż wymagany.' });
        continue;
      }
    }

    if (requirement.validityRequired) {
      if (!evidence.validUntil) {
        evaluations.push({
          evidence,
          fulfillment: 0,
          unknown: true,
          explanation: 'Dokument pasuje nazwą, ale nie ma danych o terminie ważności.',
        });
        continue;
      }
      const expiry = parseIsoDate(evidence.validUntil);
      const reference = parseIsoDate(referenceDateIso);
      if (expiry === null || reference === null) {
        evaluations.push({
          evidence,
          fulfillment: 0,
          unknown: true,
          explanation: 'Nie da się deterministycznie zweryfikować ważności dokumentu.',
        });
        continue;
      }
      if (expiry < reference) {
        evaluations.push({ evidence, fulfillment: 0, explanation: 'Dokument wygasł przed datą referencyjną audytu.' });
        continue;
      }
    }

    evaluations.push({ evidence, fulfillment: 1, explanation: 'Jednoznaczne dopasowanie formalnego wymogu.' });
  }

  const best = bestByFulfillment(evaluations);
  if (best) return { ...best, requirement };

  if (sourceCompletenessConfidence < 0.75) {
    return {
      requirement,
      status: 'UNKNOWN',
      fulfillment: 0,
      bestEvidenceId: null,
      bestEvidenceLabel: null,
      explanation: 'Brak dowodu przy zbyt niskiej kompletności źródła; nie wolno utożsamiać tego z brakiem kwalifikacji.',
    };
  }

  return {
    requirement,
    status: 'NOT_FOUND',
    fulfillment: 0,
    bestEvidenceId: null,
    bestEvidenceLabel: null,
    explanation: 'W wiarygodnym źródle nie znaleziono dowodu spełnienia wymogu.',
  };
}
