import { computeAuditConfidence, confidenceBand } from '../confidence';
import type {
  AuditModuleResult,
  HardCap,
  MissingEvidence,
  Penalty,
  Recommendation,
  ScoreComponent,
} from '../contracts';
import { buildScoreLedger } from '../ledger';
import { applyPenaltyBudget } from '../penalties';
import type { D08ComponentId, D08Signals } from './types';

export const D08_MODULE_ID = 'MOD_STRUCTURAL_READABILITY';
export const D08_MODULE_NAME = 'Struktura i odczyt dokumentu';

export const D08_BASE_WEIGHTS: Record<D08ComponentId, number> = {
  TEXT_LAYER: 0.20,
  READING_ORDER: 0.22,
  SECTION_TOPOLOGY: 0.15,
  LAYOUT_TOPOLOGY: 0.13,
  ENCODING: 0.12,
  HEADINGS: 0.07,
  STRUCTURED_FIELDS: 0.07,
  LISTS: 0.04,
};

export const D08_CONFIG = {
  orderHalfLife: 0.12,
  encodingTau: 0.008,
  layoutDecay: {
    overlap: 8,
    clipping: 10,
    zOrder: 8,
    nested: 4,
  },
  layoutWeights: {
    overlap: 0.35,
    clipping: 0.30,
    zOrder: 0.20,
    nested: 0.15,
  },
  hiddenTextPenaltyMax: 15,
  hiddenTextPenaltyScale: 0.05,
  duplicateLayerPenaltyMax: 10,
  duplicateLayerPenaltyScale: 0.05,
  hardCaps: {
    sourceRecallThreshold: 0.40,
    sourceRecallCap: 25,
    readingOrderThreshold: 0.25,
    readingOrderCap: 40,
    encodingThreshold: 0.03,
    encodingCap: 45,
    hiddenTextThreshold: 0.25,
    hiddenTextCap: 50,
  },
} as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const safeRatio = (numerator: number, denominator: number): number =>
  denominator > 0 ? clamp01(numerator / denominator) : 0;

interface InternalComponent {
  id: D08ComponentId;
  name: string;
  normalizedValue: number;
  rawValue: number;
  baseWeight: number;
  evidenceIds: string[];
}

interface TextLayerMeasurement {
  quality: number;
  precision: number | null;
  recall: number | null;
}

interface OrderMeasurement {
  quality: number;
  discordance: number;
}

function textLayerMeasurement(signals: D08Signals): TextLayerMeasurement | null {
  if (!signals.textLayer.applicable) return null;

  if (signals.referenceProfile === 'SOURCE_AWARE') {
    const source = signals.textLayer.sourceTokenCount;
    const extracted = signals.textLayer.extractedTokenCount;
    const matched = signals.textLayer.matchedTokenCount;
    if (source === undefined || extracted === undefined || matched === undefined) return null;

    const precision = safeRatio(matched, extracted);
    const recall = safeRatio(matched, source);
    const denominator = precision + recall;
    const quality = denominator > 0 ? (2 * precision * recall) / denominator : 0;
    return { quality: clamp01(quality), precision, recall };
  }

  if (signals.textLayer.independentAgreementF1 !== undefined) {
    return {
      quality: clamp01(signals.textLayer.independentAgreementF1),
      precision: null,
      recall: null,
    };
  }

  if (signals.textLayer.nativeTextCoverage !== undefined) {
    return {
      quality: clamp01(signals.textLayer.nativeTextCoverage),
      precision: null,
      recall: null,
    };
  }

  return null;
}

function readingOrderQuality(signals: D08Signals): OrderMeasurement | null {
  if (signals.readingOrder.comparablePairWeight <= 0) return null;
  const discordance = clamp01(
    signals.readingOrder.discordantPairWeight / signals.readingOrder.comparablePairWeight,
  );
  return {
    discordance,
    quality: clamp01(
      Math.exp((-Math.log(2) * discordance) / D08_CONFIG.orderHalfLife),
    ),
  };
}

