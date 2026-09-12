import { describe, expect, it } from 'vitest';
import {
  ADAPTIVE_MODULE_POLICIES,
  adaptiveDocumentFingerprint,
  boundedAdaptiveAdjustment,
  classifyNumericContext,
  deduplicateAdaptiveCorpus,
  evaluateAdaptiveRuntimeSignal,
  extractAdaptiveFeatures,
  learnAdaptiveModuleModel,
  numericContextWeight,
  partitionAdaptiveTrainingCases,
  scoreDistributionHealth,
  tokenizeAdaptiveText,
  type AdaptiveCalibrationSnapshot,
  type AdaptiveCorpusDocument,
  type AdaptiveTrainingCase,
} from '../audit-core/adaptive';

describe('D20 adaptive learning layer', () => {
  it('odrzuca PII i zachowuje kanoniczne tokeny techniczne', () => {
    const tokens = tokenizeAdaptiveText(
      '[EMAIL_ANONIM] [TELEFON_ANONIM] C++ C# .NET Node.js k8s React.js',
    );
    expect(tokens).not.toContain('[email_anonim]');
    expect(tokens).not.toContain('[telefon_anonim]');
    expect(tokens).toContain('cpp');
    expect(tokens).toContain('csharp');
    expect(tokens).toContain('dotnet');
    expect(tokens).toContain('nodejs');
    expect(tokens).toContain('kubernetes');
    expect(tokens).toContain('react');
  });

  it('deduplikuje ten sam dokument przed uczeniem', () => {
    const corpus: AdaptiveCorpusDocument[] = [
      { id: 'a', text: 'Java PostgreSQL doświadczenie', labels: ['GOOD'], sourceKind: 'SYNTHETIC' },
      { id: 'b', text: 'Java PostgreSQL doświadczenie', labels: ['GOOD'], sourceKind: 'SYNTHETIC' },
      { id: 'c', text: 'Python analiza danych', labels: ['OTHER'], sourceKind: 'SYNTHETIC' },
    ];
    expect(adaptiveDocumentFingerprint(corpus[0].text)).toBe(adaptiveDocumentFingerprint(corpus[1].text));
    const deduped = deduplicateAdaptiveCorpus(corpus);
    expect(deduped).toHaveLength(2);
  });

  it('keyword stuffing nie zwiększa document frequency jednego leksemu', () => {
    const repeated = extractAdaptiveFeatures('Java '.repeat(200));
    expect([...repeated].filter((feature) => feature === 'java')).toHaveLength(1);
  });

  it('uczy predykcyjny leksem przez wygładzony log-odds zamiast surowej częstotliwości', () => {
    const policy = {
      ...ADAPTIVE_MODULE_POLICIES.MOD_LINGUISTIC_NATURALNESS,
      learnableLabels: ['STUFFING'],
      minDocumentSupport: 2,
      minAbsZScore: 0.5,
      minLift: 1.2,
    };
    const corpus: AdaptiveCorpusDocument[] = [
      { id: 'p1', text: 'java java java manager manager', labels: ['STUFFING'], sourceKind: 'SYNTHETIC' },
      { id: 'p2', text: 'java manager java manager', labels: ['STUFFING'], sourceKind: 'SYNTHETIC' },
      { id: 'p3', text: 'java manager cloud java', labels: ['STUFFING'], sourceKind: 'SYNTHETIC' },
      { id: 'n1', text: 'prowadzilem projekty dla klientow', labels: [], sourceKind: 'SYNTHETIC' },
      { id: 'n2', text: 'zoptymalizowano proces produkcyjny', labels: [], sourceKind: 'SYNTHETIC' },
      { id: 'n3', text: 'analiza danych i raportowanie', labels: [], sourceKind: 'SYNTHETIC' },
    ];
    const model = learnAdaptiveModuleModel(policy, corpus, 'test-v1');
    const java = model.features.find((feature) => feature.feature === 'java');
    expect(java).toBeDefined();
    expect(java!.direction).toBe('POSITIVE');
    expect(java!.logOdds).toBeGreaterThan(0);
  });

  it('nie uczy parametrów z etykiet wygenerowanych przez stary silnik', () => {
    const cases: AdaptiveTrainingCase[] = [
      { id: 'gold', text: 'a', labels: ['X'], sourceKind: 'GOLDEN', labelOrigin: 'HUMAN_GOLD' },
      { id: 'legacy', text: 'b', labels: ['X'], sourceKind: 'REAL_ANONYMIZED', labelOrigin: 'LEGACY_ENGINE' },
      { id: 'real', text: 'c', labels: [], sourceKind: 'REAL_ANONYMIZED', labelOrigin: 'UNLABELED_DISCOVERY' },
      { id: 'synthetic', text: 'd', labels: ['X'], sourceKind: 'SYNTHETIC', labelOrigin: 'INJECTED_SYNTHETIC' },
    ];
    const partition = partitionAdaptiveTrainingCases(cases, 0);
    expect(partition.training.map((item) => item.id)).toEqual(['gold', 'synthetic']);
    expect(partition.discoveryOnly.map((item) => item.id)).toEqual(['legacy', 'real']);
  });

  it('ma politykę adaptacyjną dla każdego modułu D08-D17 i żadna nie aktywuje się sama', () => {
    const policies = Object.values(ADAPTIVE_MODULE_POLICIES);
    expect(policies).toHaveLength(10);
    expect(policies.every((policy) => policy.allowAutomaticActivation === false)).toBe(true);
    expect(Math.max(...policies.map((policy) => policy.maxRuntimeInfluence))).toBeLessThanOrEqual(0.12);
  });

  it('D13 odróżnia wynik od roku, stażu i fragmentu ceny/nazwy', () => {
    const impact = classifyNumericContext('35', 'Skrócono czas procesu o 35% i poprawiono SLA.');
    const year = classifyNumericContext('2022', 'Okres 2022 - 2024');
    const duration = classifyNumericContext('3', '3 lata doświadczenia w obsłudze klienta');
    const brandedPrice = classifyNumericContext('99', 'Bonjour, 99 Złota Proporcja');
    expect(impact.classification).toBe('IMPACT_METRIC');
    expect(numericContextWeight(impact)).toBe(1);
    expect(year.classification).toBe('DATE_OR_YEAR');
    expect(duration.classification).toBe('DURATION');
    expect(brandedPrice.classification).toBe('PRICE_OR_NAME_FRAGMENT');
    expect(numericContextWeight(brandedPrice)).toBe(0);
  });

  it('wykrywa skompresowany/degenerujący rozkład score', () => {
    const naturalness = scoreDistributionHealth(Array(27).fill(90));
    const consistency = scoreDistributionHealth(Array(27).fill(100));
    expect(naturalness.collapsed).toBe(true);
    expect(consistency.collapsed).toBe(true);
    expect(naturalness.populationStdDev).toBe(0);
  });

  it('snapshot SHADOW nie wpływa na runtime, a ACTIVE pozostaje ograniczony capem', () => {
    const base: AdaptiveCalibrationSnapshot = {
      snapshotVersion: 'test',
      corpusFingerprint: 'abc',
      createdAt: '2026-09-11T00:00:00.000Z',
      status: 'SHADOW',
      privacy: {
        storesRawText: false,
        storesUserIdentifiers: false,
        minimumDocumentSupport: 3,
        piiFiltered: true,
      },
      moduleModels: {
        MOD_STRUCTURAL_READABILITY: {
          moduleId: 'MOD_STRUCTURAL_READABILITY',
          modelVersion: 'm1',
          sourceLabels: ['OCR_GARBLED_CHARS'],
          trainedDocuments: 10,
          effectiveDocuments: 10,
          features: [{
            feature: '__meta_tiny_line_burst__',
            ngramSize: 1,
            label: 'OCR_GARBLED_CHARS',
            supportPositive: 5,
            supportNegative: 0,
            positiveDocuments: 5,
            negativeDocuments: 5,
            positiveRate: 0.916,
            negativeRate: 0.083,
            logOdds: 4,
            zScore: 3,
            lift: 11,
            confidence: 1,
            direction: 'POSITIVE',
          }],
        },
      },
    };
    const text = 'A\nB\nC\nD\nE\nF\nG\nH\npełne doświadczenie zawodowe';
    const shadow = evaluateAdaptiveRuntimeSignal(base, 'MOD_STRUCTURAL_READABILITY', text);
    expect(shadow.evidenceStrength).toBe(0);

    const active = evaluateAdaptiveRuntimeSignal({ ...base, status: 'ACTIVE' }, 'MOD_STRUCTURAL_READABILITY', text);
    const adjustment = boundedAdaptiveAdjustment(active);
    expect(Math.abs(adjustment)).toBeLessThanOrEqual(0.12);
  });
});
