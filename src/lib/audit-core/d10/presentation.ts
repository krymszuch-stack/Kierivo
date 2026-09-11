import type { ScoreComponent } from '../contracts';
import type { D10AuditResult, D10RequirementMatch } from './types';

export type D10PresentationTone = 'POSITIVE' | 'PARTIAL' | 'NEGATIVE' | 'UNKNOWN';

export interface D10RequirementPresentationRow {
  requirementId: string;
  canonicalId: string;
  label: string;
  priority: D10RequirementMatch['requirement']['priority'];
  kind: D10RequirementMatch['requirement']['kind'];
  status: D10RequirementMatch['status'];
  tone: D10PresentationTone;
  fulfillment: number;
  earnedPoints: number | null;
  maxPoints: number | null;
  evidenceIds: string[];
  explanation: string;
}

export interface D10PresentationModel {
  moduleId: string;
  score: number | null;
  confidence: number;
  applicability: D10AuditResult['applicability'];
  rows: D10RequirementPresentationRow[];
  equationText: string | null;
  preCapScore: number | null;
  finalScore: number | null;
  activeCapText: string | null;
}

const round = (value: number): number => Math.round(value * 100) / 100;

function toneFor(match: D10RequirementMatch): D10PresentationTone {
  if (match.status === 'UNKNOWN') return 'UNKNOWN';
  if (match.status === 'CONFIRMED') return 'POSITIVE';
  if (match.status === 'PARTIAL') return 'PARTIAL';
  return 'NEGATIVE';
}

function componentById(result: D10AuditResult, id: string): ScoreComponent | undefined {
  return result.breakdown.find((item) => item.id === id);
}

export function buildD10PresentationModel(result: D10AuditResult): D10PresentationModel {
  const mandatory = result.formal.matches.filter((match) => match.requirement.priority !== 'PREFERRED');
  const preferredKnown = result.formal.matches.filter(
    (match) => match.requirement.priority === 'PREFERRED' && match.status !== 'UNKNOWN',
  );
  const mandatoryComponent = componentById(result, 'D10_MANDATORY_FORMAL');
  const preferredComponent = componentById(result, 'D10_PREFERRED_FORMAL');
  const mandatoryWeight = mandatory.reduce((sum, match) => sum + match.requirement.weight, 0);
  const preferredKnownWeight = preferredKnown.reduce((sum, match) => sum + match.requirement.weight, 0);

  const rows = result.formal.matches.map((match): D10RequirementPresentationRow => {
    let maxPoints: number | null = null;
    if (result.score !== null && match.status !== 'UNKNOWN') {
      if (match.requirement.priority === 'PREFERRED' && preferredComponent && preferredKnownWeight > 0) {
        maxPoints = preferredComponent.effectiveWeight * 100 * match.requirement.weight / preferredKnownWeight;
      } else if (match.requirement.priority !== 'PREFERRED' && mandatoryComponent && mandatoryWeight > 0) {
        maxPoints = mandatoryComponent.effectiveWeight * 100 * match.requirement.weight / mandatoryWeight;
      }
    }
    const earnedPoints = maxPoints === null ? null : maxPoints * match.fulfillment;
    return {
      requirementId: match.requirement.id,
      canonicalId: match.requirement.canonicalId,
      label: match.requirement.label,
      priority: match.requirement.priority,
      kind: match.requirement.kind,
      status: match.status,
      tone: toneFor(match),
      fulfillment: round(match.fulfillment),
      earnedPoints: earnedPoints === null ? null : round(earnedPoints),
      maxPoints: maxPoints === null ? null : round(maxPoints),
      evidenceIds: [
        ...match.requirement.evidenceIds,
        ...(match.bestEvidenceId ? [match.bestEvidenceId] : []),
      ],
      explanation: match.explanation,
    };
  });

  const activeCaps = result.hardCaps.filter((cap) => cap.triggered);
  const lowestCap = activeCaps.length > 0
    ? activeCaps.reduce((best, cap) => cap.capLimit < best.capLimit ? cap : best)
    : null;
  const preCapScore = result.ledger?.afterPenalties ?? null;

  return {
    moduleId: result.moduleId,
    score: result.score,
    confidence: result.confidence,
    applicability: result.applicability,
    rows,
    equationText: result.ledger?.equationText ?? null,
    preCapScore,
    finalScore: result.score,
    activeCapText: lowestCap
      ? `${lowestCap.ruleCode}: wynik ograniczony do maks. ${lowestCap.capLimit}/100`
      : null,
  };
}
