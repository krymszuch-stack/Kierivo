import type { Penalty, ScoreComponent } from './contracts';

export interface PenaltyBudgetOptions {
  components: readonly ScoreComponent[];
  /** Maksymalny łączny budżet kar bez targetComponentId. */
  modulePenaltyBudget?: number;
  /** Opcjonalny limit jednej wady niezależnie od liczby reguł/evidence. */
  maxPerDefectFingerprint?: number;
}

export interface PenaltyApplicationResult {
  penalties: Penalty[];
  requestedTotal: number;
  appliedTotal: number;
  suppressedByBudget: number;
}

const nonNegative = (value: number): number => Math.max(0, Number.isFinite(value) ? value : 0);

/**
 * Centralny rejestr kar D07.
 *
 * 1. Ta sama wada (`defectFingerprint`) nie może być naliczana bez końca przez
 *    kilka reguł opisujących to samo zjawisko.
 * 2. Kary targetujące komponent nie mogą łącznie przekroczyć matematycznego
 *    budżetu tego komponentu (`maxContribution`).
 * 3. Kary modułowe bez komponentu mają osobny jawny budżet.
 */
export function applyPenaltyBudget(
  requestedPenalties: readonly Penalty[],
  options: PenaltyBudgetOptions,
): PenaltyApplicationResult {
  const componentBudget = new Map(
    options.components.map((component) => [component.id, nonNegative(component.maxContribution)]),
  );
  const componentUsed = new Map<string, number>();
  const defectUsed = new Map<string, number>();
  const moduleBudget = nonNegative(options.modulePenaltyBudget ?? 100);
  let moduleUsed = 0;

  const maxPerDefect = nonNegative(options.maxPerDefectFingerprint ?? 100);
  const penalties = [...requestedPenalties]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((penalty): Penalty => {
      const requested = nonNegative(penalty.requestedDeduction);
      const defectAlready = defectUsed.get(penalty.defectFingerprint) ?? 0;
      const defectAvailable = Math.max(0, maxPerDefect - defectAlready);

      let scopeAvailable: number;
      if (penalty.targetComponentId) {
        const budget = componentBudget.get(penalty.targetComponentId) ?? 0;
        const used = componentUsed.get(penalty.targetComponentId) ?? 0;
        scopeAvailable = Math.max(0, budget - used);
      } else {
        scopeAvailable = Math.max(0, moduleBudget - moduleUsed);
      }

      const appliedDeduction = Math.min(requested, defectAvailable, scopeAvailable);
      defectUsed.set(penalty.defectFingerprint, defectAlready + appliedDeduction);

      if (penalty.targetComponentId) {
        componentUsed.set(
          penalty.targetComponentId,
          (componentUsed.get(penalty.targetComponentId) ?? 0) + appliedDeduction,
        );
      } else {
        moduleUsed += appliedDeduction;
      }

      return { ...penalty, requestedDeduction: requested, appliedDeduction };
    });

  const requestedTotal = penalties.reduce((sum, penalty) => sum + penalty.requestedDeduction, 0);
  const appliedTotal = penalties.reduce((sum, penalty) => sum + penalty.appliedDeduction, 0);
  return {
    penalties,
    requestedTotal,
    appliedTotal,
    suppressedByBudget: Math.max(0, requestedTotal - appliedTotal),
  };
}
