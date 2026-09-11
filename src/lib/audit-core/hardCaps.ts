import type { HardCap, HardCapScope } from './contracts';

export function effectiveCap(
  caps: readonly HardCap[],
  scope: HardCapScope,
  targetId: string,
): number | null {
  const active = caps
    .filter((cap) => cap.triggered && cap.scope === scope && cap.targetId === targetId)
    .map((cap) => cap.capLimit)
    .filter((limit) => Number.isFinite(limit));
  return active.length > 0 ? Math.max(0, Math.min(100, Math.min(...active))) : null;
}

export function applyCap(score: number, cap: number | null): number {
  const boundedScore = Math.max(0, Math.min(100, score));
  return cap === null ? boundedScore : Math.min(boundedScore, cap);
}

export function triggeredCaps(caps: readonly HardCap[]): HardCap[] {
  return caps.filter((cap) => cap.triggered);
}

export function validateHardCaps(caps: readonly HardCap[]): string[] {
  const errors: string[] = [];
  for (const cap of caps) {
    if (!cap.id.trim()) errors.push('Hard cap bez id.');
    if (!cap.ruleCode.trim()) errors.push(`Hard cap ${cap.id || '<unknown>'} bez ruleCode.`);
    if (!Number.isFinite(cap.capLimit) || cap.capLimit < 0 || cap.capLimit > 100) {
      errors.push(`Hard cap ${cap.id} ma capLimit poza 0..100.`);
    }
    if (cap.triggered && cap.evidenceIds.length === 0 && (cap.missingEvidenceIds?.length ?? 0) === 0) {
      errors.push(`Triggered hard cap ${cap.id} nie wskazuje Evidence ani MissingEvidence.`);
    }
  }
  return errors;
}