function sectionQuality(signals: D08Signals): number | null {
  if (!signals.sections.applicable) return null;

  if (signals.referenceProfile === 'SOURCE_AWARE') {
    if (signals.sections.labelMacroF1 === undefined || signals.sections.boundaryF1 === undefined) {
      return null;
    }
    return clamp01(
      0.65 * clamp01(signals.sections.labelMacroF1) +
      0.35 * clamp01(signals.sections.boundaryF1),
    );
  }

  if (
    signals.sections.externalDeterministicMatch === undefined ||
    signals.sections.externalBoundaryConsistency === undefined
  ) {
    return null;
  }

  return clamp01(
    0.65 * clamp01(signals.sections.externalDeterministicMatch) +
    0.35 * clamp01(signals.sections.externalBoundaryConsistency),
  );
}

function layoutQuality(signals: D08Signals): number | null {
  const dimensions: Array<{ ratio: number; decay: number; weight: number }> = [];
  const add = (ratio: number | undefined, decay: number, weight: number): void => {
    if (ratio !== undefined) dimensions.push({ ratio: clamp01(ratio), decay, weight });
  };

  add(signals.layout.overlapRatio, D08_CONFIG.layoutDecay.overlap, D08_CONFIG.layoutWeights.overlap);
  add(signals.layout.clippingRatio, D08_CONFIG.layoutDecay.clipping, D08_CONFIG.layoutWeights.clipping);
  add(signals.layout.ambiguousZOrderRatio, D08_CONFIG.layoutDecay.zOrder, D08_CONFIG.layoutWeights.zOrder);
  add(signals.layout.nestedComplexityRatio, D08_CONFIG.layoutDecay.nested, D08_CONFIG.layoutWeights.nested);

  if (dimensions.length === 0) return null;

  const activeWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  const quality = dimensions.reduce((product, dimension) => {
    const normalizedWeight = dimension.weight / activeWeight;
    const q = Math.exp(-dimension.decay * dimension.ratio);
    return product * Math.pow(q, normalizedWeight);
  }, 1);

  return clamp01(quality);
}

function encodingQuality(signals: D08Signals): number {
  const damage = Math.max(0, signals.encoding.weightedDamageRatio);
  return clamp01(Math.exp(-damage / D08_CONFIG.encodingTau));
}

function headingQuality(signals: D08Signals): number | null {
  if (!signals.headings.applicable) return null;
  if (
    signals.headings.meanSeparationScore === undefined ||
    signals.headings.levelConsistency === undefined
  ) {
    return null;
  }
  return clamp01(
    0.65 * clamp01(signals.headings.meanSeparationScore) +
    0.35 * clamp01(signals.headings.levelConsistency),
  );
}

function structuredFieldsQuality(signals: D08Signals): number | null {
  if (signals.structuredFields.length === 0) return null;
  const total = signals.structuredFields.reduce(
    (sum, field) => sum + clamp01(field.parseability),
    0,
  );
  return clamp01(total / signals.structuredFields.length);
}

function listQuality(signals: D08Signals): number | null {
  if (!signals.lists.applicable) return null;
  if (
    signals.lists.glyphConsistency === undefined ||
    signals.lists.indentQuality === undefined ||
    signals.lists.hangingIndentRatio === undefined
  ) {
    return null;
  }
  return clamp01(
    0.40 * clamp01(signals.lists.glyphConsistency) +
    0.35 * clamp01(signals.lists.indentQuality) +
    0.25 * clamp01(signals.lists.hangingIndentRatio),
  );
}

