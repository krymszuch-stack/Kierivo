import { describe, expect, it } from 'vitest';
import {
  analyzeD08Encoding,
  computeD08TokenAgreement,
  computeD08WeightedOrderStats,
  normalizeD08Text,
  tokenizeD08Text,
} from '../audit-core/d08/extractor';

describe('D08 extractor — token agreement', () => {
  it('NFKC normalizuje ligatury i whitespace deterministycznie', () => {
    expect(normalizeD08Text('  ﬁrma\r\n  test\t')).toBe('firma\n test');
  });

  it('identyczny tekst daje precision/recall/F1 równe 1', () => {
    const result = computeD08TokenAgreement(
      'Python SQL administracja Microsoft 365',
      'Python SQL administracja Microsoft 365',
    );

    expect(result.precision).toBe(1);
    expect(result.recall).toBe(1);
    expect(result.f1).toBe(1);
  });

  it('duplikowany tekst obniża precision bez obniżania recall', () => {
    const result = computeD08TokenAgreement(
      'Python SQL',
      'Python SQL Python SQL',
    );

    expect(result.recall).toBe(1);
    expect(result.precision).toBe(0.5);
    expect(result.f1).toBeCloseTo(2 / 3, 12);
  });

  it('utracony tekst obniża recall', () => {
    const result = computeD08TokenAgreement(
      'Python SQL Excel Linux',
      'Python SQL',
    );

    expect(result.precision).toBe(1);
    expect(result.recall).toBe(0.5);
  });

  it('tokenizer zachowuje typowe tokeny technologiczne', () => {
    expect(tokenizeD08Text('C++ C# Node.js user@example.com')).toEqual([
      'c++',
      'c#',
      'node.js',
      'user@example.com',
    ]);
  });
});

describe('D08 extractor — weighted order', () => {
  it('identyczny porządek ma discordance 0', () => {
    const stats = computeD08WeightedOrderStats(
      ['a', 'b', 'c', 'd'],
      ['a', 'b', 'c', 'd'],
    );

    expect(stats.discordance).toBe(0);
    expect(stats.discordantPairWeight).toBe(0);
    expect(stats.comparablePairWeight).toBe(6);
  });

  it('odwrócony porządek ma discordance 1', () => {
    const stats = computeD08WeightedOrderStats(
      ['a', 'b', 'c'],
      ['c', 'b', 'a'],
    );

    expect(stats.discordance).toBe(1);
  });

  it('wagi par pozwalają mocniej liczyć relacje semantycznie ważne', () => {
    const stats = computeD08WeightedOrderStats(
      ['header', 'role', 'bullet'],
      ['role', 'header', 'bullet'],
      (before, after) => before === 'header' && after === 'role' ? 5 : 1,
    );

    expect(stats.comparablePairWeight).toBe(7);
    expect(stats.discordantPairWeight).toBe(5);
    expect(stats.discordance).toBeCloseTo(5 / 7, 12);
  });
});

describe('D08 extractor — encoding', () => {
  it('prawidłowe polskie znaki nie są anomalią', () => {
    const analysis = analyzeD08Encoding('Łódź, doświadczenie, źródło, zażółć gęślą jaźń');

    expect(analysis.anomalies).toHaveLength(0);
    expect(analysis.weightedDamageRatio).toBe(0);
  });

  it('ligatura rozwiązywana przez NFKC nie jest karana', () => {
    const analysis = analyzeD08Encoding('ﬁrma i efektywność');

    expect(analysis.normalizedText).toContain('firma');
    expect(analysis.anomalies).toHaveLength(0);
  });

  it('replacement char i mojibake tworzą dodatnią masę uszkodzeń', () => {
    const analysis = analyzeD08Encoding('DoÅ›wiadczenie � zawodowe');

    expect(analysis.weightedDamageMass).toBeGreaterThan(0);
    expect(analysis.weightedDamageRatio).toBeGreaterThan(0);
    expect(analysis.anomalies.some((item) => item.type === 'REPLACEMENT_CHAR')).toBe(true);
    expect(analysis.anomalies.some((item) => item.type === 'MOJIBAKE_SEQUENCE')).toBe(true);
  });

  it('dekoracyjny private-use char jest łagodniejszy niż private-use wewnątrz słowa', () => {
    const decorative = analyzeD08Encoding('Kontakt \uE000 email');
    const lexical = analyzeD08Encoding('kont\uE000akt');

    expect(decorative.anomalies[0]?.weightedSeverity).toBe(0.1);
    expect(lexical.anomalies[0]?.weightedSeverity).toBe(0.8);
  });
});
