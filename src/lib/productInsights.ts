import { readJson, readRaw, StorageKeys, writeJson, writeRaw } from './storage';
import {
  parseProductInsights,
  type ProductInsightEvent,
  type ProductInsights,
} from './productInsightsSchema';
export type { ProductInsightEvent, ProductInsights } from './productInsightsSchema';

export function productInsightsEnabled(): boolean {
  return readRaw(StorageKeys.productInsightsEnabled) === 'true';
}

export function setProductInsightsEnabled(enabled: boolean): void {
  writeRaw(StorageKeys.productInsightsEnabled, String(enabled));
}

export function readProductInsights(): ProductInsights {
  return parseProductInsights(readJson<unknown>(StorageKeys.productInsights, null));
}

/**
 * To są wyłącznie lokalne liczniki dobrowolnie włączone przez użytkownika.
 * Nie zawierają treści dokumentów, pytań, ofert, czasu ani identyfikatora i
 * nie wywołują API. Wysyłka telemetrii wymagałaby osobnej zgody i polityki.
 */
export function trackProductInsight(event: ProductInsightEvent): void {
  if (!productInsightsEnabled()) return;
  const current = readProductInsights();
  const count = current.events[event];
  if (count >= Number.MAX_SAFE_INTEGER) return;
  writeJson(StorageKeys.productInsights, {
    version: 1,
    events: {
      ...current.events,
      [event]: count + 1,
    },
  });
}
