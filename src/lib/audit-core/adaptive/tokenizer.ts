const PLACEHOLDER_RE = /^\[(?:EMAIL|TELEFON|ADRES|LINKEDIN|KANDYDAT|RODO)_[A-ZĄĆĘŁŃÓŚŹŻ]+\]$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONEISH_RE = /^(?:\+?\d[\d\s().-]{6,}\d)$/;
const URL_RE = /^(?:https?:\/\/|www\.)/i;
const PURE_NUMBER_RE = /^\d+(?:[.,]\d+)?$/;

const SPECIAL_CANONICAL: Array<[RegExp, string]> = [
  [/\bc\+\+\b/gi, ' cpp '],
  [/\bc#\b/gi, ' csharp '],
  [/\b\.net\b/gi, ' dotnet '],
  [/\bnode\.js\b/gi, ' nodejs '],
  [/\breact\.js\b/gi, ' react '],
  [/\bvue\.js\b/gi, ' vue '],
  [/\bk8s\b/gi, ' kubernetes '],
];

export function normalizeAdaptiveText(input: string): string {
  let value = input.normalize('NFKC').toLocaleLowerCase('pl-PL');
  for (const [pattern, replacement] of SPECIAL_CANONICAL) value = value.replace(pattern, replacement);
  return value
    .replace(/[–—]/g, '-')
    .replace(/[“”„«»]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSafeAdaptiveToken(token: string): boolean {
  const value = token.trim();
  if (!value) return false;
  if (PLACEHOLDER_RE.test(value)) return false;
  if (EMAIL_RE.test(value) || PHONEISH_RE.test(value) || URL_RE.test(value)) return false;
  if (PURE_NUMBER_RE.test(value)) return false;
  if (value.length < 2 || value.length > 48) return false;
  if (/^[_-]+$/.test(value)) return false;
  return /[\p{L}]/u.test(value);
}

export function tokenizeAdaptiveText(input: string): string[] {
  const normalized = normalizeAdaptiveText(input)
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/[^\p{L}\p{N}+.#/-]+/gu, ' ');
  return normalized
    .split(/\s+/)
    .map((token) => token.replace(/^[+./-]+|[+./-]+$/g, ''))
    .filter(isSafeAdaptiveToken);
}

export function adaptiveMetaFeatures(input: string): string[] {
  const text = input.normalize('NFKC');
  const chars = [...text];
  const alpha = chars.filter((char) => /\p{L}/u.test(char)).length;
  const visible = chars.filter((char) => !/\s/.test(char)).length;
  const weird = chars.filter((char) => /[©®�|\\_=<>]/.test(char)).length;
  const digitInsideWord = (text.match(/[\p{L}]\d[\p{L}]|\d[\p{L}]{2,}|[\p{L}]{2,}\d/gu) ?? []).length;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const tinyLines = lines.filter((line) => line.length <= 3).length;
  const repeatedTokens = (() => {
    const tokens = tokenizeAdaptiveText(text);
    if (tokens.length < 8) return 0;
    const counts = new Map<string, number>();
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
    return [...counts.values()].filter((count) => count >= 5).reduce((sum, count) => sum + count, 0) / tokens.length;
  })();

  const features: string[] = [];
  const alphaRatio = visible > 0 ? alpha / visible : 0;
  const weirdRatio = visible > 0 ? weird / visible : 0;
  const tinyLineRatio = lines.length > 0 ? tinyLines / lines.length : 0;

  if (alphaRatio < 0.58) features.push('__meta_low_alpha_ratio__');
  if (weirdRatio > 0.02) features.push('__meta_weird_symbol_density__');
  if (digitInsideWord >= 2) features.push('__meta_leetspeak_or_ocr_substitution__');
  if (tinyLineRatio > 0.18) features.push('__meta_tiny_line_burst__');
  if (repeatedTokens > 0.22) features.push('__meta_repetition_burst__');
  if (text.length < 300) features.push('__meta_very_short_document__');
  if (text.length >= 300 && text.length < 700) features.push('__meta_short_document__');
  return features;
}

export function extractAdaptiveFeatures(input: string, maxNgram: 1 | 2 | 3 = 3): Set<string> {
  const tokens = tokenizeAdaptiveText(input);
  const result = new Set<string>(adaptiveMetaFeatures(input));
  for (let n = 1; n <= maxNgram; n += 1) {
    for (let index = 0; index <= tokens.length - n; index += 1) {
      const slice = tokens.slice(index, index + n);
      if (!slice.every(isSafeAdaptiveToken)) continue;
      result.add(slice.join(' '));
    }
  }
  return result;
}

export function adaptiveDocumentFingerprint(input: string): string {
  const canonical = normalizeAdaptiveText(input)
    .replace(/\[[^\]]+\]/g, '[redacted]')
    .replace(/\d+/g, '#');
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
