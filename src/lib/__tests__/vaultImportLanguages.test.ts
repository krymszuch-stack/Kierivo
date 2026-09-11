import { describe, expect, it } from 'vitest';
import { createEmptyVault } from '../sampleVault';
import { mergeImportedVault } from '../vaultImportMerge';

describe('mergeImportedVault languages', () => {
  it('pusta lista z importu nie usuwa wcześniej zapisanych języków', () => {
    const prev = createEmptyVault();
    prev.profiler.languages = [
      { id: 'lang-en', language: 'Angielski', level: 'B2' },
    ];

    const merged = mergeImportedVault(prev, {
      profiler: { ...prev.profiler, languages: [] },
    });

    expect(merged.profiler.languages).toEqual(prev.profiler.languages);
  });

  it('powtórny język nie tworzy duplikatu mimo różnic w wielkości liter i spacjach', () => {
    const prev = createEmptyVault();
    prev.profiler.languages = [
      { id: 'lang-en-old', language: 'Angielski', level: 'B2' },
    ];

    const merged = mergeImportedVault(prev, {
      profiler: {
        ...prev.profiler,
        languages: [
          { id: 'lang-en-new', language: '  angielski ', level: 'C1' },
          { id: 'lang-es', language: 'Hiszpański', level: 'B1' },
        ],
      },
    });

    expect(merged.profiler.languages).toHaveLength(2);
    expect(merged.profiler.languages.map((item) => item.language)).toEqual([
      'Angielski',
      'Hiszpański',
    ]);
    expect(merged.profiler.languages[0].id).toBe('lang-en-old');
  });
});
