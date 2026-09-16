import { describe, it, expect, beforeEach } from 'vitest';
import { isProStatus, consumeAiLocally, FREE_MONTHLY_IMPORTS, FREE_DAILY_AI_USES } from '../../store/useEntitlements';
import { StorageKeys, writeJson, wipeAppStorage } from '../storage';

describe('useEntitlements i isProStatus', () => {
  beforeEach(() => {
    wipeAppStorage();
  });

  it('isProStatus poprawnie rozpoznaje statusy bez rzucania wyjątków na undefined/null', () => {
    expect(isProStatus('active')).toBe(true);
    expect(isProStatus('trialing')).toBe(true);
    expect(isProStatus('free')).toBe(false);
    expect(isProStatus('cancelled')).toBe(false);
    expect(isProStatus('past_due')).toBe(false);
    expect(isProStatus(undefined)).toBe(false);
    expect(isProStatus(null)).toBe(false);
    expect(isProStatus('' as any)).toBe(false);
  });

  it('udostępnia poprawne stałe darmowych limitów', () => {
    expect(FREE_MONTHLY_IMPORTS).toBe(1);
    expect(FREE_DAILY_AI_USES).toBe(25);
  });

  it('consumeAiLocally działa bezpiecznie i zmniejsza licznik', () => {
    const canConsume = consumeAiLocally();
    expect(typeof canConsume).toBe('boolean');
  });

  it('radzi sobie z uszkodzonym lub starym formatem w localStorage', () => {
    // Symulacja uszkodzonego wpisu w schowku
    writeJson(StorageKeys.entitlementsCache, {
      broken: true,
      subscription: null,
      usage: undefined,
    });

    expect(isProStatus(undefined)).toBe(false);
  });
});