function buildComponents(
  signals: D08Signals,
  text: TextLayerMeasurement | null,
  order: OrderMeasurement | null,
): { breakdown: ScoreComponent[]; missingEvidence: MissingEvidence[] } {
  const missingEvidence: MissingEvidence[] = [];
  const components: InternalComponent[] = [];

  const add = (
    id: D08ComponentId,
    name: string,
    value: number | null,
    rawValue: number,
    evidenceIds: string[],
    expectedButMissing = false,
  ): void => {
    if (value === null) {
      if (expectedButMissing) {
        missingEvidence.push({
          id: `MISS_D08_${id}`,
          requirementCode: `D08_${id}_MEASUREMENT`,
          targetScope: id,
          description: `Brak wystarczających sygnałów do pomiaru komponentu ${name}.`,
          severity: 'MEDIUM',
          expectedEvidenceWeight: D08_BASE_WEIGHTS[id],
          suggestedAction: 'Powtórz ekstrakcję dokumentu lub dostarcz brakujące dane pomiarowe.',
        });
      }
      return;
    }

    components.push({
      id,
      name,
      normalizedValue: clamp01(value),
      rawValue,
      baseWeight: D08_BASE_WEIGHTS[id],
      evidenceIds,
    });
  };

  add(
    'TEXT_LAYER',
    'Integralność warstwy tekstowej',
    text?.quality ?? null,
    text?.recall ?? text?.quality ?? 0,
    signals.textLayer.evidenceIds,
    signals.textLayer.applicable,
  );

  add(
    'READING_ORDER',
    'Integralność kolejności odczytu',
    order?.quality ?? null,
    order ? 1 - order.discordance : 0,
    signals.readingOrder.evidenceIds,
    true,
  );

  const sections = sectionQuality(signals);
  add(
    'SECTION_TOPOLOGY',
    'Topologia sekcji',
    sections,
    sections ?? 0,
    signals.sections.evidenceIds,
    signals.sections.applicable,
  );

  const layout = layoutQuality(signals);
  add(
    'LAYOUT_TOPOLOGY',
    'Bezpieczeństwo topologii layoutu',
    layout,
    layout ?? 0,
    signals.layout.evidenceIds,
    true,
  );

  const encoding = encodingQuality(signals);
  add(
    'ENCODING',
    'Integralność kodowania i tekstu',
    encoding,
    1 - clamp01(signals.encoding.weightedDamageRatio),
    signals.encoding.evidenceIds,
  );

  const headings = headingQuality(signals);
  add(
    'HEADINGS',
    'Rozróżnialność nagłówków',
    headings,
    headings ?? 0,
    signals.headings.evidenceIds,
    signals.headings.applicable,
  );

  const fields = structuredFieldsQuality(signals);
  add(
    'STRUCTURED_FIELDS',
    'Parsowalność istniejących pól strukturalnych',
    fields,
    fields ?? 0,
    signals.structuredFields.map((field) => field.evidenceId),
  );

  const lists = listQuality(signals);
  add(
    'LISTS',
    'Spójność istniejących list',
    lists,
    lists ?? 0,
    signals.lists.evidenceIds,
    signals.lists.applicable,
  );

  const totalActiveBaseWeight = components.reduce((sum, component) => sum + component.baseWeight, 0);
  if (totalActiveBaseWeight <= Number.EPSILON) {
    return { breakdown: [], missingEvidence };
  }

  const breakdown = components.map((component): ScoreComponent => {
    const effectiveWeight = component.baseWeight / totalActiveBaseWeight;
    const maxContribution = effectiveWeight * 100;
    const contribution = component.normalizedValue * maxContribution;
    return {
      id: component.id,
      name: component.name,
      rawValue: component.rawValue,
      normalizedValue: component.normalizedValue,
      baseWeight: component.baseWeight,
      effectiveWeight,
      contribution,
      maxContribution,
      unrealizedPotential: Math.max(0, maxContribution - contribution),
      evidenceIds: component.evidenceIds,
      signalFamily: 'STRUCTURE',
    };
  });

  return { breakdown, missingEvidence };
}

function continuousPenalty(max: number, ratio: number, scale: number): number {
  if (ratio <= 0) return 0;
  return max * (1 - Math.exp(-ratio / scale));
}

