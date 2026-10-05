/** Założenia rocznego uśrednienia wynagrodzenia z jednej umowy o pracę. */
export interface PayrollEstimateAssumptions {
  taxYear: number;
  employeePensionRate: number;
  employeeDisabilityRate: number;
  employeeSicknessRate: number;
  healthRate: number;
  monthlyStandardDeductibleCosts: number;
  annualPensionDisabilityContributionCap: number;
  firstTaxBandLimit: number;
  firstTaxRate: number;
  secondTaxRate: number;
  annualTaxReduction: number;
}

/** Stawki i limity zweryfikowane dla 2026 r.; aktualizuj wraz z rokiem podatkowym. */
export const POLISH_PAYROLL_2026: PayrollEstimateAssumptions = {
  taxYear: 2026,
  employeePensionRate: 0.0976,
  employeeDisabilityRate: 0.015,
  employeeSicknessRate: 0.0245,
  healthRate: 0.09,
  monthlyStandardDeductibleCosts: 250,
  annualPensionDisabilityContributionCap: 282_600,
  firstTaxBandLimit: 120_000,
  firstTaxRate: 0.12,
  secondTaxRate: 0.32,
  annualTaxReduction: 3_600,
};

/**
 * Szacuje średnią miesięczną wypłatę netto przy stałej pensji przez pełny rok.
 * Model zakłada jednego pracodawcę, podstawowe KUP, pełne PIT-2, brak innych
 * dochodów opodatkowanych skalą, ulg, PPK i zmiennych składników wynagrodzenia.
 * Roczne uśrednienie obejmuje oba progi PIT oraz limit składek emerytalno-rentowych.
 */
export function estimateAverageMonthlyUopNet(
  monthlyGross: number,
  assumptions: PayrollEstimateAssumptions = POLISH_PAYROLL_2026,
): number {
  if (!Number.isFinite(monthlyGross) || monthlyGross <= 0) return 0;

  const annualGross = monthlyGross * 12;
  if (!Number.isFinite(annualGross) || annualGross > Number.MAX_SAFE_INTEGER) return 0;

  const pensionAndDisabilityBase = Math.min(
    annualGross,
    assumptions.annualPensionDisabilityContributionCap,
  );
  const annualSocialContributions =
    pensionAndDisabilityBase * (assumptions.employeePensionRate + assumptions.employeeDisabilityRate) +
    annualGross * assumptions.employeeSicknessRate;
  const annualHealthContribution = (annualGross - annualSocialContributions) * assumptions.healthRate;
  const annualTaxBase = Math.max(
    0,
    Math.round(annualGross - annualSocialContributions - assumptions.monthlyStandardDeductibleCosts * 12),
  );
  const annualTaxBeforeReduction = annualTaxBase <= assumptions.firstTaxBandLimit
    ? annualTaxBase * assumptions.firstTaxRate
    : assumptions.firstTaxBandLimit * assumptions.firstTaxRate +
      (annualTaxBase - assumptions.firstTaxBandLimit) * assumptions.secondTaxRate;
  const annualTax = Math.max(0, Math.round(annualTaxBeforeReduction - assumptions.annualTaxReduction));
  const averageMonthlyNet =
    (annualGross - annualSocialContributions - annualHealthContribution - annualTax) / 12;

  return Number.isFinite(averageMonthlyNet) ? Math.max(0, Math.round(averageMonthlyNet * 100) / 100) : 0;
}
