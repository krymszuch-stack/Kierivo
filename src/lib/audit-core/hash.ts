function stableStringify(value: unknown): string {
  if (value === undefined) return '"__undefined__"';
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return JSON.stringify(String(value));
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

export async function sha256Hex(input: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API jest wymagane do deterministycznych Evidence IDs.');
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
  const canonical = stableStringify(canonicalPayload);
  const digest = await sha256Hex(
    [schemaVersion, source, jsonPath, canonical, provenance].join('|'),
  );
  return `EV_${digest.slice(0, 20)}`;
}
