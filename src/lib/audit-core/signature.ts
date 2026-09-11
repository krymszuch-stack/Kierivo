import type { AuditMode, MonthIndex } from './contracts';
import { sha256Hex, stableStringify } from './hash';

export interface AuditIntegritySignatureInput {
  engineVersion: string;
  auditMode: AuditMode;
  referenceMonth: MonthIndex;
  canonicalSignals: unknown;
  moduleConfigVersions: Record<string, string>;
  corpusSchemaVersion: string;
}

export async function buildAuditIntegritySignature(
  input: AuditIntegritySignatureInput,
): Promise<string> {
  const canonical = stableStringify({
    engineVersion: input.engineVersion,
    auditMode: input.auditMode,
    referenceMonth: input.referenceMonth,
    canonicalSignals: input.canonicalSignals,
    moduleConfigVersions: input.moduleConfigVersions,
    corpusSchemaVersion: input.corpusSchemaVersion,
  });
  const digest = await sha256Hex(canonical);
  return `AUD_${digest}`;
}
