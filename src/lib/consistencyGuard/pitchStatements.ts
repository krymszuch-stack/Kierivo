import type { Claim } from './types';

/** Opisuje tylko metrykę i tagi zapisane przy claimie; nie wnioskuje o biegłości ani wykonanej pracy. */
export function describeProfileClaim(claim: Pick<Claim, 'sourceProject' | 'metric' | 'tags'>): string {
  const details = [
    claim.metric?.trim() ? `metrykę: „${claim.metric.trim()}”` : '',
    claim.tags.length ? `tagi wpisu: ${claim.tags.slice(0, 3).join(', ')}` : '',
  ].filter(Boolean);

  if (details.length === 0) return `W profilu znajduje się wpis „${claim.sourceProject}”.`;
  return `W profilu przy wpisie „${claim.sourceProject}” zapisano ${details.join('; ')}.`;
}
