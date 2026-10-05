import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { StorageKeys, readJson, writeJson } from '../lib/storage';
import {
  DEFAULT_A11Y_SETTINGS,
  parseAccessibilitySettings,
  type A11ySettings,
  type TextScale,
} from '../lib/accessibilitySettings';

export type { A11ySettings, TextScale } from '../lib/accessibilitySettings';

interface AccessibilityContextType {
  settings: A11ySettings;
  setHighContrast: (enabled: boolean) => void;
  toggleHighContrast: () => void;
  setTextScale: (scale: TextScale) => void;
  setDyslexicSpacing: (enabled: boolean) => void;
  setEnhancedFocus: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  resetA11y: () => void;
  isAnyEnabled: boolean;
}

const DEFAULT_CONTEXT: AccessibilityContextType = {
  settings: DEFAULT_A11Y_SETTINGS,
  setHighContrast: () => {},
  toggleHighContrast: () => {},
  setTextScale: () => {},
  setDyslexicSpacing: () => {},
  setEnhancedFocus: () => {},
  setReducedMotion: () => {},
  resetA11y: () => {},
  isAnyEnabled: false,
};

const AccessibilityContext = createContext<AccessibilityContextType>(DEFAULT_CONTEXT);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettingsState] = useState<A11ySettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_A11Y_SETTINGS;
    return parseAccessibilitySettings(readJson<unknown>(StorageKeys.a11ySettings, null));
  });

  const updateSetting = <K extends keyof A11ySettings>(key: K, value: A11ySettings[K]) => {
    setSettingsState((prev) => {
      const next = { ...prev, [key]: value };
      writeJson(StorageKeys.a11ySettings, next);
      return next;
    });
  };

  // Synchronizacja z elementem html (DOM)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // Wysoki kontrast
    if (settings.highContrast) {
      root.setAttribute('data-high-contrast', 'true');
    } else {
      root.removeAttribute('data-high-contrast');
    }

    // Skala tekstu
    if (settings.textScale !== 'normal') {
      root.setAttribute('data-text-scale', settings.textScale);
    } else {
      root.removeAttribute('data-text-scale');
    }

    // Czytelność / interlinia
    if (settings.dyslexicSpacing) {
      root.setAttribute('data-dyslexic-spacing', 'true');
    } else {
      root.removeAttribute('data-dyslexic-spacing');
    }

    // Wyrazisty fokus
    if (settings.enhancedFocus) {
      root.setAttribute('data-enhanced-focus', 'true');
    } else {
      root.removeAttribute('data-enhanced-focus');
    }

    // Zmniejszony ruch
    if (settings.reducedMotion) {
      root.setAttribute('data-reduced-motion', 'true');
    } else {
      root.removeAttribute('data-reduced-motion');
    }
  }, [settings]);

  const isAnyEnabled = useMemo(() => {
    return (
      settings.highContrast ||
      settings.textScale !== 'normal' ||
      settings.dyslexicSpacing ||
      settings.enhancedFocus ||
      settings.reducedMotion
    );
  }, [settings]);

  const value = useMemo(
    () => ({
      settings,
      setHighContrast: (enabled: boolean) => updateSetting('highContrast', enabled),
      toggleHighContrast: () => updateSetting('highContrast', !settings.highContrast),
      setTextScale: (scale: TextScale) => updateSetting('textScale', scale),
      setDyslexicSpacing: (enabled: boolean) => updateSetting('dyslexicSpacing', enabled),
      setEnhancedFocus: (enabled: boolean) => updateSetting('enhancedFocus', enabled),
      setReducedMotion: (enabled: boolean) => updateSetting('reducedMotion', enabled),
      resetA11y: () => {
        setSettingsState(DEFAULT_A11Y_SETTINGS);
        writeJson(StorageKeys.a11ySettings, DEFAULT_A11Y_SETTINGS);
      },
      isAnyEnabled,
    }),
    [settings, isAnyEnabled]
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
};

export const useAccessibility = (): AccessibilityContextType => {
  return useContext(AccessibilityContext) ?? DEFAULT_CONTEXT;
};
