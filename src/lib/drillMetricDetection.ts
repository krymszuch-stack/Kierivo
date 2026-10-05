import { classifyNumericContext, numericContextWeight } from './audit-core/adaptive/numericContext';

const METRIC_CANDIDATE = /\d+(?:[.,]\d+)?(?:\s*(?:%|zł|zl|pln|usd|eur|tps|lcp|ms|dni|godz(?:iny|in)?|min(?:uty|ut)?|s|szt\.?|km|kg|ton|incydent(?:y|ów)?|wypadk(?:i|ów)?|zgłosze(?:nia|ń)))?/gi;
const YEAR = /^(?:19|20)\d{2}$/;

/**
 * Sama cyfra nie jest metryką: może być rokiem, wersją albo fragmentem opisu.
 * Zwracamy tylko liczby, których lokalny kontekst wskazuje skalę lub rezultat.
 */
export function detectDrillMetrics(text: string): string[] {
  const matches = Array.from(text.matchAll(METRIC_CANDIDATE));
  const detected = matches.flatMap((match) => {
    const value = match[0].trim();
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const numericPart = value.match(/^\d+(?:[.,]\d+)?/)?.[0] ?? '';
    if (!value || YEAR.test(numericPart)) return [];

    const leftBoundary = Math.max(
      text.lastIndexOf('\n', start),
      text.lastIndexOf('.', start),
      text.lastIndexOf('!', start),
      text.lastIndexOf('?', start),
      text.lastIndexOf(';', start),
    ) + 1;
    const boundaryCandidates = [
      text.indexOf('\n', end),
      text.indexOf('.', end),
      text.indexOf('!', end),
      text.indexOf('?', end),
      text.indexOf(';', end),
    ].filter((index) => index >= 0);
    const rightBoundary = boundaryCandidates.length > 0
      ? Math.min(...boundaryCandidates)
      : text.length;
    const context = text.slice(leftBoundary, rightBoundary);
    const classification = classifyNumericContext(value, context);

    return numericContextWeight(classification) >= 0.5 ? [value] : [];
  });

  return Array.from(new Set(detected));
}
