import type { D10SegmentConnector } from './segmentation';
import type {
  D10RequirementGroup,
  D10RequirementGroupOperator,
  D10RequirementPriority,
} from './types';

export interface D10RequirementRelationSeed {
  requirementId: string;
  canonicalId: string;
  priority: D10RequirementPriority;
  extractionConfidence: number;
  evidenceIds: string[];
  connectorBefore: D10SegmentConnector;
  sourceStart: number;
}

const PRIORITY_RANK: Record<D10RequirementPriority, number> = {
  PREFERRED: 1,
  MUST: 2,
  CORE_MUST: 3,
};

function strongestPriority(seeds: readonly D10RequirementRelationSeed[]): D10RequirementPriority {
  return seeds.reduce(
    (best, item) => PRIORITY_RANK[item.priority] > PRIORITY_RANK[best] ? item.priority : best,
    'PREFERRED' as D10RequirementPriority,
  );
}

function makeGroup(
  lineIndex: number,
  counter: number,
  operator: D10RequirementGroupOperator,
  sourceText: string,
  members: readonly D10RequirementRelationSeed[],
): D10RequirementGroup {
  return {
    id: `GRP_D10_L${lineIndex}_${operator}_${counter}`,
    operator,
    priority: strongestPriority(members),
    memberRequirementIds: members.map((item) => item.requirementId),
    memberCanonicalIds: members.map((item) => item.canonicalId),
    sourceText,
    extractionConfidence: Math.min(...members.map((item) => item.extractionConfidence)),
    evidenceIds: [...new Set(members.flatMap((item) => item.evidenceIds))],
  };
}

/**
 * Buduje relacje logiczne bez zgadywania mieszanych wyrażeń.
 *
 * - A lub B → ANY_OF(A,B)
 * - A i B → ALL_OF(A,B)
 * - A lub B oraz C → ANY_OF(A,B), C pozostaje niezależnym MUST
 * - przecinek/średnik nie tworzy grupy logicznej
 */
export function buildD10RequirementGroupsForLine(
  lineIndex: number,
  sourceText: string,
  input: readonly D10RequirementRelationSeed[],
): D10RequirementGroup[] {
  const seeds = [...input].sort((a, b) => a.sourceStart - b.sourceStart);
  if (seeds.length < 2) return [];

  const groups: D10RequirementGroup[] = [];
  let counter = 0;
  const claimed = new Set<string>();

  // ANY_OF ma pierwszeństwo, dzięki czemu "A lub B oraz C" staje się
  // alternatywą A/B oraz niezależnym wymaganiem C.
  let index = 1;
  while (index < seeds.length) {
    if (seeds[index].connectorBefore !== 'ANY_OF') {
      index += 1;
      continue;
    }
    let start = index - 1;
    let end = index;
    while (end + 1 < seeds.length && seeds[end + 1].connectorBefore === 'ANY_OF') end += 1;
    const members = seeds.slice(start, end + 1);
    counter += 1;
    const group = makeGroup(lineIndex, counter, 'ANY_OF', sourceText, members);
    groups.push(group);
    members.forEach((member) => claimed.add(member.requirementId));
    index = end + 1;
  }

  // ALL_OF tworzymy tylko dla nieprzejętych, bezpośrednio połączonych członów.
  index = 1;
  while (index < seeds.length) {
    const current = seeds[index];
    const previous = seeds[index - 1];
    if (current.connectorBefore !== 'ALL_OF' || claimed.has(current.requirementId) || claimed.has(previous.requirementId)) {
      index += 1;
      continue;
    }
    let start = index - 1;
    let end = index;
    while (
      end + 1 < seeds.length &&
      seeds[end + 1].connectorBefore === 'ALL_OF' &&
      !claimed.has(seeds[end + 1].requirementId)
    ) {
      end += 1;
    }
    const members = seeds.slice(start, end + 1);
    counter += 1;
    const group = makeGroup(lineIndex, counter, 'ALL_OF', sourceText, members);
    groups.push(group);
    members.forEach((member) => claimed.add(member.requirementId));
    index = end + 1;
  }

  return groups;
}
