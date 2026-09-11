import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALL_AUDIT_DOMAINS,
  AUDIT_CORE_CORPUS_JSON_PATH,
  AUDIT_CORE_CORPUS_VERSION,
  DEFAULT_AUDIT_CORE_CONFIG,
  DEFAULT_SIGNAL_OWNERSHIP,
  aggregateDomain,
  applyPenaltyBudget,
  benchmarkAggregationModels,
  buildAuditIntegritySignature,
  buildCalibrationDriftReport,
  buildGlobalConsensus,
  buildScoreLedger,
  calibrationDriftGate,
  confidenceBand,
  createEvidence,
  decideApplicability,
  deriveConfidenceFromEvidence,
  estimateEffectiveIndependentSampleSize,
  generalizedMean,
  redactCommonPii,
  toMonthIndex,
  fromMonthIndex,
  validateAuditCoreConfig,
  validateGoldenCorpus,
  validateScoreLedger,
  validateSignalOwnership,
  type AuditDomainId,
  type AuditModuleResult,
  type ConfidenceBreakdown,
  type Evidence,
  type GoldenCorpusDocument,
  type ScoreComponent,
} from '../audit-core';

const confidenceHigh: ConfidenceBreakdown = {
  coverage: 1,
  provenance: 0.9,
  extraction: 0.95,
  sample: 0.9,
  combined: 0.91,
};

function component(id: string, normalizedValue: number, effectiveWeight = 1): ScoreComponent {
  const maxContribution = effectiveWeight * 100;
  const contribution = normalizedValue * maxContribution;
  return {
    id,
    name: id,
    rawValue: normalizedValue,
    normalizedValue,
    baseWeight: effectiveWeight,
    effectiveWeight,
    contribution,
    maxContribution,
    unrealizedPotential: maxContribution - contribution,
    evidenceIds: [`EV_${id.toLowerCase().padEnd(20, '0').slice(0, 20)}`],
  };
}

function moduleResult(
  moduleId: string,
  domainId: AuditDomainId,
  score: number | null,
  applicability: AuditModuleResult['applicability'] = 'APPLICABLE',
  confidence = 0.9,
): AuditModuleResult {
  const breakdown = score === null ? [] : [component(`${moduleId}_C`, score / 100)];
  return {
    moduleId,
    moduleName: moduleId,
    domainId,
    score,
    confidence,
    confidenceBreakdown: { ...confidenceHigh, combined: confidence },
    applicability,
    evidence: [],
    missingEvidence: [],
    breakdown,
    penalties: [],
    hardCaps: [],
    ledger: null,
    verdictCode: 'TEST',
    verdict: 'test',
    recommendations: [],
  };
}

describe('D07 temporal contract', () => {
  it('MonthIndex jest całkowity i odwracalny', () => {
    const index = toMonthIndex(2026, 9);
    expect(Number.isInteger(index)).toBe(true);
    expect(fromMonthIndex(index)).toEqual({ year: 2026, month: 9 });
  });

  it('odrzuca miesiąc spoza 1..12', () => {
    expect(() => toMonthIndex(2026, 13)).toThrow();
  });
});

describe('D07 applicability', () => {
  const requirements = [
    { code: 'CV', expectedWeight: 0.6, required: true },
    { code: 'JD', expectedWeight: 0.4, required: true, modes: ['TARGETED_APPLICATION' as const] },
  ];

  it('moduł wyłączony w trybie jest NOT_APPLICABLE, nie INSUFFICIENT_DATA', () => {
    const decision = decideApplicability({
      mode: 'GENERAL_CV',
      requirements,
      fulfilledRequirementCodes: new Set(),
      moduleEnabledInMode: false,
      pipelineHealthy: true,
    });
    expect(decision.state).toBe('NOT_APPLICABLE');
  });

  it('brak JD w TARGETED_APPLICATION jest INSUFFICIENT_DATA', () => {
    const decision = decideApplicability({
      mode: 'TARGETED_APPLICATION',
      requirements,
      fulfilledRequirementCodes: new Set(['CV']),
      moduleEnabledInMode: true,
      pipelineHealthy: true,
    });
    expect(decision.state).toBe('INSUFFICIENT_DATA');
    expect(decision.missingRequiredCodes).toContain('JD');
  });
});

