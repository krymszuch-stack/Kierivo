/**
 * Deterministyczny katalog wariantów CV.
 *
 * Wariant nie dotyka treści z MasterVaultu: zmienia wyłącznie tokeny prezentacji.
 * Dzięki temu „ładniejsze” CV nie dostaje ani dopisanej umiejętności, ani
 * sztucznego wyniku ATS. Ocena opisuje znane właściwości dokumentu, a nie
 * przewiduje decyzję konkretnego systemu rekrutacyjnego.
 */

export const CV_TEMPLATE_BETA_LIMIT = 15;

export type CvTemplateFamily = 'minimal' | 'modern' | 'executive' | 'creative' | 'editorial' | 'compact';
export type CvTemplateFit = 'ats-friendly' | 'visual-balanced';
export type CvTemplateLayout = 'single-column' | 'sidebar';

export interface CvTemplate {
  id: string;
  name: string;
  family: CvTemplateFamily;
  layout: CvTemplateLayout;
  fit: CvTemplateFit;
  accent: string;
  accentSoft: string;
  headingFont: 'sans' | 'serif';
  density: 'comfortable' | 'compact';
  description: string;
}

const FAMILIES: ReadonlyArray<Omit<CvTemplate, 'id' | 'name' | 'accent' | 'accentSoft'>> = [
  { family: 'minimal', layout: 'single-column', fit: 'ats-friendly', headingFont: 'sans', density: 'comfortable', description: 'Jedna kolumna, spokojna hierarchia i pełna czytelność.' },
  { family: 'modern', layout: 'single-column', fit: 'ats-friendly', headingFont: 'sans', density: 'comfortable', description: 'Współczesny akcent, bez ukrywania treści w elementach ozdobnych.' },
  { family: 'executive', layout: 'single-column', fit: 'ats-friendly', headingFont: 'serif', density: 'comfortable', description: 'Stonowany wariant dla ról eksperckich i menedżerskich.' },
  { family: 'compact', layout: 'single-column', fit: 'ats-friendly', headingFont: 'sans', density: 'compact', description: 'Gęstszy skład dla dłuższego, nadal jednokolumnowego dokumentu.' },
  { family: 'creative', layout: 'sidebar', fit: 'visual-balanced', headingFont: 'sans', density: 'comfortable', description: 'Boczny pas i silniejsza hierarchia wizualna; wybór estetyczny.' },
  { family: 'editorial', layout: 'sidebar', fit: 'visual-balanced', headingFont: 'serif', density: 'comfortable', description: 'Redakcyjny charakter z kolumną pomocniczą; nie jest trybem maksymalnej kompatybilności.' },
];

const PALETTES = [
  ['#334155', '#e2e8f0'], ['#1d4ed8', '#dbeafe'], ['#047857', '#d1fae5'],
  ['#9f1239', '#ffe4e6'], ['#7c3aed', '#ede9fe'], ['#b45309', '#fef3c7'],
  ['#0f766e', '#ccfbf1'], ['#be123c', '#ffe4e6'], ['#4338ca', '#e0e7ff'],
  ['#155e75', '#cffafe'], ['#3f6212', '#ecfccb'], ['#92400e', '#fef3c7'],
] as const;

const FAMILY_NAMES: Record<CvTemplateFamily, string> = {
  minimal: 'Minimal', modern: 'Modern', executive: 'Executive', creative: 'Creative', editorial: 'Editorial', compact: 'Compact',
};

/** 82 warianty są generowane z ograniczonego, testowalnego zestawu reguł — nie z pustych rekordów katalogu. */
export const CV_TEMPLATE_CATALOG: readonly CvTemplate[] = Array.from({ length: 82 }, (_, index) => {
  const family = FAMILIES[index % FAMILIES.length];
  const palette = PALETTES[Math.floor(index / FAMILIES.length) % PALETTES.length];
  const number = String(index + 1).padStart(2, '0');
  return {
    ...family,
    id: `cv-${number}`,
    name: `${FAMILY_NAMES[family.family]} ${number}`,
    accent: palette[0],
    accentSoft: palette[1],
  };
});

export function findCvTemplate(id: string | undefined): CvTemplate {
  return CV_TEMPLATE_CATALOG.find((template) => template.id === id) ?? CV_TEMPLATE_CATALOG[0];
}

/** Prosty generator deterministyczny: ten sam seed daje ten sam wariant. */
export function pickCvTemplate(seed: number, catalog = CV_TEMPLATE_CATALOG): CvTemplate {
  const safeSeed = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0;
  return catalog[safeSeed % catalog.length];
}

export interface CvTemplateAssessment {
  fit: CvTemplateFit;
  label: string;
  explanation: string;
}

export function assessCvTemplate(template: CvTemplate): CvTemplateAssessment {
  if (template.fit === 'ats-friendly') {
    return {
      fit: template.fit,
      label: 'ATS-friendly',
      explanation: 'Jedna kolumna i standardowa hierarchia nagłówków. To ocena cech dokumentu, nie gwarancja działania z konkretnym ATS.',
    };
  }
  return {
    fit: template.fit,
    label: 'Estetyczny kompromis',
    explanation: 'Wariant używa układu bocznego. Treść pozostaje tekstowa, ale do maksymalnej kompatybilności wybierz eksport DOCX lub wariant ATS-friendly.',
  };
}
