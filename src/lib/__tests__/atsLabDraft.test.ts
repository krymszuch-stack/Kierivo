import { beforeEach, describe, expect, it } from 'vitest';
import { loadAtsLabDraft, saveAtsLabDraft } from '../atsLabDraft';
import { MemoryStorage } from './helpers/memoryStorage';
import { profileDataKeyFor, resetLastGoodCache, StorageKeys, writeJson } from '../storage';

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

  it('pomija wadliwe pola szkicu, ale zachowuje poprawne pole drugiego typu', () => {
    writeJson(profileDataKeyFor(StorageKeys.draftAtsLab, 'profile-a'), {
      jd: { unexpected: 'object' },
      role: 'Support Engineer',
    });

    expect(loadAtsLabDraft('profile-a')).toEqual({ role: 'Support Engineer' });
  });

  it('zwraca pusty szkic zamiast rzutować wadliwy korzeń JSON na obiekt', () => {
    writeJson(profileDataKeyFor(StorageKeys.draftAtsLab, 'profile-a'), ['not', 'a', 'draft']);

    expect(loadAtsLabDraft('profile-a')).toEqual({});
  });
});
