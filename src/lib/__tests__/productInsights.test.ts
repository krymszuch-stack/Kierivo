import { beforeEach, describe, expect, it } from 'vitest';
import { readProductInsights, setProductInsightsEnabled, trackProductInsight } from '../productInsights';
import { MemoryStorage } from './helpers/memoryStorage';
import { resetLastGoodCache, StorageKeys, writeJson } from '../storage';

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  resetLastGoodCache();
});

describe('lokalne liczniki dobrowolnej analityki', () => {
  it('zeruje tylko wadliwe liczniki i zachowuje poprawne wartości', () => {
    writeJson(StorageKeys.productInsights, {
      version: 1,
      events: {
        advisor_opened: 3,
        advisor_suggestion_clicked: '4',
        career_article_opened: -1,
      },
    });

    expect(readProductInsights().events).toEqual({
      advisor_opened: 3,
      advisor_suggestion_clicked: 0,
      career_article_opened: 0,
    });
  });

  it('nie dodaje jeden do tekstowego licznika ani nie przekracza bezpiecznego zakresu', () => {
    setProductInsightsEnabled(true);
    writeJson(StorageKeys.productInsights, {
      version: 1,
      events: {
        advisor_opened: '4',
        advisor_suggestion_clicked: Number.MAX_SAFE_INTEGER,
        career_article_opened: 2,
      },
    });

    trackProductInsight('advisor_opened');
    trackProductInsight('advisor_suggestion_clicked');

    expect(readProductInsights().events).toEqual({
      advisor_opened: 1,
      advisor_suggestion_clicked: Number.MAX_SAFE_INTEGER,
      career_article_opened: 2,
    });
  });

  it('zwraca zera dla nieobsługiwanej wersji lub wadliwego korzenia', () => {
    writeJson(StorageKeys.productInsights, { version: 2, events: { advisor_opened: 900 } });
    expect(readProductInsights().events.advisor_opened).toBe(0);

    writeJson(StorageKeys.productInsights, null);
    const firstRead = readProductInsights();
    firstRead.events.advisor_opened = 900;
    expect(readProductInsights().events).toEqual({
      advisor_opened: 0,
      advisor_suggestion_clicked: 0,
      career_article_opened: 0,
    });
  });
});