function buildRequestedPenalties(signals: D08Signals): Penalty[] {
  const penalties: Penalty[] = [];

  if (signals.adversarial.hiddenTextMeasured) {
    const hiddenRatio = clamp01(signals.adversarial.hiddenTextRatio ?? 0);
    if (hiddenRatio > 0) {
      penalties.push({
        id: 'PEN_D08_HIDDEN_TEXT',
        ruleCode: 'PEN_D08_HIDDEN_TEXT',
        defectFingerprint: 'D08:HIDDEN_TEXT:VISIBLE_DOCUMENT',
        targetModuleId: D08_MODULE_ID,
        severity: hiddenRatio >= 0.10 ? 'HIGH' : 'MEDIUM',
        requestedDeduction: continuousPenalty(
          D08_CONFIG.hiddenTextPenaltyMax,
          hiddenRatio,
          D08_CONFIG.hiddenTextPenaltyScale,
        ),
        appliedDeduction: 0,
        evidenceIds: signals.adversarial.hiddenTextEvidenceIds,
        explanation: 'Wykryto tekst niewidoczny lub praktycznie niewidoczny dla człowieka.',
      });
    }
  }

  if (signals.adversarial.duplicateInvisibleLayerMeasured) {
    const duplicateRatio = clamp01(signals.adversarial.duplicateInvisibleLayerRatio ?? 0);
    if (duplicateRatio > 0) {
      penalties.push({
        id: 'PEN_D08_DUPLICATE_INVISIBLE_LAYER',
        ruleCode: 'PEN_D08_DUPLICATE_INVISIBLE_LAYER',
        defectFingerprint: 'D08:DUPLICATE_INVISIBLE_LAYER:DOCUMENT',
        targetModuleId: D08_MODULE_ID,
        severity: duplicateRatio >= 0.10 ? 'HIGH' : 'MEDIUM',
        requestedDeduction: continuousPenalty(
          D08_CONFIG.duplicateLayerPenaltyMax,
          duplicateRatio,
          D08_CONFIG.duplicateLayerPenaltyScale,
        ),
        appliedDeduction: 0,
        evidenceIds: signals.adversarial.duplicateLayerEvidenceIds,
        explanation: 'Wykryto niewidoczną zduplikowaną warstwę tekstową.',
      });
    }
  }

  return penalties;
}

function buildHardCaps(
  signals: D08Signals,
  text: TextLayerMeasurement | null,
  order: OrderMeasurement | null,
): HardCap[] {
  const caps: HardCap[] = [];

  if (
    signals.referenceProfile === 'SOURCE_AWARE' &&
    text?.recall !== null &&
    text?.recall !== undefined &&
    text.recall < D08_CONFIG.hardCaps.sourceRecallThreshold
  ) {
    caps.push({
      id: 'HC_D08_TEXT_LAYER_CRITICAL',
      ruleCode: 'HC_D08_TEXT_LAYER_CRITICAL',
      scope: 'MODULE',
      targetId: D08_MODULE_ID,
      capLimit: D08_CONFIG.hardCaps.sourceRecallCap,
      triggered: true,
      reason: `Ekstrakcja zachowała tylko ${(text.recall * 100).toFixed(1)}% referencyjnej masy tokenów.`,
      evidenceIds: signals.textLayer.evidenceIds,
    });
  }

  if (order && order.discordance > D08_CONFIG.hardCaps.readingOrderThreshold) {
    caps.push({
      id: 'HC_D08_READING_ORDER_CRITICAL',
      ruleCode: 'HC_D08_READING_ORDER_CRITICAL',
      scope: 'MODULE',
      targetId: D08_MODULE_ID,
      capLimit: D08_CONFIG.hardCaps.readingOrderCap,
      triggered: true,
      reason: `Ważona niezgodność kolejności odczytu wynosi ${(order.discordance * 100).toFixed(1)}%.`,
      evidenceIds: signals.readingOrder.evidenceIds,
    });
  }

  if (signals.encoding.weightedDamageRatio > D08_CONFIG.hardCaps.encodingThreshold) {
    caps.push({
      id: 'HC_D08_ENCODING_CRITICAL',
      ruleCode: 'HC_D08_ENCODING_CRITICAL',
      scope: 'MODULE',
      targetId: D08_MODULE_ID,
      capLimit: D08_CONFIG.hardCaps.encodingCap,
      triggered: true,
      reason: `Ważona masa nierozwiązanych uszkodzeń kodowania wynosi ${(signals.encoding.weightedDamageRatio * 100).toFixed(2)}%.`,
      evidenceIds: signals.encoding.evidenceIds,
    });
  }

  if (
    signals.adversarial.hiddenTextMeasured &&
    (signals.adversarial.hiddenTextRatio ?? 0) > D08_CONFIG.hardCaps.hiddenTextThreshold
  ) {
    const hiddenRatio = signals.adversarial.hiddenTextRatio ?? 0;
    caps.push({
      id: 'HC_D08_HIDDEN_TEXT_MASSIVE',
      ruleCode: 'HC_D08_HIDDEN_TEXT_MASSIVE',
      scope: 'MODULE',
      targetId: D08_MODULE_ID,
      capLimit: D08_CONFIG.hardCaps.hiddenTextCap,
      triggered: true,
      reason: `Znaczna część dokumentu (${(hiddenRatio * 100).toFixed(1)}%) jest niewidoczna dla człowieka.`,
      evidenceIds: signals.adversarial.hiddenTextEvidenceIds,
    });
  }

  return caps;
}