describe('D07 confidence v2', () => {
  const ev = (id: string, provenance: Evidence['provenance'], correlationKey?: string): Evidence => ({
    id,
    provenance,
    pointer: { source: 'CV', jsonPath: `$.${id}` },
    description: id,
    extractionConfidence: 0.95,
    correlationKey,
    evidenceImportance: 1,
  });

  it('duplikaty korelacyjne nie liczą się jak niezależne evidence', () => {
    const one = [ev('EV_A', 'DERIVED_DETERMINISTIC', 'same')];
    const duplicated = [...one, ev('EV_B', 'DERIVED_DETERMINISTIC', 'same')];
    const independent = [...one, ev('EV_C', 'DERIVED_DETERMINISTIC', 'other')];
    expect(estimateEffectiveIndependentSampleSize(duplicated)).toBe(1);
    expect(estimateEffectiveIndependentSampleSize(independent)).toBe(2);
  });

  it('lepszy provenance daje wyższy confidence przy pozostałych danych stałych', () => {
    const calc = (provenance: Evidence['provenance']) => deriveConfidenceFromEvidence({
      expectedEvidenceWeight: 1,
      evidence: [ev('EV_X', provenance)],
      sampleScaleK: 1,
    }).combined;
    expect(calc('EXTERNALLY_VERIFIED')).toBeGreaterThan(calc('USER_ASSERTED_CANONICAL'));
    expect(calc('USER_ASSERTED_CANONICAL')).toBeGreaterThan(calc('INFERRED_HEURISTIC'));
  });

  it('confidence band nie miesza score z pewnością', () => {
    expect(confidenceBand(0.2)).toBe('INSUFFICIENT');
    expect(confidenceBand(0.6)).toBe('STANDARD');
    expect(confidenceBand(0.9)).toBe('HIGH');
  });
});

describe('D07 Evidence Graph', () => {
  it('Evidence ID jest deterministyczne, a hash nie zależy od kolejności kluczy payloadu', async () => {
    const common = {
      schemaVersion: 'v2',
      provenance: 'DERIVED_DETERMINISTIC' as const,
      pointer: { source: 'CV' as const, jsonPath: '$.summary' },
      description: 'test',
      extractionConfidence: 1,
    };
    const a = await createEvidence({ ...common, normalizedPayload: { a: 1, b: 2 } });
    const b = await createEvidence({ ...common, normalizedPayload: { b: 2, a: 1 } });
    expect(a.id).toBe(b.id);
  });

  it('redakcja usuwa najczęstsze PII z explainability snippet', () => {
    expect(redactCommonPii('jan@example.com +48 501 234 567'))
      .toBe('[EMAIL] [PHONE]');
  });
});

describe('D07 penalty registry', () => {
  it('ta sama wada nie może zostać naliczona wielokrotnie ponad budżet fingerprintu', () => {
    const components = [component('C1', 1, 0.2)];
    const base = {
      ruleCode: 'PEN_TEST',
      defectFingerprint: 'DF_SAME',
      targetModuleId: 'M1',
      targetComponentId: 'C1',
      severity: 'HIGH' as const,
      requestedDeduction: 15,
      appliedDeduction: 0,
      evidenceIds: ['EV_TEST'],
      explanation: 'test',
    };
    const result = applyPenaltyBudget([
      { ...base, id: 'P1' },
      { ...base, id: 'P2' },
    ], { components, maxPerDefectFingerprint: 15 });
    expect(result.requestedTotal).toBe(30);
    expect(result.appliedTotal).toBe(15);
    expect(result.suppressedByBudget).toBe(15);
  });

  it('kara komponentowa nie przekracza maxContribution komponentu', () => {
    const components = [component('C1', 1, 0.1)];
    const result = applyPenaltyBudget([{
      id: 'P1',
      ruleCode: 'P',
      defectFingerprint: 'DF1',
      targetModuleId: 'M1',
      targetComponentId: 'C1',
      severity: 'CRITICAL',
      requestedDeduction: 50,
      appliedDeduction: 0,
      evidenceIds: ['EV_TEST'],
      explanation: 'test',
    }], { components });
    expect(result.appliedTotal).toBe(10);
  });
});

