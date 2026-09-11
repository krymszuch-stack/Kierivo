import { describe, expect, it } from 'vitest';
import type { Evidence } from '../audit-core/contracts';
import { resolveD09SemanticRelation } from '../audit-core/d09/ontology';
import { scoreD09JobAlignment } from '../audit-core/d09/scorer';
import type {
  D09CandidateEvidence,
  D09JobRequirement,
  D09RequirementExtractionResult,
  D09RequirementPriority,
} from '../audit-core/d09/types';

const jobEvidence = (id: string): Evidence => ({
  id: `EV_JOB_${id}`,
  provenance: 'EXPLICIT_DOCUMENT_FACT',
  pointer: { source: 'JOB', jsonPath: `requirements.${id}` },
  description: `JD requirement ${id}`,
  extractionConfidence: 0.95,
  correlationKey: `JOB:${id}`,
  evidenceImportance: 1,
  signalFamily: 'SKILL_PRESENCE',
});

const req = (
  canonicalId: string,
  priority: D09RequirementPriority = 'MUST',
  kind: D09JobRequirement['kind'] = 'SKILL',
): D09JobRequirement => ({
  id: `REQ_${canonicalId}`,
  label: canonicalId,
  canonicalId,
  kind,
  priority,
  weight: priority === 'CORE_MUST' ? 1.5 : priority === 'NICE' ? 0.7 : 1,
  sourceText: `${priority}: ${canonicalId}`,
  extractionConfidence: 0.95,
  evidenceIds: [`EV_JOB_${canonicalId}`],
});

const cand = (
  canonicalId: string,
  depth = 1,
  extractionConfidence = 1,
): D09CandidateEvidence => ({
  id: `CAND_${canonicalId}_${depth}`,
  canonicalId,
  label: canonicalId,
  source: 'VAULT_EXPERIENCE',
  sourceLabel: 'Experience fixture',
  evidenceDepth: depth,
  extractionConfidence,
  evidence: {
    id: `EV_CAND_${canonicalId}_${depth}`,
    provenance: 'USER_ASSERTED_CANONICAL',
    pointer: { source: 'VAULT', jsonPath: `fixture.${canonicalId}` },
    description: `Candidate evidence ${canonicalId}`,
    extractionConfidence,
    correlationKey: `CAND:${canonicalId}`,
    evidenceImportance: depth,
    signalFamily: 'SKILL_CONTEXT',
  },
});

const extraction = (requirements: D09JobRequirement[]): D09RequirementExtractionResult => ({
  requirements,
  parserConfidence: requirements.length > 0 ? 0.95 : 1,
  evidence: requirements.map((r) => jobEvidence(r.canonicalId)),
  requirementLikeLines: requirements.length,
  parsedRequirementLines: requirements.length,
});

function score(
  requirements: D09JobRequirement[],
  candidateEvidence: D09CandidateEvidence[],
  options?: { sourceMode?: 'VAULT' | 'EXTRACTED_DOCUMENT'; completeness?: number },
) {
  return scoreD09JobAlignment({
    extraction: extraction(requirements),
    candidateEvidence,
    documentClass: 'CV',
    sourceCompletenessConfidence: options?.completeness ?? 1,
    sourceMode: options?.sourceMode ?? 'VAULT',
  });
}

describe('D09 Job Alignment — matematyka i izolacja sygnału', () => {
  it('nie daje 100 za brak wymagań', () => {
    const result = score([], []);
    expect(result.score).toBeNull();
    expect(result.applicability).toBe('NOT_APPLICABLE');
  });

  it('pełne MUST poparte doświadczeniem może osiągnąć referencyjne 100 bez NICE', () => {
    const result = score([req('java'), req('postgresql')], [cand('java'), cand('postgresql')]);
    expect(result.score).toBeCloseTo(100, 6);
    expect(result.ledger?.finalScore).toBe(result.score);
  });

  it('jedna kompletna dziura w MUST boli bardziej niż zwykła średnia arytmetyczna', () => {
    const requirements = [req('java'), req('postgresql'), req('docker'), req('kubernetes')];
    const result = score(requirements, [cand('java'), cand('postgresql'), cand('docker')]);
    expect(result.score).not.toBeNull();
    expect(result.alignment.arithmeticMust).toBeCloseTo(0.75, 6);
    expect(result.alignment.asymmetricMustIndex!).toBeLessThan(0.70);
    expect(result.score!).toBeLessThan(75);
  });

  it('NICE nie maskuje słabego MUST', () => {
    const requirements = [
      req('java'), req('postgresql'), req('kubernetes'),
      req('aws', 'NICE'), req('terraform', 'NICE'), req('docker', 'NICE'),
    ];
    const result = score(requirements, [cand('java'), cand('aws'), cand('terraform'), cand('docker')]);
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeLessThan(50);
  });

  it('pełne MUST + około 75% jakości NICE daje wynik w okolicy 90, nie plateau 100', () => {
    const requirements = [req('java'), req('postgresql'), req('aws', 'NICE')];
    const result = score(requirements, [cand('java'), cand('postgresql'), cand('aws', 0.50)]);
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThan(87);
    expect(result.score!).toBeLessThan(93);
  });

  it('jawny brak CORE MUST uruchamia wyłącznie modułowy cap 35', () => {
    const result = score(
      [req('java', 'CORE_MUST'), req('postgresql')],
      [cand('postgresql')],
    );
    expect(result.hardCaps.some((cap) => cap.ruleCode === 'HC_D09_CORE_MUST_MISSING')).toBe(true);
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeLessThanOrEqual(35);
  });

  it('niska kompletność materiału z D08 tworzy UNKNOWN zamiast fałszywego braku i nie odpala core capu', () => {
    const result = score(
      [req('java', 'CORE_MUST'), req('postgresql'), req('kubernetes')],
      [],
      { sourceMode: 'EXTRACTED_DOCUMENT', completeness: 0.40 },
    );
    expect(result.score).toBeNull();
    expect(result.applicability).toBe('INSUFFICIENT_DATA');
    expect(result.alignment.requirementMatches.every((match) => match.status === 'UNKNOWN')).toBe(true);
    expect(result.hardCaps).toHaveLength(0);
  });

  it('licencje są delegowane do D10 i nie obniżają D09', () => {
    const result = score(
      [req('java'), req('license-driving-c', 'CORE_MUST', 'FORMAL_REFERENCE')],
      [cand('java')],
    );
    expect(result.score).toBeCloseTo(100, 6);
    expect(result.alignment.deferredFormalRequirements).toHaveLength(1);
    expect(result.hardCaps).toHaveLength(0);
  });

  it('ontologia jest kierunkowa: PostgreSQL dobrze spełnia relacyjne DB, odwrotność jest tylko słabym dowodem', () => {
    const specificToBroad = resolveD09SemanticRelation('relational-database', 'postgresql');
    const broadToSpecific = resolveD09SemanticRelation('postgresql', 'relational-database');
    expect(specificToBroad.strength).toBe(0.95);
    expect(broadToSpecific.strength).toBe(0.25);
  });

  it('React nie jest traktowany jako spełnienie konkretnego Vue MUST', () => {
    const related = resolveD09SemanticRelation('vue', 'react');
    expect(related.matchType).toBe('RELATED_ONLY');
    expect(related.strength).toBe(0);
  });

  it('gdy JD ma wyłącznie NICE, N/A po stronie MUST nie ogranicza wyniku do 20 punktów', () => {
    const result = score([req('aws', 'NICE'), req('terraform', 'NICE')], [cand('aws'), cand('terraform')]);
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThan(95);
  });
});
