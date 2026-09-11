import { describe, it, expect } from 'vitest';
import {
  auditGeneratedLemmas,
  auditGeneratedMetrics,
  auditReframedBullet,
} from '../services/truthFilter';
import { createEmptyVault } from '../../lib/sampleVault';

/**
 * F11: normalizacja diacrytów bez furtki i bez wrzasku na narrację.
 */
describe('truthFilter — diakrytyki i metryki (F11)', () => {
  it.each([
    ['księgowość', 'ksiegowosc'],
    ['KSIĘGOWOŚĆ', 'ksiegowosc'],
    ['pracowałem', 'pracowalem'],
    ['łódź', 'lodz'],
  ])('%s ≡ %s w audycie', (a, b) => {
    const r1 = auditGeneratedLemmas({ generatedText: `Znam ${a}.`, sourceText: 'Pracowałem w biurze.' });
    const r2 = auditGeneratedLemmas({ generatedText: `Znam ${b}.`, sourceText: 'Pracowałem w biurze.' });
    expect(r1.unknownLemmas.length > 0).toBe(r2.unknownLemmas.length > 0);
  });

  it('polskie kompetencje z diakrytykami nie omijają audytu', () => {
    const r = auditGeneratedLemmas({
      generatedText: 'Zaimplementowałem księgowość i obsługę kadr.',
      sourceText: 'Pracowałem w biurze.',
      vault: createEmptyVault('Jan', 'jan@example.com'),
    });
    expect(r.unknownLemmas).toContain('ksiegowosc');
  });

  it('zwykła narracja nie jest „nieznanym lemem"', () => {
    const r = auditGeneratedLemmas({
      generatedText: 'Zrealizowałem projekt z wynikiem opisanym w źródle.',
      sourceText: 'Zrealizowałem projekt z wynikiem opisanym w źródle.',
      vault: createEmptyVault('Jan', 'jan@example.com'),
    });
    expect(r.unknownLemmas).not.toContain('wynikiem');
  });

  it('metryki: `40%` ≡ `40 %` ≡ `40 procent`', () => {
    expect(auditGeneratedMetrics('Wzrost o 40%.', 'Wzrost o 40 %.').fabricatedMetrics).toEqual([]);
    expect(auditGeneratedMetrics('Wzrost o 40 procent.', 'Wzrost o 40%.').fabricatedMetrics).toEqual([]);
    expect(auditGeneratedMetrics('Wzrost o 40% i 5 mln.', 'Wzrost o 40%.').fabricatedMetrics).toContain('5 mln');
  });

  it('iniekcja techniczna nadal FAIL', () => {
    const v = auditReframedBullet({
      generatedText: 'Zrealizowałem migrację w Rust z wynikiem 40% wzrostu.',
      originalBullet: 'Testowałem aplikację webową.',
      vault: createEmptyVault('Jan', 'jan@example.com'),
    });
    expect(v.verdict).toBe('FAIL');
    expect(v.unknownLemmas).toContain('rust');
  });
});
