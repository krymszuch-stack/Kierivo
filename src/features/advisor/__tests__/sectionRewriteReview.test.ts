import { describe, expect, it } from 'vitest';
import { canCopySectionRewrite } from '../sectionRewriteReview';

describe('potwierdzenie propozycji AI przed kopiowaniem', () => {
  it('blokuje kopiowanie bez propozycji lub bez potwierdzenia faktów', () => {
    expect(canCopySectionRewrite(undefined, true)).toBe(false);
    expect(canCopySectionRewrite('Zredagowany punkt', false)).toBe(false);
    expect(canCopySectionRewrite('   ', true)).toBe(false);
  });

  it('pozwala skopiować niepustą propozycję po potwierdzeniu jej faktów', () => {
    expect(canCopySectionRewrite('Zredagowany punkt', true)).toBe(true);
  });
});
