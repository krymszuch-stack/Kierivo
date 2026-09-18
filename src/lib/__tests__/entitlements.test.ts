import { describe, it, expect, beforeEach } from 'vitest';
import {
  isProStatus,
  consumeAiLocally,
  FREE_MONTHLY_IMPORTS,
  FREE_DAILY_AI_USES,
  setAuthenticatedEntitlements,
  resetEntitlementsToUnauthenticated,
  getEntitlementsState,
} from '../../store/useEntitlements';
import { StorageKeys, writeJson, wipeAppStorage } from '../storage';

describe('useEntitlements i isProStatus', () => {
  beforeEach(() => {
    wipeAppStorage();
    resetEntitlementsToUnauthenticated();
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

  it('consumeAiLocally dla stanu unauthenticated zwraca false i nie zmienia limitu', () => {
    resetEntitlementsToUnauthenticated();
    const canConsume = consumeAiLocally();
    expect(canConsume).toBe(false);
    expect(getEntitlementsState().usage.aiUses).toBe(0);
    expect(getEntitlementsState().source).toBe('unauthenticated');
  });

  it('po zalogowaniu consumeAiLocally zmniejsza licznik z 25 na 24', () => {
    setAuthenticatedEntitlements({ status: 'free' }, { aiUses: 25 });
    expect(getEntitlementsState().usage.aiUses).toBe(25);
    expect(getEntitlementsState().source).toBe('server');

    const canConsume = consumeAiLocally();
    expect(canConsume).toBe(true);
    expect(getEntitlementsState().usage.aiUses).toBe(24);
  });

  it('resetEntitlementsToUnauthenticated po stanie 24/25 czyści licznik i ustawia stan unauthenticated', () => {
    setAuthenticatedEntitlements({ status: 'free' }, { aiUses: 24 });
    expect(getEntitlementsState().usage.aiUses).toBe(24);

    resetEntitlementsToUnauthenticated();
    expect(getEntitlementsState().source).toBe('unauthenticated');
    expect(getEntitlementsState().usage.aiUses).toBe(0);
    expect(consumeAiLocally()).toBe(false);
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
