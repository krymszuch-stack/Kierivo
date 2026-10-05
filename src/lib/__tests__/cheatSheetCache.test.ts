import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStorage } from './helpers/memoryStorage';
import { cheatSheetCacheKeyFor, readRaw, writeJson } from '../storage';
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

const wpis = (): CheatSheetEnrichment => ({
  starTalkingPoints: [{
    relatedRequirement: 'React',
    situation: 'Syntetyczna sytuacja',
    task: 'Syntetyczne zadanie',
    action: 'Syntetyczne działanie',
    result: 'Syntetyczny rezultat',
  }],
  personalizedFraming: 'Syntetyczne uzasadnienie',
  emergencyPhrases: [{ scenario: 'Brak odpowiedzi', phrasePL: 'Poproszę o chwilę na namysł.' }],
});

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

  it('zapisany wpis da się odczytać po tym samym skrócie', async () => {
    const hash = await hashCheatSheetInput({} as never, 'tytuł', 'firma', 'opis');
    writeCachedEnrichment(hash, wpis());

    expect(readCachedEnrichment(hash)).toEqual(wpis());
  });

  it('różne oferty nie współdzielą cache przez kolizję prostego skrótu 32-bitowego', async () => {
    const vault = {} as never;
    const hashAa = await hashCheatSheetInput(vault, 'Aa', 'Firma', 'Opis');
    const hashBB = await hashCheatSheetInput(vault, 'BB', 'Firma', 'Opis');

    expect(hashAa).not.toBe(hashBB);
  });

  it('odrzuca i usuwa uszkodzoną strukturę cache zamiast zwracać ją jako wzbogacenie', () => {
    const hash = 'h-broken';
    const key = cheatSheetCacheKeyFor(hash);
    writeJson(key, {
      hash,
      enrichment: {},
      cachedAt: new Date().toISOString(),
    });

    expect(readCachedEnrichment(hash)).toBeNull();
    expect(readRaw(key)).toBeNull();
  });

  it('nie używa poprawnego cache envelope pod obcym skrótem', () => {
    const hash = 'h-requested';
    const key = cheatSheetCacheKeyFor(hash);
    writeJson(key, {
      hash: 'h-another-offer',
      enrichment: wpis(),
      cachedAt: new Date().toISOString(),
    });

    expect(readCachedEnrichment(hash)).toBeNull();
    expect(readRaw(key)).toBeNull();
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
