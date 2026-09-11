import type { AdaptiveCalibrationSnapshot } from '../adaptive/types';
import { evaluateAdaptiveRuntimeSignal, boundedAdaptiveAdjustment } from '../adaptive/runtime';
import type { Evidence } from '../contracts';
import { buildEvidenceId } from '../hash';
import {
  canonicalFormalEntity,
  canonicalLanguage,
  normalizeFormalTerm,
  parseCefrLevel,
  parseEducationLevel,
} from './taxonomy';
import type {
  D10FormalRequirement,
  D10FormalRequirementKind,
  D10RequirementExtractionResult,
  D10RequirementPriority,
} from './types';

const SCHEMA_VERSION = 'D10.formal-requirements.v1';

const MUST_SECTION = /^(requirements?|wymagania|wymagane|kwalifikacje wymagane|minimum qualifications?)\s*:?[\s-]*$/i;
const PREFERRED_SECTION = /^(preferred qualifications?|mile widziane|atutem bedzie|dodatkowe atuty|nice to have)\s*:?[\s-]*$/i;
const NEUTRAL_SECTION = /^(responsibilities|obowiazki|zakres obowiazkow|oferujemy|benefits|about us|o nas|opis stanowiska|what we offer)\s*:?[\s-]*$/i;

const CORE_MARKER = /\b(mandatory|required by law|must have|must-have|warunek konieczny|bezwzglednie wymagane|konieczne|niezbedne)\b/i;
const MUST_MARKER = /\b(required|wymagane|wymagamy|minimum|co najmniej|must|oczekujemy)\b/i;
const PREFERRED_MARKER = /\b(preferred|mile widziane|atutem|nice to have|dodatkowym atutem|plus)\b/i;
const FORMAL_HINT = /\b(certyfikat|certification|certificate|uprawnienia|licencja|license|licence|prawo jazdy|jezyk|language|english|angielski|german|niemiecki|wyksztalcenie|education|degree|bachelor|master|magister|inzynier|security clearance|poswiadczenie bezpieczenstwa|work authorization|prawo do pracy|sep\b|ccna|pmp|prince2|itil|az-900|aws certified)/i;

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
  if (PREFERRED_MARKER.test(line)) return 'PREFERRED';
  if (CORE_MARKER.test(line)) return 'CORE_MUST';
  if (MUST_MARKER.test(line)) return 'MUST';
  return section;
}

function baseExtractionConfidence(line: string, priority: D10RequirementPriority): number {
  if (CORE_MARKER.test(line)) return 0.98;
  if (PREFERRED_MARKER.test(line)) return 0.94;
  if (MUST_MARKER.test(line)) return 0.93;
  if (priority === 'PREFERRED') return 0.86;
  return 0.84;
}

function educationFieldConstraint(line: string): string | null {
  const normalized = normalizeFormalTerm(line);
  const patterns = [
    /(?:kierunek|specjalnosc|field(?: of study)?)\s*[:\-]?\s*([a-z0-9 +.#/-]{3,80})$/,
    /(?:in|z zakresu|w dziedzinie)\s+([a-z0-9 +.#/-]{3,80})$/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

interface ParsedLineEntity {
  canonicalId: string;
  kind: D10FormalRequirementKind;
  label: string;
  languageLevel?: D10FormalRequirement['languageLevel'];
  educationLevel?: D10FormalRequirement['educationLevel'];
  fieldConstraint?: string | null;
  validityRequired?: boolean;
}

function parseFormalEntities(line: string): ParsedLineEntity[] {
  const out: ParsedLineEntity[] = [];
  const formal = canonicalFormalEntity(line);
  if (formal) {
    out.push({
      ...formal,
      languageLevel: formal.kind === 'LANGUAGE' ? (parseCefrLevel(line) ?? undefined) : undefined,
      validityRequired: /\b(valid|current|aktualn|wazn)\w*\b/i.test(normalizeFormalTerm(line)),
    });
  }

  const language = canonicalLanguage(line);
  if (language && !out.some((item) => item.canonicalId === `language.${language}`)) {
    out.push({
      canonicalId: `language.${language}`,
      kind: 'LANGUAGE',
      label: language,
      languageLevel: parseCefrLevel(line) ?? undefined,
    });
  }

  const education = parseEducationLevel(line);
  if (education) {
    out.push({
      canonicalId: `education.${education.toLowerCase()}`,
      kind: 'EDUCATION',
      label: education,
      educationLevel: education,
      fieldConstraint: educationFieldConstraint(line),
    });
  }

  return out.filter((item, index, array) =>
    array.findIndex((candidate) => candidate.canonicalId === item.canonicalId) === index,
  );
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
  const lines = text.split('\n').map(cleanLine).filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (MUST_SECTION.test(line)) {
      section = 'MUST';
      continue;
    }
    if (PREFERRED_SECTION.test(line)) {
      section = 'PREFERRED';
      continue;
    }
    if (NEUTRAL_SECTION.test(line)) {
      section = null;
      continue;
    }

    const priority = priorityForLine(line, section);
    const looksFormal = FORMAL_HINT.test(normalizeFormalTerm(line));
    if (looksFormal && priority) requirementLikeLines += 1;
    if (!priority || !looksFormal) continue;

    const entities = parseFormalEntities(line);
    if (entities.length === 0) continue;
    parsedRequirementLines += 1;

    for (const entity of entities) {
      const adaptiveDelta = boundedAdaptiveAdjustment(adaptiveSignal);
      const confidence = Math.max(0, Math.min(1,
        baseExtractionConfidence(line, priority) + adaptiveDelta,
      ));
      const evidenceId = await buildEvidenceId(
        SCHEMA_VERSION,
        'JOB',
        `job.lines[${index}]`,
        { canonicalId: entity.canonicalId, kind: entity.kind, priority, line },
        'EXPLICIT_DOCUMENT_FACT',
      );
      const atom: Evidence = {
        id: evidenceId,
        provenance: 'EXPLICIT_DOCUMENT_FACT',
        pointer: { source: 'JOB', jsonPath: `job.lines[${index}]` },
        description: `Wykryto formalny wymóg ${entity.label} jako ${priority}.`,
        redactedSnippet: line.slice(0, 220),
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
        id: `REQ_D10_${entity.canonicalId}`,
        kind: entity.kind,
        priority,
        label: entity.label,
        canonicalId: entity.canonicalId,
        sourceText: line,
        extractionConfidence: confidence,
        weight: priorityWeight[priority],
        evidenceIds: [evidenceId],
        languageLevel: entity.languageLevel,
        educationLevel: entity.educationLevel,
        fieldConstraint: entity.fieldConstraint,
        validityRequired: entity.validityRequired,
      };

      const current = requirements.get(entity.canonicalId);
      if (!current) {
        requirements.set(entity.canonicalId, candidate);
      } else {
        const stronger = priorityRank[candidate.priority] > priorityRank[current.priority]
          ? candidate
          : current;
        requirements.set(entity.canonicalId, {
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

  const list = [...requirements.values()];
  const coverage = requirementLikeLines > 0
    ? Math.min(1, parsedRequirementLines / requirementLikeLines)
    : list.length > 0 ? 1 : 0;
  const meanConfidence = list.length > 0
    ? list.reduce((sum, item) => sum + item.extractionConfidence, 0) / list.length
    : 0;

  return {
    requirements: list,
    parserConfidence: list.length > 0 ? 0.7 * meanConfidence + 0.3 * coverage : 0,
    evidence,
    requirementLikeLines,
    parsedRequirementLines,
    adaptiveSignal,
  };
}
