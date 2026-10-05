import { describe, expect, it } from 'vitest';
import { AI_QUOTA_RESET_TIME, FREE_DAILY_AI_USES, getAiQuotaDayKeyUtc } from '../aiQuotaPolicy';

describe('wspolna polityka dobowego limitu AI', () => {
  it('udostępnia jeden limit oraz jawny czas odnowienia', () => {
    expect(FREE_DAILY_AI_USES).toBe(25);
    expect(AI_QUOTA_RESET_TIME).toBe('00:00 UTC');
  });

  it('zmienia klucz dnia dokładnie o północy UTC, niezależnie od strefy przeglądarki', () => {
    expect(getAiQuotaDayKeyUtc(new Date('2026-10-02T23:59:59.999Z'))).toBe('2026-10-02');
    expect(getAiQuotaDayKeyUtc(new Date('2026-10-03T00:00:00.000Z'))).toBe('2026-10-03');
    // W Warszawie jest już 00:30, ale serwerowy licznik nadal należy do 2 października UTC.
    expect(getAiQuotaDayKeyUtc(new Date('2026-10-03T00:30:00+02:00'))).toBe('2026-10-02');
  });
});
