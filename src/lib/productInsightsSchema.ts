import { z } from 'zod';

export const PRODUCT_INSIGHT_EVENTS = [
  'advisor_opened',
  'advisor_suggestion_clicked',
  'career_article_opened',
] as const;

export type ProductInsightEvent = (typeof PRODUCT_INSIGHT_EVENTS)[number];

export interface ProductInsights {
  version: 1;
  events: Record<ProductInsightEvent, number>;
}

const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).catch(0).default(0);

const storedProductInsightsSchema = z.object({
  version: z.literal(1),
  events: z.object({
    advisor_opened: countSchema,
    advisor_suggestion_clicked: countSchema,
    career_article_opened: countSchema,
  }).passthrough(),
}).passthrough();

export function emptyProductInsights(): ProductInsights {
  return {
    version: 1,
    events: {
      advisor_opened: 0,
      advisor_suggestion_clicked: 0,
      career_article_opened: 0,
    },
  };
}

/** Poprawne liczniki zachowuje osobno; wadliwe wartości wracają do zera. */
export function parseProductInsights(value: unknown): ProductInsights {
  const parsed = storedProductInsightsSchema.safeParse(value);
  if (!parsed.success) return emptyProductInsights();

  return {
    version: 1,
    events: {
      advisor_opened: parsed.data.events.advisor_opened,
      advisor_suggestion_clicked: parsed.data.events.advisor_suggestion_clicked,
      career_article_opened: parsed.data.events.career_article_opened,
    },
  };
}
