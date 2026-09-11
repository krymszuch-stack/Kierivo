import type {
  ConfidenceBreakdown,
  HardCap,
  Penalty,
  ScoreComponent,
  ScoreLedger,
} from './contracts';
import { effectiveCap } from './hardCaps';

const round = (value: number): number => Math.round(value * 1e10) / 1e10;

export interface BuildScoreLedgerInput {
  moduleId: string;
  components: readonly ScoreComponent[];
  penalties: readonly Penalty[];
  hardCaps: readonly HardCap[];
  confidenceBreakdown: ConfidenceBreakdown;
}

export function buildScoreLedger(input: BuildScoreLedgerInput): ScoreLedger {
  const componentTotal = round(
    input.components.reduce((sum, component) => sum + component.contribution, 0),
  );
  const penaltyTotal = round(
    input.penalties.reduce((sum, penalty) => sum + Math.max(0, penalty.appliedDeduction), 0),
  );
  const scoreAfterPenalties = round(Math.max(0, componentTotal - penaltyTotal));
  const cap = effectiveCap(input.hardCaps, 'MODULE', input.moduleId);
  const finalScore = round(cap === null ? scoreAfterPenalties : Math.min(scoreAfterPenalties, cap));

  const equationText = cap === null
    ? `${componentTotal} - ${penaltyTotal} = ${finalScore}`
    : `min(${componentTotal} - ${penaltyTotal}, ${cap}) = ${finalScore}`;

  return {
    moduleId: input.moduleId,
    componentTotal,
    penaltyTotal,
    scoreAfterPenalties,
    effectiveCap: cap,
    finalScore,
    equationText,
    componentRows: input.components.map((component) => ({
      componentId: component.id,
      name: component.name,
      earned: round(component.contribution),
      maximum: round(component.maxContribution),
      unrealized: round(component.unrealizedPotential),
      effectiveWeight: component.effectiveWeight,
      evidenceIds: [...component.evidenceIds],
    })),
    penaltyRows: input.penalties.map((penalty) => ({
      penaltyId: penalty.id,
      ruleCode: penalty.ruleCode,
      requestedDeduction: penalty.requestedDeduction,
      appliedDeduction: penalty.appliedDeduction,
      defectFingerprint: penalty.defectFingerprint,
      evidenceIds: [...penalty.evidenceIds],
    })),
    capRows: input.hardCaps.map((capRow) => ({
      capId: capRow.id,
      ruleCode: capRow.ruleCode,
      scope: capRow.scope,
      capLimit: capRow.capLimit,
      triggered: capRow.triggered,
      reason: capRow.reason,
      evidenceIds: [...capRow.evidenceIds],
      missingEvidenceIds: [...(capRow.missingEvidenceIds ?? [])],
    })),
    confidenceBreakdown: input.confidenceBreakdown,
  };
}

export function validateScoreLedger(
  ledger: ScoreLedger,
  score: number | null,
): string[] {
  const errors: string[] = [];
  const componentSum = round(ledger.componentRows.reduce((sum, row) => sum + row.earned, 0));
  const penaltySum = round(ledger.penaltyRows.reduce((sum, row) => sum + row.appliedDeduction, 0));
  const expectedAfter = round(Math.max(0, ledger.componentTotal - ledger.penaltyTotal));
  const expectedFinal = ledger.effectiveCap === null
    ? expectedAfter
    : round(Math.min(expectedAfter, ledger.effectiveCap));

  if (Math.abs(componentSum - ledger.componentTotal) > 1e-8) {
    errors.push('Suma componentRows nie zgadza się z componentTotal.');
  }
  if (Math.abs(penaltySum - ledger.penaltyTotal) > 1e-8) {
    errors.push('Suma penaltyRows nie zgadza się z penaltyTotal.');
  }
  if (Math.abs(ledger.scoreAfterPenalties - expectedAfter) > 1e-8) {
    errors.push('scoreAfterPenalties nie odpowiada równaniu runtime.');
  }
  if (ledger.finalScore === null || Math.abs(ledger.finalScore - expectedFinal) > 1e-8) {
    errors.push('finalScore nie odpowiada komponentom, karom i capowi.');
  }
  if (score === null || ledger.finalScore === null || Math.abs(score - ledger.finalScore) > 1e-8) {
    errors.push('Score modułu nie zgadza się z finalScore w ledgerze.');
  }
  for (const row of ledger.componentRows) {
    if (row.evidenceIds.length === 0) errors.push(`Komponent ${row.componentId} nie ma Evidence ID.`);
  }
  for (const row of ledger.penaltyRows) {
    if (row.evidenceIds.length === 0) errors.push(`Penalty ${row.penaltyId} nie ma Evidence ID.`);
  }
  for (const row of ledger.capRows.filter((item) => item.triggered)) {
    if (row.evidenceIds.length === 0 && row.missingEvidenceIds.length === 0) {
      errors.push(`Hard cap ${row.capId} nie ma źródła decyzji.`);
    }
  }
  return errors;
}
