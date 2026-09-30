import { beforeEach, describe, expect, it } from 'vitest';
import { loadAtsLabDraft, saveAtsLabDraft } from '../atsLabDraft';
import { MemoryStorage } from './helpers/memoryStorage';
import { resetLastGoodCache } from '../storage';

describe('szkic Audytu ATS', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
    resetLastGoodCache();
  });

  it('nie pokazuje oferty ani stanowiska drugiemu profilowi', () => {
    saveAtsLabDraft('profile-a', { jd: 'Prywatna oferta testowa', role: 'Rola testowa' });

    expect(loadAtsLabDraft('profile-a')).toEqual({ jd: 'Prywatna oferta testowa', role: 'Rola testowa' });
    expect(loadAtsLabDraft('profile-b')).toEqual({});
  });
});
