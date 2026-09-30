import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStorage } from './helpers/memoryStorage';
import { cheatSheetCacheKeyFor, readRaw } from '../storage';
import { api } from '../apiClient';
import { MasterVault } from '../../types';
import {
  generateCheatSheetEnrichmentWithAI,
  hashCheatSheetInput,
  readCachedEnrichment,
  writeCachedEnrichment,
} from '../interviewCheatSheetEngine';
import { CheatSheetEnrichment } from '../interviewCheatSheetEngine';

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

const wpis = () => ({}) as unknown as CheatSheetEnrichment;

function kluczeCache(): string[] {
  const wyniki: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(`${cheatSheetCacheKeyFor('')}`)) wyniki.push(key);
  }
  return wyniki;
}

describe('cache spersonalizowanej ściągi', () => {
  it('bez jawnej zgody nie uruchamia wysyłki do AI', async () => {
    const post = vi.spyOn(api, 'post');

    await expect(generateCheatSheetEnrichmentWithAI(
      'Rola testowa', 'Firma testowa', 'Syntetyczna oferta.', {} as MasterVault, [], false
    )).rejects.toThrow('Potwierdź wysłanie');

    expect(post).not.toHaveBeenCalled();
    post.mockRestore();
  });

  it('zapisany wpis da się odczytać po tym samym skrócie', () => {
    const hash = hashCheatSheetInput({} as never, 'tytuł', 'firma', 'opis');
    writeCachedEnrichment(hash, wpis());

    expect(readCachedEnrichment(hash)).toEqual({});
  });

  it('po przekroczeniu limitu wypadają najstarsze wpisy, nie najnowsze', () => {
    for (let i = 0; i < 25; i++) {
      writeCachedEnrichment(`h${i}`, wpis());
    }

    const klucze = kluczeCache();
    expect(klucze.length).toBe(20);

    // Remis znaczników czasu rozstrzyga klucz, więc przy wpisach z tej samej
    // milisekundy wypadają te wstawione najwcześniej — ostatnio pisana oferta
    // musi przetrwać.
    expect(readRaw(cheatSheetCacheKeyFor('h24'))).not.toBeNull();
    expect(readRaw(cheatSheetCacheKeyFor('h0'))).toBeNull();
  });
});
