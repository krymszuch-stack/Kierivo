import { z } from 'zod';
import { StorageKeys, profileDataKeyFor, readJson, removeRaw, writeJson } from './storage';

const drillScorecardSchema = z.object({
  structure: z.object({
    hasSituation: z.boolean(),
    hasTask: z.boolean(),
    hasAction: z.boolean(),
    hasResult: z.boolean(),
    detectedElementsCount: z.number().int().min(0).max(4),
    scorePercent: z.number().finite().min(0).max(100).nullable(),
  }).passthrough(),
  metrics: z.object({
    hasMetrics: z.boolean(),
    detectedMetrics: z.array(z.string()),
  }).passthrough(),
  ownership: z.object({
    iCount: z.number().int().nonnegative(),
    weCount: z.number().int().nonnegative(),
  }).passthrough(),
  overallScore: z.number().finite().min(0).max(100).nullable(),
  suggestions: z.array(z.string()),
}).passthrough();

const drillAttemptSchema = z.object({
  id: z.string().min(1),
  questionId: z.string(),
  questionText: z.string(),
  transcript: z.string(),
  durationSec: z.number().finite().nonnegative(),
  scorecard: drillScorecardSchema,
  recordedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
}).passthrough();

export interface DrillScorecard {
  structure: {
    hasSituation: boolean;
    hasTask: boolean;
    hasAction: boolean;
    hasResult: boolean;
    detectedElementsCount: number;
    scorePercent: number | null;
  };
  metrics: { hasMetrics: boolean; detectedMetrics: string[] };
  ownership: { iCount: number; weCount: number };
  /** Starsze wyniki są niekalibrowane; bieżąca heurystyka pozostawia tę wartość pustą. */
  overallScore: number | null;
  suggestions: string[];
}

export interface DrillAttemptRecord {
  id: string;
  questionId: string;
  questionText: string;
  transcript: string;
  durationSec: number;
  scorecard: DrillScorecard;
  recordedAt: string;
}

export interface DrillHistoryRecords {
  attempts: DrillAttemptRecord[];
  invalidRecords: unknown[];
}

/** Oddziela renderowalne próby od surowych wpisów, których nie wolno zgubić przy następnym zapisie. */
export function parseDrillHistoryRecords(value: unknown): DrillHistoryRecords {
  const records = Array.isArray(value) ? value : [value];
  const attempts: DrillAttemptRecord[] = [];
  const invalidRecords: unknown[] = [];

  for (const record of records) {
    const parsed = drillAttemptSchema.safeParse(record);
    if (parsed.success) attempts.push(parsed.data as DrillAttemptRecord);
    else invalidRecords.push(record);
  }

  return { attempts, invalidRecords };
}

export function loadDrillHistory(profileId: string): DrillAttemptRecord[] {
  const key = profileDataKeyFor(StorageKeys.drillHistory, profileId);
  return parseDrillHistoryRecords(readJson<unknown>(key, [])).attempts;
}

export function saveDrillAttempt(profileId: string, attempt: DrillAttemptRecord): void {
  const parsedAttempt = drillAttemptSchema.safeParse(attempt);
  if (!parsedAttempt.success) return;

  const key = profileDataKeyFor(StorageKeys.drillHistory, profileId);
  const existing = parseDrillHistoryRecords(readJson<unknown>(key, []));
  const attempts = [
    parsedAttempt.data as DrillAttemptRecord,
    ...existing.attempts.filter((record) => record.id !== parsedAttempt.data.id),
  ].slice(0, 50);

  // Wadliwy stary zapis ukrywamy w UI, ale zachowujemy przy edycji poprawnej historii.
  writeJson(key, [...attempts, ...existing.invalidRecords]);
}

/** Jawne czyszczenie historii usuwa również zachowane, nierenderowalne wpisy. */
export function clearDrillHistory(profileId: string): void {
  removeRaw(profileDataKeyFor(StorageKeys.drillHistory, profileId));
}
