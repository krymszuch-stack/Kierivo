import { z } from 'zod';
import type { MasterVaultEmbeddedData } from './portableCvExtractor';

const text = z.string();
const textList = z.array(text);
const extensibleObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();

const bulletSchema = extensibleObject({
  kind: z.enum(['result', 'duty']).optional(),
  display: text.optional(),
  semantic: text.optional(),
  text: text.optional(),
});

const resumeDataSchema = extensibleObject({
  name: text.optional(),
  title: text.optional(),
  initials: text.optional(),
  contact: extensibleObject({
    phone: text.optional(),
    email: text.optional(),
    city: text.optional(),
    linkedin: text.optional(),
    github: text.optional(),
    www: text.optional(),
  }).optional(),
  summary: z.union([
    text,
    extensibleObject({ display: text.optional(), semantic: text.optional() }),
  ]).optional(),
  skills: z.array(z.union([
    text,
    extensibleObject({
      label: text.optional(),
      semantic: text.optional(),
      group: text.optional(),
      weight: z.number().optional(),
    }),
  ])).optional(),
  experience: z.array(extensibleObject({
    role: text.optional(),
    company: text.optional(),
    location: text.optional(),
    start: text.optional(),
    end: text.optional(),
    bullets: z.array(bulletSchema).optional(),
    tech: textList.optional(),
  })).optional(),
  education: z.array(extensibleObject({
    degree: text.optional(),
    school: text.optional(),
    start: text.optional(),
    end: text.optional(),
    note: text.optional(),
  })).optional(),
  certifications: z.array(extensibleObject({
    name: text.optional(),
    issuer: text.optional(),
    year: text.optional(),
    semantic: text.optional(),
  })).optional(),
  languages: z.array(extensibleObject({ name: text.optional(), level: text.optional() })).optional(),
  licenses: textList.optional(),
  clause: text.optional(),
  projects: z.array(extensibleObject({
    name: text.optional(),
    role: text.optional(),
    description: text.optional(),
    techStack: textList.optional(),
    metrics: text.optional(),
  })).optional(),
});

const portableCvSchema = extensibleObject({
  masterVaultRecord: extensibleObject({
    source: text.optional(),
    version: text.optional(),
    resumeData: resumeDataSchema.optional(),
  }).optional(),
  jsonLd: z.record(z.string(), z.unknown()).optional(),
});

/** Nie ufa typom TypeScript po JSON.parse; nieznane pola zachowuje dla zgodności w przód. */
export function parsePortableCvData(value: unknown): MasterVaultEmbeddedData | null {
  const parsed = portableCvSchema.safeParse(value);
  return parsed.success ? parsed.data as MasterVaultEmbeddedData : null;
}
