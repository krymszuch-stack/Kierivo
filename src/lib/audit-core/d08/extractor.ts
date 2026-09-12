export interface D08TokenAgreement {
  sourceTokenCount: number;
  extractedTokenCount: number;
  matchedTokenCount: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface D08OrderStats {
  comparablePairWeight: number;
  discordantPairWeight: number;
  discordance: number;
}

export type D08EncodingAnomalyType =
  | 'REPLACEMENT_CHAR'
  | 'MOJIBAKE_SEQUENCE'
  | 'PRIVATE_USE_INSIDE_TOKEN'
  | 'PRIVATE_USE_DECORATIVE';

export interface D08EncodingAnomaly {
  type: D08EncodingAnomalyType;
  index: number;
  weightedSeverity: number;
}

export interface D08EncodingAnalysis {
  normalizedText: string;
  lexicalCharacterCount: number;
  weightedDamageMass: number;
  weightedDamageRatio: number;
  anomalies: D08EncodingAnomaly[];
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function normalizeD08Text(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

export function tokenizeD08Text(text: string): string[] {
  const normalized = normalizeD08Text(text).toLocaleLowerCase('pl-PL');
  if (!normalized) return [];

  return normalized
    .split(/[^\p{L}\p{N}+#./@_-]+/gu)
    .map((token) => token.trim())
    .filter(Boolean);
}

function multisetCounts(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

export function computeD08TokenAgreement(
  sourceText: string,
  extractedText: string,
): D08TokenAgreement {
  const sourceTokens = tokenizeD08Text(sourceText);
  const extractedTokens = tokenizeD08Text(extractedText);
  const sourceCounts = multisetCounts(sourceTokens);
  const extractedCounts = multisetCounts(extractedTokens);

  let matchedTokenCount = 0;
  for (const [token, sourceCount] of sourceCounts) {
    matchedTokenCount += Math.min(sourceCount, extractedCounts.get(token) ?? 0);
  }

  const precision = extractedTokens.length > 0
    ? matchedTokenCount / extractedTokens.length
    : 0;
  const recall = sourceTokens.length > 0
    ? matchedTokenCount / sourceTokens.length
    : 0;
  const denominator = precision + recall;
  const f1 = denominator > 0 ? (2 * precision * recall) / denominator : 0;

  return {
    sourceTokenCount: sourceTokens.length,
    extractedTokenCount: extractedTokens.length,
    matchedTokenCount,
    precision: clamp01(precision),
    recall: clamp01(recall),
    f1: clamp01(f1),
  };
}

export function computeD08WeightedOrderStats(
  expectedOrder: string[],
  extractedOrder: string[],
  pairWeight?: (beforeId: string, afterId: string) => number,
): D08OrderStats {
  const extractedPositions = new Map<string, number>();
  extractedOrder.forEach((id, index) => {
    if (!extractedPositions.has(id)) extractedPositions.set(id, index);
  });

  let comparablePairWeight = 0;
  let discordantPairWeight = 0;

  for (let i = 0; i < expectedOrder.length; i += 1) {
    const beforeId = expectedOrder[i];
    const beforePosition = extractedPositions.get(beforeId);
    if (beforePosition === undefined) continue;

    for (let j = i + 1; j < expectedOrder.length; j += 1) {
      const afterId = expectedOrder[j];
      const afterPosition = extractedPositions.get(afterId);
      if (afterPosition === undefined) continue;

      const rawWeight = pairWeight ? pairWeight(beforeId, afterId) : 1;
      const weight = Number.isFinite(rawWeight) ? Math.max(0, rawWeight) : 0;
      if (weight === 0) continue;

      comparablePairWeight += weight;
      if (beforePosition > afterPosition) discordantPairWeight += weight;
    }
  }

  return {
    comparablePairWeight,
    discordantPairWeight,
    discordance: comparablePairWeight > 0
      ? clamp01(discordantPairWeight / comparablePairWeight)
      : 0,
  };
}

function isLexicalCharacter(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}

const MOJIBAKE_MARKERS = ['Ã', 'Å', 'Â', 'â€', 'â€™', 'â€“', 'â€œ', 'â€ť'];

export function analyzeD08Encoding(rawText: string): D08EncodingAnalysis {
  const normalizedText = normalizeD08Text(rawText);
  const lexicalCharacterCount = Array.from(normalizedText)
    .filter((char) => /[\p{L}\p{N}]/u.test(char)).length;

  const anomalies: D08EncodingAnomaly[] = [];
  const chars = Array.from(rawText);

  chars.forEach((char, index) => {
    const codePoint = char.codePointAt(0) ?? 0;
    if (char === '\uFFFD') {
      anomalies.push({
        type: 'REPLACEMENT_CHAR',
        index,
        weightedSeverity: 1,
      });
      return;
    }

    if (codePoint >= 0xE000 && codePoint <= 0xF8FF) {
      const insideToken = isLexicalCharacter(chars[index - 1]) || isLexicalCharacter(chars[index + 1]);
      anomalies.push({
        type: insideToken ? 'PRIVATE_USE_INSIDE_TOKEN' : 'PRIVATE_USE_DECORATIVE',
        index,
        weightedSeverity: insideToken ? 0.8 : 0.1,
      });
    }
  });

  for (const marker of MOJIBAKE_MARKERS) {
    let start = 0;
    while (start < rawText.length) {
      const index = rawText.indexOf(marker, start);
      if (index < 0) break;
      anomalies.push({
        type: 'MOJIBAKE_SEQUENCE',
        index,
        weightedSeverity: 1,
      });
      start = index + marker.length;
    }
  }

  const weightedDamageMass = anomalies.reduce(
    (sum, anomaly) => sum + anomaly.weightedSeverity,
    0,
  );
  const weightedDamageRatio = weightedDamageMass / Math.max(1, lexicalCharacterCount);

  return {
    normalizedText,
    lexicalCharacterCount,
    weightedDamageMass,
    weightedDamageRatio,
    anomalies,
  };
}
