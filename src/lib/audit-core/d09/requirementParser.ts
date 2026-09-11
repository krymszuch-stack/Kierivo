import { buildEvidenceId } from '../hash';
import type { Evidence } from '../contracts';
import { findD09EntitiesInText } from './ontology';
import type {
  D09JobRequirement,
  D09RequirementExtractionResult,
  D09RequirementPriority,
} from './types';

const SCHEMA_VERSION = 'D09.requirements.v1';

const MUST_SECTION = /^(requirements?|wymagania|wymagane|must[- ]?have|minimum qualifications?|kwalifikacje wymagane)\s*:?[\s-]*$/i;
const NICE_SECTION = /^(nice to have|preferred qualifications?|mile widziane|mile widziane umiejętności|dodatkowe atuty|atutem będzie)\s*:?[\s-]*$/i;
const CORE_MARKER = /\b(mandatory|required|must have|must-have|warunek konieczny|bezwzględnie wymagane|konieczne|niezbędne)\b/i;
const MUST_MARKER = /\b(required|requirements?|wymagane|wymagamy|oczekujemy|minimum|co najmniej|must)\b/i;
const NICE_MARKER = /\b(nice to have|preferred|mile widziane|atutem|dodatkowym atutem|plus|bonus)\b/i;
const REQUIREMENT_LIKE_MARKER = /\b(required|must|wymag|oczek|mile widz|preferred|nice to have|minimum|atut|znajomość|knowledge|experience with|doświadczenie z)\b/i;

const priorityRank: Record<D09RequirementPriority, number> = {
  NICE: 1,
  MUST: 2,
  CORE_MUST: 3,
};

const priorityWeight: Record<D09RequirementPriority, number> = {
  NICE: 0.70,
  MUST: 1.00,
  CORE_MUST: 1.50,
};

function cleanLine(line: string): string {
  return line.replace(/^\s*[-•*\d.)]+\s*/, '').trim();
}

function classifyPriority(line: string, section: D09RequirementPriority | null): D09RequirementPriority | null {
  if (NICE_MARKER.test(line)) return 'NICE';
  if (CORE_MARKER.test(line)) return 'CORE_MUST';
  if (MUST_MARKER.test(line)) return 'MUST';
  return section;
}

function extractionConfidence(line: string, priority: D09RequirementPriority | null): number {
  if (CORE_MARKER.test(line)) return 0.97;
  if (NICE_MARKER.test(line)) return 0.94;
  if (MUST_MARKER.test(line)) return 0.92;
  if (priority) return 0.84;
  return 0.60;
}

export async function extractD09Requirements(rawJobDescription: string): Promise<D09RequirementExtractionResult> {
  const text = rawJobDescription.normalize('NFKC').replace(/\r\n?/g, '\n').trim();
  if (!text) {
    return {
      requirements: [],
      parserConfidence: 0,
      evidence: [],
      requirementLikeLines: 0,
      parsedRequirementLines: 0,
    };
  }

  let section: D09RequirementPriority | null = null;
  let requirementLikeLines = 0;
  let parsedRequirementLines = 0;
  const evidence: Evidence[] = [];
  const requirementsByCanonicalId = new Map<string, D09JobRequirement>();

  const lines = text.split('\n').map(cleanLine).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (MUST_SECTION.test(line)) {
      section = 'MUST';
      continue;
    }
    if (NICE_SECTION.test(line)) {
      section = 'NICE';
      continue;
    }

    const priority = classifyPriority(line, section);
    const requirementLike = REQUIREMENT_LIKE_MARKER.test(line) || Boolean(priority);
    if (requirementLike) requirementLikeLines += 1;

    const entities = findD09EntitiesInText(line);
    if (entities.length === 0 || !priority) continue;
    parsedRequirementLines += 1;

    for (const entity of entities) {
      const confidence = extractionConfidence(line, priority);
      const evidenceId = await buildEvidenceId(
        SCHEMA_VERSION,
        'JOB',
        `job.lines[${index}]`,
        { canonicalId: entity.id, priority, kind: entity.kind, line },
        'EXPLICIT_DOCUMENT_FACT',
      );
      const atom: Evidence = {
        id: evidenceId,
        provenance: 'EXPLICIT_DOCUMENT_FACT',
        pointer: { source: 'JOB', jsonPath: `job.lines[${index}]` },
        description: `Wykryto wymaganie ${entity.label} jako ${priority}.`,
        redactedSnippet: line.slice(0, 220),
        normalizedPayload: {
          canonicalId: entity.id,
          priority,
          kind: entity.kind,
          parserConfidence: confidence,
        },
        extractionConfidence: confidence,
        correlationKey: `D09:JOB_REQ:${entity.id}`,
        evidenceImportance: priorityWeight[priority],
        signalFamily: entity.kind === 'FORMAL_REFERENCE' ? 'FORMAL_REQUIREMENT' : 'SKILL_PRESENCE',
      };
      evidence.push(atom);

      const candidate: D09JobRequirement = {
        id: `REQ_D09_${entity.id}`,
        label: entity.label,
        canonicalId: entity.id,
        kind: entity.kind,
        priority,
        weight: priorityWeight[priority],
        sourceText: line,
        extractionConfidence: confidence,
        evidenceIds: [evidenceId],
      };

      const current = requirementsByCanonicalId.get(entity.id);
      if (!current) {
        requirementsByCanonicalId.set(entity.id, candidate);
      } else {
        const stronger = priorityRank[candidate.priority] > priorityRank[current.priority] ? candidate : current;
        requirementsByCanonicalId.set(entity.id, {
          ...stronger,
          extractionConfidence: Math.max(current.extractionConfidence, candidate.extractionConfidence),
          evidenceIds: [...new Set([...current.evidenceIds, ...candidate.evidenceIds])],
          sourceText: current.sourceText === candidate.sourceText
            ? current.sourceText
            : `${current.sourceText} | ${candidate.sourceText}`,
        });
      }
    }
  }

  const coverage = requirementLikeLines > 0
    ? Math.min(1, parsedRequirementLines / requirementLikeLines)
    : 0;
  const meanRequirementConfidence = requirementsByCanonicalId.size > 0
    ? [...requirementsByCanonicalId.values()].reduce((sum, item) => sum + item.extractionConfidence, 0) /
      requirementsByCanonicalId.size
    : 0;
  const parserConfidence = requirementsByCanonicalId.size > 0
    ? Math.min(1, 0.65 * meanRequirementConfidence + 0.35 * coverage)
    : 0;

  return {
    requirements: [...requirementsByCanonicalId.values()],
    parserConfidence,
    evidence,
    requirementLikeLines,
    parsedRequirementLines,
  };
}
