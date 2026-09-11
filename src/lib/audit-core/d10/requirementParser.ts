import type { AdaptiveCalibrationSnapshot } from '../adaptive/types';
import { evaluateAdaptiveRuntimeSignal, boundedAdaptiveAdjustment } from '../adaptive/runtime';
import type { Evidence } from '../contracts';
import { buildEvidenceId } from '../hash';
import { detectD10Entities } from './detectors';
import { buildD10RequirementGroupsForLine } from './relations';
import { segmentD10FormalLine } from './segmentation';
import { normalizeFormalTerm } from './taxonomy';
import type {
  D10FormalRequirement,
  D10RequirementExtractionResult,
  D10RequirementGroup,
  D10RequirementPriority,
} from './types';

const SCHEMA_VERSION = 'D10.formal-requirements.v2';

const MUST_SECTION = /^(requirements?|wymagania|wymagane|kwalifikacje wymagane|minimum qualifications?)\s*:?[\s-]*$/i;
const PREFERRED_SECTION = /^(preferred qualifications?|mile widziane|atutem bedzie|dodatkowe atuty|nice to have)\s*:?[\s-]*$/i;
const NEUTRAL_SECTION = /^(responsibilities|obowiazki|zakres obowiazkow|oferujemy|benefits|about us|o nas|opis stanowiska|what we offer)\s*:?[\s-]*$/i;

const CORE_MARKER = /\b(mandatory|required by law|must have|must-have|warunek konieczny|bezwzglednie wymagane|konieczne|niezbedne)\b/i;
const MUST_MARKER = /\b(required|wymagane|wymagamy|minimum|co najmniej|must|oczekujemy)\b/i;
const PREFERRED_MARKER = /\b(preferred|mile widziane|atutem|nice to have|dodatkowym atutem|plus)\b/i;
const FORMAL_HINT = /\b(certyfikat|certyfikaty|certification|certificate|certified|uprawnienia|licencja|license|licence|prawo jazdy|jezyk|language|english|angielski|german|niemiecki|wyksztalcenie|education|degree|bachelor|master|magister|inzynier|security clearance|poswiadczenie bezpieczenstwa|work authorization|prawo do pracy|sep\b|ccna|pmp|prince2|itil|az-900|aws certified)/i;

const priorityRank: Record<D10RequirementPriority, number> = {
  PREFERRED: 1,
  MUST: 2,
  CORE_MUST: 3,
};

const priorityWeight: Record<D10RequirementPriority, number> = {
  PREFERRED: 0.5,
  MUST: 1,
  CORE_MUST: 1.5,
};

function cleanLine(line: string): string {
  return line.replace(/^\s*[-•*\d.)]+\s*/, '').trim();
}

function priorityForLine(line: string, section: D10RequirementPriority | null): D10RequirementPriority | null {
  const normalized = normalizeFormalTerm(line);
  if (PREFERRED_MARKER.test(normalized)) return 'PREFERRED';
  if (CORE_MARKER.test(normalized)) return 'CORE_MUST';
  if (MUST_MARKER.test(normalized)) return 'MUST';
  return section;
}

function baseExtractionConfidence(line: string, priority: D10RequirementPriority): number {
  const normalized = normalizeFormalTerm(line);
  if (CORE_MARKER.test(normalized)) return 0.98;
  if (PREFERRED_MARKER.test(normalized)) return 0.94;
  if (MUST_MARKER.test(normalized)) return 0.93;
  if (priority === 'PREFERRED') return 0.86;
  return 0.84;
}

function mergeRequirement(
  current: D10FormalRequirement | undefined,
  candidate: D10FormalRequirement,
): D10FormalRequirement {
  if (!current) return candidate;
  const stronger = priorityRank[candidate.priority] > priorityRank[current.priority]
    ? candidate
    : current;
  return {
    ...stronger,
    extractionConfidence: Math.max(current.extractionConfidence, candidate.extractionConfidence),
    evidenceIds: [...new Set([...current.evidenceIds, ...candidate.evidenceIds])],
    sourceText: current.sourceText === candidate.sourceText
      ? current.sourceText
      : `${current.sourceText} | ${candidate.sourceText}`,
  };
}

