import { z } from 'zod';

const draftFieldSchema = z.string();

export interface AtsLabDraft {
  jd?: string;
  role?: string;
}

/** Usuwa tylko uszkodzone pola szkicu, zachowując poprawną część wpisu. */
export function parseAtsLabDraft(value: unknown): AtsLabDraft {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};

  const record = value as Record<string, unknown>;
  const jd = draftFieldSchema.safeParse(record.jd);
  const role = draftFieldSchema.safeParse(record.role);

  return {
    ...(jd.success ? { jd: jd.data } : {}),
    ...(role.success ? { role: role.data } : {}),
  };
}