function buildRecommendations(hardCaps: HardCap[], penalties: Penalty[]): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (hardCaps.some((cap) => cap.ruleCode === 'HC_D08_READING_ORDER_CRITICAL')) {
    recommendations.push({
      id: 'REC_D08_FIX_READING_ORDER',
      targetModuleId: D08_MODULE_ID,
      targetSection: 'Layout',
      priority: 'CRITICAL',
      issue: 'Kolejność odczytu bloków jest istotnie zaburzona.',
      suggestedAction: 'Uprość topologię dokumentu lub popraw kolejność bloków tak, aby ekstrakcja zachowywała logiczny tok.',
      potentialScoreGainRange: { min: 0, max: 30 },
    });
  }

  if (hardCaps.some((cap) => cap.ruleCode === 'HC_D08_ENCODING_CRITICAL')) {
    recommendations.push({
      id: 'REC_D08_FIX_ENCODING',
      targetModuleId: D08_MODULE_ID,
      targetSection: 'Document',
      priority: 'CRITICAL',
      issue: 'Dokument zawiera znaczną liczbę nierozwiązanych uszkodzeń znaków.',
      suggestedAction: 'Wygeneruj dokument ponownie z poprawną warstwą Unicode i osadzonymi fontami.',
      potentialScoreGainRange: { min: 0, max: 25 },
    });
  }

  if (penalties.some((penalty) => penalty.ruleCode === 'PEN_D08_HIDDEN_TEXT')) {
    recommendations.push({
      id: 'REC_D08_REMOVE_HIDDEN_TEXT',
      targetModuleId: D08_MODULE_ID,
      targetSection: 'Document',
      priority: 'HIGH',
      issue: 'Wykryto niewidoczny tekst obecny w warstwie dokumentu.',
      suggestedAction: 'Usuń niewidoczne lub ukryte bloki tekstowe i pozostaw wyłącznie treść widoczną dla czytelnika.',
      potentialScoreGainRange: { min: 0, max: D08_CONFIG.hiddenTextPenaltyMax },
    });
  }

  return recommendations;
}

function insufficientResult(
  signals: D08Signals,
  code: string,
  message: string,
): AuditModuleResult {
  return {
    moduleId: D08_MODULE_ID,
    moduleName: D08_MODULE_NAME,
    domainId: 'DOCUMENT_QUALITY',
    score: null,
    confidence: 0,
    confidenceBreakdown: {
      coverage: 0,
      provenance: 0,
      extraction: 0,
      sample: 0,
      combined: 0,
    },
    applicability: 'INSUFFICIENT_DATA',
    evidence: signals.evidence,
    missingEvidence: [{
      id: `MISS_${code}`,
      requirementCode: code,
      targetScope: D08_MODULE_ID,
      description: message,
      severity: 'CRITICAL',
      expectedEvidenceWeight: 1,
      suggestedAction: 'Powtórz pomiar dokumentu. Nie interpretuj braku wyniku jako wady CV.',
    }],
    breakdown: [],
    penalties: [],
    hardCaps: [],
    ledger: null,
    verdictCode: code,
    verdict: message,
    recommendations: [],
  };
}

