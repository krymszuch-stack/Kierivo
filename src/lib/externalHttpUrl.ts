/** Zwraca wyłącznie poprawny adres HTTP(S) nadający się do bezpiecznego linku. */
export function normalizeExternalHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2048) return undefined;

  try {
    const url = new URL(value.trim());
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return undefined;
    if (url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
