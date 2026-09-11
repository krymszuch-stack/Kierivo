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
  const canonical = JSON.stringify(canonicalPayload, Object.keys(canonicalPayload as object).sort());
  const digest = await sha256Hex(
    [schemaVersion, source, jsonPath, canonical, provenance].join('|'),
  );
  return `EV_${digest.slice(0, 20)}`;
}
