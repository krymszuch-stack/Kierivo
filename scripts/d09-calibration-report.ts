import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  evaluateD09PairwiseRanking,
  evaluateD09RequirementParser,
  evaluateD09UncertaintyCoverage,
  type D09BinaryMetrics,
} from '../src/lib/audit-core/d09/calibration';
import { extractD09Requirements } from '../src/lib/audit-core/d09/requirementParser';

const requirementSchema = z.object({
  canonicalId: z.string().min(1),
  priority: z.enum(['CORE_MUST', 'MUST', 'NICE']),
  kind: z.enum(['SKILL', 'DOMAIN', 'SOFT_SKILL', 'FORMAL_REFERENCE']),
});

const corpusSchema = z.object({
  schemaVersion: z.literal('d09-private-calibration-v1'),
  jobs: z.array(z.object({
    id: z.string().min(1),
    text: z.string().min(1),
    expectedRequirements: z.array(requirementSchema),
  })).default([]),
  rankings: z.array(z.object({
    jobId: z.string().min(1),
    observations: z.array(z.object({ id: z.string().min(1), score: z.number().min(0).max(100) })),
    expectedPairs: z.array(z.object({ betterId: z.string().min(1), worseId: z.string().min(1) })),
  })).default([]),
  uncertainty: z.array(z.object({
    low: z.number().min(0).max(100),
    high: z.number().min(0).max(100),
    referenceScore: z.number().min(0).max(100),
  })).default([]),
});

type AggregateCounts = { tp: number; fp: number; fn: number };

function emptyCounts(): AggregateCounts {
  return { tp: 0, fp: 0, fn: 0 };
}

function addMetrics(target: AggregateCounts, metrics: D09BinaryMetrics): void {
  target.tp += metrics.tp;
  target.fp += metrics.fp;
  target.fn += metrics.fn;
}

function finalize({ tp, fp, fn }: AggregateCounts): D09BinaryMetrics {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  return { tp, fp, fn, precision, recall, f1 };
}

function parseArgs(): { input: string; output?: string } {
  const args = process.argv.slice(2);
  const input = args.find((arg) => !arg.startsWith('--'));
  const outputFlag = args.find((arg) => arg.startsWith('--output='));
  if (!input) {
    throw new Error('Użycie: npm run audit:d09:calibrate -- <private-corpus.json> [--output=report.json]');
  }
  return {
    input: path.resolve(input),
    output: outputFlag ? path.resolve(outputFlag.slice('--output='.length)) : undefined,
  };
}

async function main(): Promise<void> {
  const { input, output } = parseArgs();
  const raw = JSON.parse(await readFile(input, 'utf8')) as unknown;
  const corpus = corpusSchema.parse(raw);

  const entityCounts = emptyCounts();
  const exactCounts = emptyCounts();
  const perJob: Array<{ id: string; entityF1: number; exactPriorityF1: number }> = [];

  for (const job of corpus.jobs) {
    const predicted = await extractD09Requirements(job.text);
    const report = evaluateD09RequirementParser(predicted, job.expectedRequirements);
    addMetrics(entityCounts, report.entity);
    addMetrics(exactCounts, report.exactPriority);
    perJob.push({
      id: job.id,
      entityF1: report.entity.f1,
      exactPriorityF1: report.exactPriority.f1,
    });
  }

  let comparablePairs = 0;
  let correctPairs = 0;
  let ties = 0;
  let inversions = 0;
  for (const ranking of corpus.rankings) {
    const report = evaluateD09PairwiseRanking(ranking.observations, ranking.expectedPairs);
    comparablePairs += report.comparablePairs;
    correctPairs += report.correctPairs;
    ties += report.ties;
    inversions += report.inversions;
  }

  const uncertainty = evaluateD09UncertaintyCoverage(corpus.uncertainty);
  const report = {
    schemaVersion: 'd09-calibration-report-v1',
    corpusSchemaVersion: corpus.schemaVersion,
    sourcePathRedacted: path.basename(input),
    counts: {
      jobs: corpus.jobs.length,
      rankingSets: corpus.rankings.length,
      uncertaintyObservations: corpus.uncertainty.length,
    },
    parser: {
      entity: finalize(entityCounts),
      exactPriority: finalize(exactCounts),
      perJob,
    },
    ranking: {
      comparablePairs,
      correctPairs,
      ties,
      inversions,
      pairwiseAccuracy: comparablePairs > 0 ? correctPairs / comparablePairs : 0,
    },
    uncertainty,
  };

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (output) {
    await writeFile(output, serialized, 'utf8');
    console.log(`D09 calibration report zapisany: ${output}`);
  } else {
    process.stdout.write(serialized);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