describe('D07 Score Ledger', () => {
  it('odtwarza runtime score 1:1 i rozróżnia karę od niezrealizowanego potencjału', () => {
    const components = [component('C1', 0.8, 0.5), component('C2', 0.6, 0.5)];
    const penalties = [{
      id: 'P1', ruleCode: 'P1', defectFingerprint: 'DF1', targetModuleId: 'M1',
      severity: 'LOW' as const, requestedDeduction: 5, appliedDeduction: 5,
      evidenceIds: ['EV_PEN'], explanation: 'test',
    }];
    const hardCaps = [{
      id: 'HC1', ruleCode: 'HC1', scope: 'MODULE' as const, targetId: 'M1', capLimit: 60,
      triggered: true, reason: 'test', evidenceIds: ['EV_CAP'],
    }];
    const ledger = buildScoreLedger({
      moduleId: 'M1', components, penalties, hardCaps, confidenceBreakdown: confidenceHigh,
    });
    expect(ledger.componentTotal).toBe(70);
    expect(ledger.penaltyTotal).toBe(5);
    expect(ledger.scoreAfterPenalties).toBe(65);
    expect(ledger.finalScore).toBe(60);
    expect(validateScoreLedger(ledger, 60)).toEqual([]);
    expect(ledger.componentRows.reduce((s, row) => s + row.unrealized, 0)).toBe(30);
  });
});

describe('D07 signal ownership', () => {
  it('każda rodzina ma dokładnie jednego primary ownera', () => {
    expect(validateSignalOwnership(DEFAULT_SIGNAL_OWNERSHIP)).toEqual([]);
    expect(new Set(DEFAULT_SIGNAL_OWNERSHIP.map((item) => item.family)).size)
      .toBe(DEFAULT_SIGNAL_OWNERSHIP.length);
  });
});

describe('D07 aggregation', () => {
  it('benchmark liczy wszystkie obowiązkowe p i geometric reaguje na słaby filar', () => {
    const strong = [{ value: 90, weight: 1 }, { value: 90, weight: 1 }, { value: 90, weight: 1 }];
    const weak = [...strong.slice(0, 2), { value: 20, weight: 1 }];
    expect(Object.keys(benchmarkAggregationModels(strong))).toEqual(['p=-1', 'p=-0.5', 'p=0', 'p=0.5', 'p=1']);
    expect(generalizedMean(weak, 0)).toBeLessThan(generalizedMean(strong, 0));
  });

  it('NOT_APPLICABLE jest legalnie pomijane, INSUFFICIENT_DATA blokuje domenę', () => {
    const policy = { domainId: 'DOCUMENT_QUALITY' as const, moduleWeights: { A: 1, B: 1 } };
    const na = aggregateDomain([
      moduleResult('A', 'DOCUMENT_QUALITY', 80),
      moduleResult('B', 'DOCUMENT_QUALITY', null, 'NOT_APPLICABLE'),
    ], policy);
    expect(na.score).toBeCloseTo(80, 8);

    const insufficient = aggregateDomain([
      moduleResult('A', 'DOCUMENT_QUALITY', 80),
      moduleResult('B', 'DOCUMENT_QUALITY', null, 'INSUFFICIENT_DATA', 0.2),
    ], policy);
    expect(insufficient.score).toBeNull();
    expect(insufficient.applicability).toBe('INSUFFICIENT_DATA');
  });

  it('TARGETED_APPLICATION bez uczciwego JOB_FIT nie zwraca pozornie wysokiego global score', async () => {
    const context = {
      auditRunId: 'RUN_TEST', engineVersion: '1', configVersion: '1', corpusSchemaVersion: '1',
      mode: 'TARGETED_APPLICATION' as const, referenceMonth: toMonthIndex(2026, 9),
    };
    const result = await buildGlobalConsensus({
      context,
      moduleResults: [
        moduleResult('DOC', 'DOCUMENT_QUALITY', 95),
        moduleResult('FIT', 'JOB_FIT', null, 'INSUFFICIENT_DATA', 0.1),
      ],
      domainPolicies: [
        { domainId: 'DOCUMENT_QUALITY', moduleWeights: { DOC: 1 } },
        { domainId: 'JOB_FIT', moduleWeights: { FIT: 1 }, requiredModuleIds: ['FIT'] },
      ],
      domainWeights: {
        DOCUMENT_QUALITY: 1, JOB_FIT: 1, EVIDENCE_QUALITY: 1, INTEGRITY: 1, FORMAL_READINESS: 1,
      },
      canonicalSignalsForSignature: { test: true },
      moduleConfigVersions: { DOC: '1', FIT: '1' },
    });
    expect(result.overallScore).toBeNull();
    expect(result.blockingIssues.some((issue) => issue.includes('JOB_FIT'))).toBe(true);
  });
});

