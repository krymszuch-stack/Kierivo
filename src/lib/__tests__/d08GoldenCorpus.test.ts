import { describe, expect, it } from 'vitest';
import { D08_GOLDEN_CORPUS, getD08GoldenCase } from '../audit-core/d08/goldenCorpus';
import { scoreStructuralReadability } from '../audit-core/d08/strictScorer';

const score = (id: string): number => {
  const result = scoreStructuralReadability(getD08GoldenCase(id).signals);
  if (result.score === null) throw new Error(`${id} zwrócił score=null`);
  return result.score;
};

describe('D08 golden corpus — kompletność i stabilność numeryczna', () => {
  it('zawiera dokładnie 20 bazowych archetypów D08 v2', () => {
    expect(D08_GOLDEN_CORPUS).toHaveLength(20);
    expect(new Set(D08_GOLDEN_CORPUS.map((item) => item.id)).size).toBe(20);
  });

  it('każdy archetyp daje skończone komponenty i zgodny ledger', () => {
    for (const fixture of D08_GOLDEN_CORPUS) {
      const result = scoreStructuralReadability(fixture.signals);

      expect(result.score, fixture.id).not.toBeNull();
      expect(Number.isFinite(result.score!), fixture.id).toBe(true);
      expect(result.score!, fixture.id).toBeGreaterThanOrEqual(0);
      expect(result.score!, fixture.id).toBeLessThanOrEqual(100);
      expect(result.ledger, fixture.id).not.toBeNull();
      expect(result.ledger!.finalScore, fixture.id).toBe(result.score);

      for (const component of result.breakdown) {
        expect(Number.isFinite(component.normalizedValue), `${fixture.id}:${component.id}`).toBe(true);
        expect(component.normalizedValue, `${fixture.id}:${component.id}`).toBeGreaterThanOrEqual(0);
        expect(component.normalizedValue, `${fixture.id}:${component.id}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('zadeklarowane hard capy są rzeczywiście uruchamiane', () => {
    for (const fixture of D08_GOLDEN_CORPUS) {
      if (!fixture.expectedHardCaps?.length) continue;
      const result = scoreStructuralReadability(fixture.signals);
      const active = new Set(result.hardCaps.filter((cap) => cap.triggered).map((cap) => cap.ruleCode));
      for (const expected of fixture.expectedHardCaps) {
        expect(active.has(expected), `${fixture.id} powinien uruchomić ${expected}`).toBe(true);
      }
    }
  });
});

describe('D08 golden corpus — relacje normatywne', () => {
  it('safe 2-column i safe 3-column nie są karane względem clean 1-column', () => {
    const single = score('D08_01_CLEAN_SINGLE_COLUMN');
    const two = score('D08_02_CLEAN_TWO_COLUMN_ORDER_SAFE');
    const three = score('D08_04_THREE_COLUMN_ORDER_SAFE');

    expect(Math.abs(single - two)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(single - three)).toBeLessThanOrEqual(0.001);
  });

  it('realny interleaving jest zdecydowanie gorszy od bezpiecznego układu kolumnowego', () => {
    expect(score('D08_03_TWO_COLUMN_INTERLEAVED'))
      .toBeLessThan(score('D08_02_CLEAN_TWO_COLUMN_ORDER_SAFE') - 20);
  });

  it('mojibake jest gorsze od czystego Unicode', () => {
    expect(score('D08_07_MOJIBAKE_POLISH'))
      .toBeLessThan(score('D08_20_POLISH_DIACRITICS_CLEAN'));
  });

  it('NFKC-cleanable ligature nie jest karana względem clean baseline', () => {
    expect(score('D08_08_NFKC_LIGATURE_CLEAN'))
      .toBeCloseTo(score('D08_01_CLEAN_SINGLE_COLUMN'), 10);
  });

  it('nested layout, overlap i clipping są gorsze od clean baseline', () => {
    const baseline = score('D08_01_CLEAN_SINGLE_COLUMN');
    expect(score('D08_09_NESTED_TABLE_LAYOUT')).toBeLessThan(baseline);
    expect(score('D08_10_FLOATING_BOX_OVERLAP')).toBeLessThan(baseline);
    expect(score('D08_11_CLIPPED_TEXT')).toBeLessThan(baseline);
    expect(score('D08_18_OFF_PAGE_TEXT')).toBeLessThan(score('D08_11_CLIPPED_TEXT'));
  });

  it('jednoznacznie parsowalne daty wygrywają z dwuznacznymi', () => {
    expect(score('D08_12_MIXED_DATES_PARSEABLE'))
      .toBeGreaterThan(score('D08_13_AMBIGUOUS_DATES'));
  });

  it('minimalistyczne nagłówki pozostają wysoko, ale nie dostają darmowego maksimum', () => {
    const minimal = score('D08_14_MINIMALIST_HEADINGS_PARSEABLE');
    expect(minimal).toBeGreaterThan(90);
    expect(minimal).toBeLessThan(score('D08_01_CLEAN_SINGLE_COLUMN'));
  });

  it('niespójne listy są gorsze niż poprawne, a brak list nie jest wadą', () => {
    const cleanScore = score('D08_01_CLEAN_SINGLE_COLUMN');
    const badLists = score('D08_15_INCONSISTENT_LIST_INDENTS');
    const noLists = score('D08_16_NO_LISTS_VALID');

    expect(badLists).toBeLessThan(cleanScore);
    expect(noLists).toBeGreaterThan(95);
    expect(Math.abs(noLists - cleanScore)).toBeLessThanOrEqual(0.001);
  });

  it('potwierdzone zachowania adversarial obniżają wynik', () => {
    const baseline = score('D08_01_CLEAN_SINGLE_COLUMN');
    expect(score('D08_17_HIDDEN_WHITE_TEXT')).toBeLessThan(baseline);
    expect(score('D08_19_DUPLICATE_TEXT_LAYER_CONFIRMED')).toBeLessThan(baseline);
  });

  it('utrata natywnego tekstu jest katastrofalnie gorsza od poprawnej warstwy', () => {
    const broken = score('D08_05_SCAN_NO_NATIVE_TEXT');
    const correct = score('D08_06_OCR_LAYER_CORRECT');
    expect(broken).toBeLessThanOrEqual(25);
    expect(correct - broken).toBeGreaterThan(60);
  });
});
