import { adaptiveDocumentFingerprint } from './tokenizer';
import type { AdaptiveCorpusDocument } from './types';

export interface ScoreDistributionHealth {
  count: number;
  uniqueValues: number;
  min: number | null;
  max: number | null;
  median: number | null;
  mean: number | null;
  populationStdDev: number | null;
  collapsed: boolean;
}

export interface AdaptiveCorpusHealth {
  totalDocuments: number;
  uniqueDocuments: number;
  duplicateDocuments: number;
  duplicateRate: number;
  labelCardinality: Record<string, number>;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function scoreDistributionHealth(values: readonly number[]): ScoreDistributionHealth {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) {
    return {
      count: 0,
      uniqueValues: 0,
      min: null,
      max: null,
      median: null,
      mean: null,
      populationStdDev: null,
      collapsed: true,
    };
  }
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length;
  const uniqueValues = new Set(finite.map((value) => Number(value.toFixed(6)))).size;
  return {
    count: finite.length,
    uniqueValues,
    min: Math.min(...finite),
    max: Math.max(...finite),
    median: median(finite),
    mean,
    populationStdDev: Math.sqrt(variance),
    collapsed: uniqueValues <= Math.max(1, Math.floor(Math.sqrt(finite.length) / 2)) || variance < 1e-8,
  };
}

export function auditAdaptiveCorpusHealth(documents: readonly AdaptiveCorpusDocument[]): AdaptiveCorpusHealth {
  const fingerprints = new Map<string, number>();
  const labelCardinality: Record<string, number> = {};
  for (const document of documents) {
    const fingerprint = adaptiveDocumentFingerprint(document.text);
    fingerprints.set(fingerprint, (fingerprints.get(fingerprint) ?? 0) + 1);
    for (const label of new Set(document.labels)) {
      labelCardinality[label] = (labelCardinality[label] ?? 0) + 1;
    }
  }
  const uniqueDocuments = fingerprints.size;
  const duplicateDocuments = Math.max(0, documents.length - uniqueDocuments);
  return {
    totalDocuments: documents.length,
    uniqueDocuments,
    duplicateDocuments,
    duplicateRate: documents.length > 0 ? duplicateDocuments / documents.length : 0,
    labelCardinality,
  };
}
