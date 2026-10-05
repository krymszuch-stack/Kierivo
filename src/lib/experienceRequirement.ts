export const EXPERIENCE_COMPARISONS = ['at_least', 'more_than', 'at_most', 'less_than'] as const;
export type ExperienceComparison = typeof EXPERIENCE_COMPARISONS[number];

export function isExperienceRequirementSatisfied(actualYears: number, years: number, comparison: ExperienceComparison = 'at_least'): boolean {
  switch (comparison) {
    case 'at_least': return actualYears >= years;
    case 'more_than': return actualYears > years;
    case 'at_most': return actualYears <= years;
    case 'less_than': return actualYears < years;
  }
}

export function isUnconditionalExperienceRequirement(requirement: { years: number; comparison?: ExperienceComparison }): boolean {
  return requirement.years === 0 && (requirement.comparison ?? 'at_least') === 'at_least';
}

export function experienceRequirementScore(actualYears: number, years: number, comparison: ExperienceComparison = 'at_least'): number {
  // Proporcja do minimum ma sens dla dolnej granicy włącznie. Przy maksimum
  // i ścisłej nierówności stosujemy wynik spełnia/nie spełnia; odwrócenie
  // proporcji albo arbitralne 99% na granicy dawałoby pozorną precyzję.
  return comparison === 'at_least' && years > 0
    ? Math.min(1, actualYears / years) * 100
    : isExperienceRequirementSatisfied(actualYears, years, comparison) ? 100 : 0;
}

export function formatExperienceRequirementLabel(years: number, scopeText: string | null = null, comparison: ExperienceComparison = 'at_least'): string {
  const lastTwo = years % 100;
  const last = years % 10;
  const unit = !Number.isInteger(years) ? 'roku' : years === 1 ? 'rok' : lastTwo >= 12 && lastTwo <= 14 ? 'lat' : last >= 2 && last <= 4 ? 'lata' : 'lat';
  const prefix: Record<ExperienceComparison, string> = { at_least: 'Min.', more_than: 'Ponad', at_most: 'Maks.', less_than: 'Mniej niż' };
  return `${prefix[comparison]} ${String(years).replace('.', ',')} ${unit} doświadczenia${scopeText ? ` (${scopeText})` : ''}`;
}
