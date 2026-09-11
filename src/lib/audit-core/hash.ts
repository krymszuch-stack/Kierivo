function stableStringifyInternal(value: unknown): string {
  if (value === undefined) return '"__undefined__"';
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return JSON.stringify(String(value));
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringifyInternal(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringifyInternal(record[key])}`)
    .join(',')}}`;
}

export function stableStringify(value: unknown): string {
  return stableStringifyInternal(value);
}

export async function sha256Hex(input: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API jest wymagane do deterministycznych identyfikatorów Audit Core.');
  }
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildEvidenceId(
  schemaVersion: string,
  source: string,
  jsonPath: string,
  canonicalPayload: unknown,
  provenance: string,
): Promise<string> {
  const digest = await sha256Hex(
    [schemaVersion, source, jsonPath, stableStringify(canonicalPayload), provenance].join('|'),
  );
  return `EV_${digest.slice(0, 20)}`;
}

export async function buildDefectFingerprint(
  ruleFamily: string,
  canonicalEntityId: string,
  canonicalDefectType: string,
): Promise<string> {
  const digest = await sha256Hex(
    [ruleFamily, canonicalEntityId, canonicalDefectType].join('|'),
  );
  return `DF_${digest.slice(0, 20)}`;
}
