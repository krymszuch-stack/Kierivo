import { z } from 'zod';
import type { MasterVault } from '../types';

const text = z.string();
const textList = z.array(text);
const extensible = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();

const locationPreferencesSchema = extensible({
  city: text,
  radiusKm: z.number().finite(),
  willingnessToTravel: z.boolean(),
  hybridWork: z.boolean(),
  remoteOnly: z.boolean(),
  relocationReady: z.boolean().optional(),
  commuteRadiusKm: z.number().finite().optional(),
});

const profilerSchema = extensible({
  flags: z.array(z.enum(['PHYSICAL', 'OFFICE_IT', 'CASUAL', 'REMOTE'])),
  experienceLevel: z.enum(['ENTRY', 'MID', 'SENIOR', 'PIVOT']),
  careerGoal: z.enum(['FIRST_JOB', 'EXPERIENCED_ROLE', 'MORE_RESPONSIBLE', 'CAREER_CHANGE', 'SIDE_OR_CASUAL', 'UNDECIDED']).optional(),
  experienceYears: z.enum(['NONE', 'UP_TO_2', '2_TO_5', 'OVER_5']).optional(),
  independenceLevel: z.enum(['TRAINEE', 'AUTONOMOUS', 'COORDINATOR']).optional(),
  industryChangeReady: z.boolean().optional(),
  autoDetermineSeniority: z.boolean().optional(),
  location: locationPreferencesSchema,
  languages: z.array(extensible({
    id: text,
    language: text,
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Native']),
    context: text,
  })),
  licenses: textList.optional(),
  subRoleId: text.optional(),
});

const personalInfoSchema = extensible({
  fullName: text,
  firstName: text.optional(),
  middleName: text.optional(),
  lastName: text.optional(),
  email: text,
  phone: text,
  location: text,
  linkedin: text.optional(),
  github: text.optional(),
  website: text.optional(),
  photoUrl: text.optional(),
  title: text,
  summary: text,
  rodoClause: text.optional(),
  gdprClause: text.optional(),
});

const vaultSchema = extensible({
  schemaVersion: z.number().int().positive().optional(),
  version: text,
  updatedAt: text,
  profiler: profilerSchema,
  personalInfo: personalInfoSchema,
  skillsMatrix: extensible({
    hardSkills: textList,
    softSkills: textList,
    toolsAndTech: textList,
    certifications: z.array(extensible({
      id: text,
      name: text,
      issuer: text,
      date: text.optional(),
      url: text.optional(),
    })),
  }),
  history: z.array(extensible({
    id: text,
    company: text,
    role: text,
    location: text,
    startDate: text,
    endDate: text,
    isCurrent: z.boolean(),
    description: text.optional(),
    highlights: z.array(extensible({
      id: text,
      text,
      action: text,
      target: text,
      tool: text,
      metric: text,
      keywords: textList,
    })),
  })),
  education: z.array(extensible({
    id: text,
    institution: text,
    degree: text,
    fieldOfStudy: text,
    startDate: text,
    endDate: text,
    description: text.optional(),
  })),
  projects: z.array(extensible({
    id: text,
    name: text,
    role: text,
    description: text,
    techStack: textList,
    metrics: text.optional(),
    link: text.optional(),
  })),
  claims: z.array(extensible({
    id: text,
    sourceProject: text,
    dateRange: z.union([text, extensible({ start: text, end: text })]).optional(),
    metric: text.optional(),
    tags: textList,
  })).optional(),
  mobilityPreferences: extensible({
    salaryAmount: z.number().finite(),
    contract: z.enum(['UOP', 'B2B']),
    workMode: z.enum(['REMOTE', 'HYBRID', 'ONSITE']),
    officeDaysPerWeek: z.number().finite(),
    oneWayMinutes: z.number().finite(),
    monthlyCommuteCost: z.number().finite(),
    homeCity: text.optional(),
    officeCity: text.optional(),
    roadDistanceKm: z.number().finite().optional(),
    vehicleEngineType: z.enum(['combustion', 'electric', 'transit']).optional(),
    trafficMode: z.enum(['peak', 'smooth']).optional(),
  }).optional(),
});

/** Import przyjmuje pełny kształt MasterVault; częściowe dane nie mogą nadpisać działającego profilu. */
export function parseMasterVaultImport(value: unknown): MasterVault | null {
  const parsed = vaultSchema.safeParse(value);
  return parsed.success ? parsed.data as MasterVault : null;
}