describe('D07 integrity signature', () => {
  it('jest deterministyczna i nie zawiera auditRunId', async () => {
    const input = {
      engineVersion: '1', auditMode: 'GENERAL_CV' as const, referenceMonth: 24320,
      canonicalSignals: { b: 2, a: 1 }, moduleConfigVersions: { D08: '1' }, corpusSchemaVersion: '2',
    };
    const a = await buildAuditIntegritySignature(input);
    const b = await buildAuditIntegritySignature({ ...input, canonicalSignals: { a: 1, b: 2 } });
    expect(a).toBe(b);
  });
});

describe('D07 configuration and corpus', () => {
  it('domyślna konfiguracja przechodzi runtime validation i pozostaje oznaczona jako calibration required', () => {
    const config = validateAuditCoreConfig(DEFAULT_AUDIT_CORE_CONFIG);
    expect(config.calibrationRequired).toBe(true);
    expect(config.aggregation.baselineP).toBe(0);
  });

  it('golden corpus jest wersjonowanym JSON-em, ma pełny zestaw archetypów i poprawne tryby', () => {
    const raw = readFileSync(resolve(process.cwd(), AUDIT_CORE_CORPUS_JSON_PATH), 'utf8');
    const corpus = JSON.parse(raw) as GoldenCorpusDocument;
    expect(corpus.version).toBe(AUDIT_CORE_CORPUS_VERSION);
    expect(corpus.cases.length).toBeGreaterThanOrEqual(34);
    expect(validateGoldenCorpus(corpus)).toEqual([]);
  });
});

describe('D07 calibration drift', () => {
  it('raport wykrywa inwersję relacji i zmianę hard capów', () => {
    const report = buildCalibrationDriftReport({
      engineVersion: '2', configVersion: '2', corpusVersion: '2',
      before: [
        { caseId: 'GOOD', score: 80, confidence: 0.8, hardCapRuleCodes: [] },
        { caseId: 'BAD', score: 50, confidence: 0.8, hardCapRuleCodes: ['OLD'] },
      ],
      after: [
        { caseId: 'GOOD', score: 60, confidence: 0.75, hardCapRuleCodes: ['NEW'] },
        { caseId: 'BAD', score: 65, confidence: 0.8, hardCapRuleCodes: [] },
      ],
      expectedRelations: [{ betterCaseId: 'GOOD', worseCaseId: 'BAD' }],
    });
    expect(report.rankInversions).toHaveLength(1);
    expect(report.newHardCaps).toContain('NEW');
    expect(report.removedHardCaps).toContain('OLD');
    expect(calibrationDriftGate(report, {
      maxMedianAbsoluteDelta: 100,
      maxP95AbsoluteDelta: 100,
      maxAbsoluteDelta: 100,
      allowRankInversions: false,
    })).toHaveLength(1);
  });
});

describe('D07 architecture boundary', () => {
  it('core nie importuje MasterVault ani surowych typów aplikacji', () => {
    const files = [
      'contracts.ts', 'confidence.ts', 'applicability.ts', 'aggregation.ts', 'penalties.ts',
      'hardCaps.ts', 'ledger.ts', 'ownership.ts', 'signature.ts', 'temporal.ts', 'config.ts',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(process.cwd(), 'src/lib/audit-core', file), 'utf8');
      expect(source).not.toMatch(/from\s+['"][^'"]*(?:types|MasterVault|JobDescription)[^'"]*['"]/);
    }
  });

  it('wszystkie pięć domen istnieje w kontrakcie agregatora', () => {
    expect(ALL_AUDIT_DOMAINS).toEqual([
      'DOCUMENT_QUALITY', 'JOB_FIT', 'EVIDENCE_QUALITY', 'INTEGRITY', 'FORMAL_READINESS',
    ]);
  });
});
