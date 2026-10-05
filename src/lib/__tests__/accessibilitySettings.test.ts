import { describe, expect, it } from 'vitest';
import { DEFAULT_A11Y_SETTINGS, parseAccessibilitySettings } from '../accessibilitySettings';

describe('ustawienia dostępności zapisane w przeglądarce', () => {
  it('naprawia tylko błędne pola i pozostawia poprawne preferencje', () => {
    expect(parseAccessibilitySettings({
      highContrast: 'false',
      textScale: 'gigantic',
      dyslexicSpacing: true,
      enhancedFocus: 1,
      reducedMotion: false,
      unknown: 'ignored',
    })).toEqual({
      ...DEFAULT_A11Y_SETTINGS,
      dyslexicSpacing: true,
      reducedMotion: false,
    });
  });

  it.each([null, undefined, false, 4, 'large', [], ['large']])(
    'dla niepoprawnego korzenia %s używa wartości domyślnych',
    (value) => {
      expect(parseAccessibilitySettings(value)).toEqual(DEFAULT_A11Y_SETTINGS);
      expect(parseAccessibilitySettings(value)).not.toBe(DEFAULT_A11Y_SETTINGS);
    },
  );

  it('zachowuje wszystkie obsługiwane wartości skali i wyłączone tryby', () => {
    expect(parseAccessibilitySettings({
      highContrast: true,
      textScale: 'huge',
      dyslexicSpacing: false,
      enhancedFocus: true,
      reducedMotion: true,
    })).toEqual({
      highContrast: true,
      textScale: 'huge',
      dyslexicSpacing: false,
      enhancedFocus: true,
      reducedMotion: true,
    });
  });
});