export async function extractD10Requirements(
  rawJobDescription: string,
  adaptiveSnapshot: AdaptiveCalibrationSnapshot | null = null,
): Promise<D10RequirementExtractionResult> {
  const text = rawJobDescription.normalize('NFKC').replace(/\r\n?/g, '\n').trim();
  const adaptiveSignal = evaluateAdaptiveRuntimeSignal(
    adaptiveSnapshot,
    'MOD_FORMAL_REQUIREMENTS',
    text,
  );

  if (!text) {
    return {
      requirements: [],
      groups: [],
      parserConfidence: 0,
      evidence: [],
      requirementLikeLines: 0,
      parsedRequirementLines: 0,
      adaptiveSignal,
    };
  }

  let section: D10RequirementPriority | null = null;
  let requirementLikeLines = 0;
  let parsedRequirementLines = 0;
  const evidence: Evidence[] = [];
  const requirements = new Map<string, D10FormalRequirement>();
  const groups: D10RequirementGroup[] = [];
  const groupedRequirementIds = new Set<string>();
  const lines = text.split('\n').map(cleanLine).filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalizeFormalTerm(line);
    if (MUST_SECTION.test(normalizedLine)) {
      section = 'MUST';
      continue;
    }
    if (PREFERRED_SECTION.test(normalizedLine)) {
      section = 'PREFERRED';
      continue;
    }
    if (NEUTRAL_SECTION.test(normalizedLine)) {
      section = null;
      continue;
    }

    const priority = priorityForLine(normalizedLine, section);
    const looksFormal = FORMAL_HINT.test(normalizedLine);
    if (looksFormal && priority) requirementLikeLines += 1;
    if (!priority || !looksFormal) continue;

    const segments = segmentD10FormalLine(line);
    const relationSeeds: Parameters<typeof buildD10RequirementGroupsForLine>[2][number][] = [];
    let entitiesOnLine = 0;

    for (const segment of segments) {
      const detected = detectD10Entities(segment);
      for (let entityIndex = 0; entityIndex < detected.length; entityIndex += 1) {
        const entity = detected[entityIndex];
        entitiesOnLine += 1;
        const adaptiveDelta = boundedAdaptiveAdjustment(adaptiveSignal);
        const confidence = Math.max(0, Math.min(1,
          baseExtractionConfidence(normalizedLine, priority) + adaptiveDelta,
        ));
        const requirementId = `REQ_D10_${entity.canonicalId}`;
        const evidenceId = await buildEvidenceId(
          SCHEMA_VERSION,
          'JOB',
          `job.lines[${index}]`,
          {
            canonicalId: entity.canonicalId,
            kind: entity.kind,
            priority,
            line,
            charStart: entity.sourceSpan.start,
            charEnd: entity.sourceSpan.end,
          },
          'EXPLICIT_DOCUMENT_FACT',
        );
        const atom: Evidence = {
          id: evidenceId,
          provenance: 'EXPLICIT_DOCUMENT_FACT',
          pointer: {
            source: 'JOB',
            jsonPath: `job.lines[${index}]`,
            charStart: entity.sourceSpan.start,
            charEnd: entity.sourceSpan.end,
          },
          description: `Wykryto formalny wymóg ${entity.label} jako ${priority}.`,
          redactedSnippet: line.slice(entity.sourceSpan.start, entity.sourceSpan.end).slice(0, 220),
          normalizedPayload: {
            canonicalId: entity.canonicalId,
            kind: entity.kind,
            priority,
            parserConfidence: confidence,
            adaptiveSnapshot: adaptiveSignal.snapshotVersion,
          },
          extractionConfidence: confidence,
          correlationKey: `D10:REQ:${entity.canonicalId}`,
          evidenceImportance: priorityWeight[priority],
          signalFamily: 'FORMAL_REQUIREMENT',
        };
        evidence.push(atom);

        const candidate: D10FormalRequirement = {
          id: requirementId,
          kind: entity.kind,
          priority,
          label: entity.label,
          canonicalId: entity.canonicalId,
          sourceText: line,
          sourceSpan: entity.sourceSpan,
          extractionConfidence: confidence,
          weight: priorityWeight[priority],
          evidenceIds: [evidenceId],
          languageLevel: entity.languageLevel,
          educationLevel: entity.educationLevel,
          fieldConstraint: entity.fieldConstraint,
          validityRequired: entity.validityRequired,
        };
        requirements.set(entity.canonicalId, mergeRequirement(requirements.get(entity.canonicalId), candidate));

        relationSeeds.push({
          requirementId,
          canonicalId: entity.canonicalId,
          priority,
          extractionConfidence: confidence,
          evidenceIds: [evidenceId],
          connectorBefore: entityIndex === 0 ? segment.connectorBefore : 'SEPARATOR',
          sourceStart: entity.sourceSpan.start,
        });
      }
    }

    if (entitiesOnLine === 0) continue;
    parsedRequirementLines += 1;

    const lineGroups = buildD10RequirementGroupsForLine(index, line, relationSeeds);
    for (const group of lineGroups) {
      // Nie dopuszczamy nakładających się grup logicznych. Jeśli ten sam atom
      // występuje w kilku konstrukcjach, zachowujemy pierwszą jednoznaczną relację.
      if (group.memberRequirementIds.some((id) => groupedRequirementIds.has(id))) continue;
      groups.push(group);
      group.memberRequirementIds.forEach((id) => groupedRequirementIds.add(id));
    }
  }

  const groupByRequirementId = new Map<string, D10RequirementGroup>();
  for (const group of groups) {
    for (const memberId of group.memberRequirementIds) groupByRequirementId.set(memberId, group);
  }

  const list = [...requirements.values()].map((requirement) => {
    const group = groupByRequirementId.get(requirement.id);
    return group
      ? { ...requirement, groupId: group.id, groupOperator: group.operator }
      : requirement;
  });
  const coverage = requirementLikeLines > 0
    ? Math.min(1, parsedRequirementLines / requirementLikeLines)
    : list.length > 0 ? 1 : 0;
  const meanConfidence = list.length > 0
    ? list.reduce((sum, item) => sum + item.extractionConfidence, 0) / list.length
    : 0;

  return {
    requirements: list,
    groups,
    parserConfidence: list.length > 0 ? 0.7 * meanConfidence + 0.3 * coverage : 0,
    evidence,
    requirementLikeLines,
    parsedRequirementLines,
    adaptiveSignal,
  };
}
