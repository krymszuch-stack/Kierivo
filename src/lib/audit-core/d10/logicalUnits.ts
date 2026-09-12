import type {
  D10RequirementGroup,
  D10RequirementMatch,
  D10RequirementPriority,
  D10RequirementStatus,
} from './types';

export type D10LogicalOperator = 'SINGLE' | 'ANY_OF' | 'ALL_OF';

export interface D10LogicalRequirementUnit {
  id: string;
  operator: D10LogicalOperator;
  priority: D10RequirementPriority;
  weight: number;
  fulfillment: number;
  status: D10RequirementStatus;
  label: string;
  evidenceIds: string[];
  memberMatches: D10RequirementMatch[];
}

function anyOfStatus(matches: readonly D10RequirementMatch[]): { status: D10RequirementStatus; fulfillment: number } {
  const known = matches.filter((match) => match.status !== 'UNKNOWN');
  const best = known.reduce((max, match) => Math.max(max, match.fulfillment), 0);
  if (best >= 0.999) return { status: 'CONFIRMED', fulfillment: best };
  if (best > 0) return { status: 'PARTIAL', fulfillment: best };
  if (matches.some((match) => match.status === 'UNKNOWN')) return { status: 'UNKNOWN', fulfillment: 0 };
  return { status: 'NOT_FOUND', fulfillment: 0 };
}

function allOfStatus(matches: readonly D10RequirementMatch[]): { status: D10RequirementStatus; fulfillment: number } {
  if (matches.some((match) => match.status === 'NOT_FOUND')) return { status: 'NOT_FOUND', fulfillment: 0 };
  if (matches.some((match) => match.status === 'UNKNOWN')) return { status: 'UNKNOWN', fulfillment: 0 };
  const minimum = matches.reduce((min, match) => Math.min(min, match.fulfillment), 1);
  if (minimum >= 0.999) return { status: 'CONFIRMED', fulfillment: minimum };
  if (minimum > 0) return { status: 'PARTIAL', fulfillment: minimum };
  return { status: 'NOT_FOUND', fulfillment: 0 };
}

function evidenceIds(matches: readonly D10RequirementMatch[]): string[] {
  return [...new Set(matches.flatMap((match) => [
    ...match.requirement.evidenceIds,
    ...(match.bestEvidenceId ? [match.bestEvidenceId] : []),
  ]))];
}

export function buildD10LogicalRequirementUnits(
  matches: readonly D10RequirementMatch[],
  groups: readonly D10RequirementGroup[],
): D10LogicalRequirementUnit[] {
  const byRequirementId = new Map(matches.map((match) => [match.requirement.id, match]));
  const grouped = new Set(groups.flatMap((group) => group.memberRequirementIds));
  const units: D10LogicalRequirementUnit[] = [];

  for (const group of groups) {
    const members = group.memberRequirementIds
      .map((id) => byRequirementId.get(id))
      .filter((match): match is D10RequirementMatch => Boolean(match));
    if (members.length === 0) continue;
    const aggregate = group.operator === 'ANY_OF' ? anyOfStatus(members) : allOfStatus(members);
    units.push({
      id: group.id,
      operator: group.operator,
      priority: group.priority,
      // Alternatywy nie mnożą wagi tylko dlatego, że JD podało kilka ścieżek.
      // ALL_OF reprezentuje kilka niezależnych warunków, więc zachowujemy ich łączną masę.
      weight: group.operator === 'ANY_OF'
        ? Math.max(...members.map((match) => match.requirement.weight))
        : members.reduce((sum, match) => sum + match.requirement.weight, 0),
      fulfillment: aggregate.fulfillment,
      status: aggregate.status,
      label: group.operator === 'ANY_OF'
        ? members.map((match) => match.requirement.label).join(' lub ')
        : members.map((match) => match.requirement.label).join(' i '),
      evidenceIds: evidenceIds(members),
      memberMatches: members,
    });
  }

  for (const match of matches) {
    if (grouped.has(match.requirement.id)) continue;
    units.push({
      id: match.requirement.id,
      operator: 'SINGLE',
      priority: match.requirement.priority,
      weight: match.requirement.weight,
      fulfillment: match.fulfillment,
      status: match.status,
      label: match.requirement.label,
      evidenceIds: evidenceIds([match]),
      memberMatches: [match],
    });
  }

  return units;
}

export function satisfiedAnyOfAlternativeIds(units: readonly D10LogicalRequirementUnit[]): Set<string> {
  const out = new Set<string>();
  for (const unit of units) {
    if (unit.operator !== 'ANY_OF' || unit.status !== 'CONFIRMED') continue;
    for (const match of unit.memberMatches) {
      if (match.status !== 'CONFIRMED') out.add(match.requirement.id);
    }
  }
  return out;
}