export function scoreStructuralReadability(signals: D08Signals): AuditModuleResult {
  if (!signals.measurementHealth.pipelineHealthy) {
    return insufficientResult(
      signals,
      signals.measurementHealth.failureCode ?? 'D08_MEASUREMENT_PIPELINE_FAILURE',
      signals.measurementHealth.failureMessage ?? 'Pipeline pomiarowy D08 nie dostarczył wiarygodnych sygnałów.',
    );
  }

  const text = textLayerMeasurement(signals);
  if (signals.textLayer.applicable && text === null) {
    return insufficientResult(
      signals,
      'D08_TEXT_LAYER_MEASUREMENT_MISSING',
      'Warstwa tekstowa powinna być mierzalna, ale brakuje danych potrzebnych do uczciwego pomiaru.',
    );
  }

  const order = readingOrderQuality(signals);
  const { breakdown, missingEvidence } = buildComponents(signals, text, order);
  if (breakdown.length === 0) {
    return insufficientResult(
      signals,
      'D08_NO_MEASURABLE_COMPONENTS',
      'Nie udało się uzyskać żadnego wiarygodnego komponentu strukturalnego.',
    );
  }

  const requestedPenalties = buildRequestedPenalties(signals);
  const penaltyResult = applyPenaltyBudget(requestedPenalties, {
    components: breakdown,
    modulePenaltyBudget: D08_CONFIG.hiddenTextPenaltyMax + D08_CONFIG.duplicateLayerPenaltyMax,
    maxPerDefectFingerprint: Math.max(
      D08_CONFIG.hiddenTextPenaltyMax,
      D08_CONFIG.duplicateLayerPenaltyMax,
    ),
  });
  const penalties = penaltyResult.penalties;
  const hardCaps = buildHardCaps(signals, text, order);
  const confidenceBreakdown = computeAuditConfidence(signals.confidenceInput);
  const ledger = buildScoreLedger({
    moduleId: D08_MODULE_ID,
    components: breakdown,
    penalties,
    hardCaps,
    confidenceBreakdown,
  });

  const hasHardNegativeEvidence = hardCaps.some((cap) => cap.triggered);
  if (confidenceBand(confidenceBreakdown.combined) === 'INSUFFICIENT' && !hasHardNegativeEvidence) {
    return {
      moduleId: D08_MODULE_ID,
      moduleName: D08_MODULE_NAME,
      domainId: 'DOCUMENT_QUALITY',
      score: null,
      confidence: confidenceBreakdown.combined,
      confidenceBreakdown,
      applicability: 'INSUFFICIENT_DATA',
      evidence: signals.evidence,
      missingEvidence,
      breakdown,
      penalties,
      hardCaps,
      ledger: null,
      verdictCode: 'D08_INSUFFICIENT_EVIDENCE',
      verdict: 'Pomiar ma zbyt niskie pokrycie dowodowe, aby uczciwie pokazać wynik liczbowy.',
      recommendations: buildRecommendations(hardCaps, penalties),
    };
  }

  const applicability = confidenceBand(confidenceBreakdown.combined) === 'LOW'
    ? 'PARTIALLY_APPLICABLE'
    : 'APPLICABLE';
  const score = ledger.finalScore;

  return {
    moduleId: D08_MODULE_ID,
    moduleName: D08_MODULE_NAME,
    domainId: 'DOCUMENT_QUALITY',
    score,
    confidence: confidenceBreakdown.combined,
    confidenceBreakdown,
    applicability,
    evidence: signals.evidence,
    missingEvidence,
    breakdown,
    penalties,
    hardCaps,
    ledger,
    verdictCode: hardCaps.some((cap) => cap.triggered)
      ? 'D08_TECHNICAL_HARD_CAP'
      : score !== null && score >= 85
        ? 'D08_STRONG_STRUCTURE'
        : score !== null && score >= 65
          ? 'D08_USABLE_WITH_ISSUES'
          : 'D08_STRUCTURAL_RISK',
    verdict: hardCaps.some((cap) => cap.triggered)
      ? 'Wykryto krytyczną techniczną wadę dokumentu ograniczającą wynik modułu.'
      : 'Wynik odzwierciedla wyłącznie techniczną czytelność i integralność struktury dokumentu.',
    recommendations: buildRecommendations(hardCaps, penalties),
  };
}
