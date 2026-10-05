import { z } from 'zod';

export const TEXT_SCALES = ['normal', 'large', 'huge'] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export interface A11ySettings {
  highContrast: boolean;
  textScale: TextScale;
  dyslexicSpacing: boolean;
  enhancedFocus: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_A11Y_SETTINGS: A11ySettings = {
  highContrast: false,
  textScale: 'normal',
  dyslexicSpacing: false,
  enhancedFocus: false,
  reducedMotion: false,
};

const booleanSchema = z.boolean();
const textScaleSchema = z.enum(TEXT_SCALES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Uszkodzone preferencje naprawia pole po polu, zachowując pozostałe ustawienia. */
export function parseAccessibilitySettings(value: unknown): A11ySettings {
  if (!isRecord(value)) return { ...DEFAULT_A11Y_SETTINGS };

  const highContrast = booleanSchema.safeParse(value.highContrast);
  const textScale = textScaleSchema.safeParse(value.textScale);
  const dyslexicSpacing = booleanSchema.safeParse(value.dyslexicSpacing);
  const enhancedFocus = booleanSchema.safeParse(value.enhancedFocus);
  const reducedMotion = booleanSchema.safeParse(value.reducedMotion);

  return {
    highContrast: highContrast.success ? highContrast.data : DEFAULT_A11Y_SETTINGS.highContrast,
    textScale: textScale.success ? textScale.data : DEFAULT_A11Y_SETTINGS.textScale,
    dyslexicSpacing: dyslexicSpacing.success ? dyslexicSpacing.data : DEFAULT_A11Y_SETTINGS.dyslexicSpacing,
    enhancedFocus: enhancedFocus.success ? enhancedFocus.data : DEFAULT_A11Y_SETTINGS.enhancedFocus,
    reducedMotion: reducedMotion.success ? reducedMotion.data : DEFAULT_A11Y_SETTINGS.reducedMotion,
  };
}
