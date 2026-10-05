import { z } from 'zod';
import type { InterviewLoopSession } from '../types';

const stageSchema = z.enum(['INTRO', 'TECHNICAL', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'CANDIDATE_QA', 'WRAP_UP']);

const storySchema = z.object({
  id: z.string(), title: z.string(), situation: z.string(), task: z.string(), action: z.string(), result: z.string(),
  sourceEvidence: z.string().optional(), metrics: z.array(z.string()), tags: z.array(z.string()), projectId: z.string(),
  durationSec: z.number(),
}).passthrough();

const bridgeSchema = z.object({
  id: z.string(), missingSkill: z.string(), adjacentSkill: z.string(), relatedTopics: z.string(),
  bridgeExplanation: z.string(), talkingPoint: z.string(), evidenceFromVault: z.string().optional(),
}).passthrough();

const checklistItemSchema = z.object({
  id: z.string(), category: z.enum(['TECHNICAL', 'RESEARCH', 'ENVIRONMENT']), label: z.string(), completed: z.boolean(),
}).passthrough();

const liveNoteSchema = z.object({
  id: z.string(), timestamp: z.string(), stage: stageSchema, text: z.string(),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'CHALLENGING']).optional(),
}).passthrough();

const liveTrackerSchema = z.object({
  currentStage: stageSchema,
  startedAt: z.string().optional(),
  stageDurations: z.record(z.string(), z.number()).default({}),
  notes: z.array(liveNoteSchema),
  interviewerQuestions: z.array(z.string()),
}).passthrough();

const debriefSchema = z.object({
  overallRating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  whatWentWell: z.string(),
  trickyQuestions: z.array(z.string()),
  topicsToClarifyInFollowUp: z.string(),
  salaryTimelineNotes: z.string().optional(),
  generatedFollowUpEmail: z.string(),
  generatedFollowUpEmailVersion: z.literal(1).optional(),
  generatedFollowUpEmailVariantIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  legacyGeneratedFollowUpEmail: z.string().optional(),
  completedAt: z.string().optional(),
}).passthrough();

export const interviewLoopSessionSchema = z.object({
  id: z.string().min(1),
  jobOfferId: z.string().optional(),
  companyName: z.string(),
  roleTitle: z.string(),
  jdText: z.string().optional(),
  scheduledAt: z.string().optional(),
  status: z.enum(['UPCOMING', 'IN_PROGRESS', 'COMPLETED']),
  tags: z.array(z.string()).optional(),
  selectedStories: z.array(storySchema).optional(),
  selectedBridges: z.array(bridgeSchema).optional(),
  preCallChecklist: z.array(checklistItemSchema),
  liveTracker: liveTrackerSchema,
  postCallDebrief: debriefSchema.optional(),
  updatedAt: z.string(),
}).passthrough();

export interface InterviewLoopRecords {
  sessions: InterviewLoopSession[];
  invalidRecords: unknown[];
}

/** Oddziela renderowalne sesje od wadliwych wpisów, które muszą przetrwać kolejny zapis. */
export function parseInterviewLoopRecords(value: unknown): InterviewLoopRecords {
  const records = Array.isArray(value) ? value : [value];
  const sessions: InterviewLoopSession[] = [];
  const invalidRecords: unknown[] = [];
  for (const record of records) {
    const parsed = interviewLoopSessionSchema.safeParse(record);
    if (parsed.success) sessions.push(parsed.data as InterviewLoopSession);
    else invalidRecords.push(record);
  }
  return { sessions, invalidRecords };
}
