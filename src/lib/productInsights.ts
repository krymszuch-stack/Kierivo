import { readJson, readRaw, StorageKeys, writeJson, writeRaw } from './storage';

export type ProductInsightEvent =
  | 'advisor_opened'
  | 'advisor_suggestion_clicked'
  | 'career_article_opened';

export interface ProductInsights {
  version: 1;
  events: Record<ProductInsightEvent, number>;
}

const EMPTY_INSIGHTS: ProductInsights = {
  version: 1,
  events: {
    advisor_opened: 0,
    advisor_suggestion_clicked: 0,
    career_article_opened: 0,
  },
};

export function productInsightsEnabled(): boolean {
  return readRaw(StorageKeys.productInsightsEnabled) === 'true';
}

export function setProductInsightsEnabled(enabled: boolean): void {
  writeRaw(StorageKeys.productInsightsEnabled, String(enabled));
}

export function readProductInsights(): ProductInsights {
  const stored = readJson<ProductInsights | null>(StorageKeys.productInsights, null);
  if (!stored || stored.version !== 1) return EMPTY_INSIGHTS;

  return {
    version: 1,
    events: {
      ...EMPTY_INSIGHTS.events,
      ...stored.events,
    },
  };
}

/**
 * To są wyłącznie lokalne liczniki dobrowolnie włączone przez użytkownika.
 * Nie zawierają treści dokumentów, pytań, ofert, czasu ani identyfikatora i
 * nie wywołują API. Wysyłka telemetrii wymagałaby osobnej zgody i polityki.
 */
export function trackProductInsight(event: ProductInsightEvent): void {
  if (!productInsightsEnabled()) return;
  const current = readProductInsights();
  writeJson(StorageKeys.productInsights, {
    version: 1,
    events: {
      ...current.events,
      [event]: current.events[event] + 1,
    },
  });
}
