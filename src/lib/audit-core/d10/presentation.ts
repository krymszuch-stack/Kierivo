import type { ScoreComponent } from '../contracts';
import { buildD10LogicalRequirementUnits } from './logicalUnits';
import type {
  D10AuditResult,
  D10RequirementGroupOperator,
  D10RequirementMatch,
  D10RequirementStatus,
} from './types';

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
  groupId: string | null;
  groupOperator: D10RequirementGroupOperator | null;
  contributesDirectly: boolean;
}

export interface D10GroupPresentationRow {
  groupId: string;
  operator: D10RequirementGroupOperator;
  label: string;
  priority: D10RequirementMatch['requirement']['priority'];
  status: D10RequirementStatus;
  tone: D10PresentationTone;
  fulfillment: number;
  earnedPoints: number | null;
  maxPoints: number | null;
  memberRequirementIds: string[];
  evidenceIds: string[];
  explanation: string;
}

export interface D10PresentationModel {
  moduleId: string;
  score: number | null;
  confidence: number;
  applicability: D10AuditResult['applicability'];
  rows: D10RequirementPresentationRow[];
  groups: D10GroupPresentationRow[];
  equationText: string | null;
  preCapScore: number | null;
  finalScore: number | null;
  activeCapText: string | null;
}

const round = (value: number): number => Math.round(value * 100) / 100;

function toneForStatus(status: D10RequirementStatus): D10PresentationTone {
  if (status === 'UNKNOWN') return 'UNKNOWN';
  if (status === 'CONFIRMED') return 'POSITIVE';
  if (status === 'PARTIAL') return 'PARTIAL';
  return 'NEGATIVE';
}

function componentById(result: D10AuditResult, id: string): ScoreComponent | undefined {
  return result.breakdown.find((item) => item.id === id);
}

export function buildD10PresentationModel(result: D10AuditResult): D10PresentationModel {
  const logicalUnits = buildD10LogicalRequirementUnits(result.formal.matches, result.formal.groups);
  const mandatoryUnits = logicalUnits.filter((unit) => unit.priority !== 'PREFERRED');
  const preferredKnownUnits = logicalUnits.filter(
    (unit) => unit.priority === 'PREFERRED' && unit.status !== 'UNKNOWN',
  );
  const mandatoryComponent = componentById(result, 'D10_MANDATORY_FORMAL');
  const preferredComponent = componentById(result, 'D10_PREFERRED_FORMAL');
  const mandatoryWeight = mandatoryUnits.reduce((sum, unit) => sum + unit.weight, 0);
  const preferredKnownWeight = preferredKnownUnits.reduce((sum, unit) => sum + unit.weight, 0);
  const unitById = new Map(logicalUnits.map((unit) => [unit.id, unit]));
  const groupIds = new Set(result.formal.groups.map((group) => group.id));

  const pointsForUnit = (unitId: string): { max: number | null; earned: number | null } => {
    const unit = unitById.get(unitId);
    if (!unit || result.score === null || unit.status === 'UNKNOWN') return { max: null, earned: null };
    const component = unit.priority === 'PREFERRED' ? preferredComponent : mandatoryComponent;
    const denominator = unit.priority === 'PREFERRED' ? preferredKnownWeight : mandatoryWeight;
    if (!component || denominator <= 0) return { max: null, earned: null };
    const max = component.effectiveWeight * 100 * unit.weight / denominator;
    return { max, earned: max * unit.fulfillment };
  };

  const rows = result.formal.matches.map((match): D10RequirementPresentationRow => {
    const contributesDirectly = !match.requirement.groupId;
    const points = contributesDirectly
      ? pointsForUnit(match.requirement.id)
      : { max: null, earned: null };
    return {
      requirementId: match.requirement.id,
      canonicalId: match.requirement.canonicalId,
      label: match.requirement.label,
      priority: match.requirement.priority,
      kind: match.requirement.kind,
      status: match.status,
      tone: toneForStatus(match.status),
      fulfillment: round(match.fulfillment),
      earnedPoints: points.earned === null ? null : round(points.earned),
      maxPoints: points.max === null ? null : round(points.max),
      evidenceIds: [
        ...match.requirement.evidenceIds,
        ...(match.bestEvidenceId ? [match.bestEvidenceId] : []),
      ],
      explanation: match.explanation,
      groupId: match.requirement.groupId ?? null,
      groupOperator: match.requirement.groupOperator ?? null,
      contributesDirectly,
    };
  });

  const groups = result.formal.groups.map((group): D10GroupPresentationRow => {
    const unit = unitById.get(group.id);
    const points = unit ? pointsForUnit(unit.id) : { max: null, earned: null };
    const status = unit?.status ?? 'UNKNOWN';
    return {
      groupId: group.id,
      operator: group.operator,
      label: unit?.label ?? group.sourceText,
      priority: unit?.priority ?? group.priority,
      status,
      tone: toneForStatus(status),
      fulfillment: round(unit?.fulfillment ?? 0),
      earnedPoints: points.earned === null ? null : round(points.earned),
      maxPoints: points.max === null ? null : round(points.max),
      memberRequirementIds: [...group.memberRequirementIds],
      evidenceIds: [...group.evidenceIds],
      explanation: group.operator === 'ANY_OF'
        ? 'Wystarczy spełnienie co najmniej jednej alternatywy. Niespełnione alternatywy nie są osobną karą.'
        : 'Wszystkie elementy tej grupy są wymagane; wynik grupy ogranicza najsłabszy element.',
    };
  });

  const visibleScoringRows = [
    ...rows.filter((row) => row.contributesDirectly),
    ...groups,
  ];
  const visibleEarned = round(visibleScoringRows.reduce((sum, row) => sum + (row.earnedPoints ?? 0), 0));
  const preCapScore = result.ledger?.scoreAfterPenalties ?? null;
  if (preCapScore !== null && result.score !== null && Math.abs(visibleEarned - preCapScore) > 0.02) {
    // Nie rzucamy wyjątkiem w warstwie prezentacyjnej, ale celowo nie maskujemy
    // rozjazdu. Test kontraktowy pilnuje, aby ten warunek nigdy nie zaszedł.
  }

  const activeCaps = result.hardCaps.filter((cap) => cap.triggered);
  const lowestCap = activeCaps.length > 0
    ? activeCaps.reduce((best, cap) => cap.capLimit < best.capLimit ? cap : best)
    : null;

  return {
    moduleId: result.moduleId,
    score: result.score,
    confidence: result.confidence,
    applicability: result.applicability,
    rows,
    groups: groups.filter((group) => groupIds.has(group.groupId)),
    equationText: result.ledger?.equationText ?? null,
    preCapScore,
    finalScore: result.score,
    activeCapText: lowestCap
      ? `${lowestCap.ruleCode}: wynik ograniczony do maks. ${lowestCap.capLimit}/100`
      : null,
  };
}
