/**
 * Deterministyczny katalog wariantów CV.
 *
 * Wariant nie dotyka treści z MasterVaultu: zmienia wyłącznie tokeny prezentacji.
 * Dzięki temu „ładniejsze” CV nie dostaje ani dopisanej umiejętności, ani
 * sztucznego wyniku ATS. Ocena opisuje znane właściwości dokumentu, a nie
 * przewiduje decyzję konkretnego systemu rekrutacyjnego.
 */

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

/** Pięć celowo różnych wariantów. Generator ma pomagać wybrać, nie tworzyć katalog do przewijania. */
export const CV_TEMPLATE_CATALOG: readonly CvTemplate[] = [
  { id: 'cv-minimal', name: 'Minimalny', family: 'minimal', layout: 'single-column', fit: 'ats-friendly', accent: '#334155', accentSoft: '#e2e8f0', headingFont: 'sans', density: 'comfortable', description: 'Jedna kolumna, spokojna hierarchia i pełna czytelność.' },
  { id: 'cv-modern', name: 'Nowoczesny', family: 'modern', layout: 'single-column', fit: 'ats-friendly', accent: '#1d4ed8', accentSoft: '#dbeafe', headingFont: 'sans', density: 'comfortable', description: 'Współczesny akcent, bez ukrywania treści w elementach ozdobnych.' },
  { id: 'cv-executive', name: 'Klasyczny', family: 'executive', layout: 'single-column', fit: 'ats-friendly', accent: '#047857', accentSoft: '#d1fae5', headingFont: 'serif', density: 'comfortable', description: 'Stonowany wariant dla ról eksperckich i menedżerskich.' },
  { id: 'cv-compact', name: 'Kompaktowy', family: 'compact', layout: 'single-column', fit: 'ats-friendly', accent: '#7c3aed', accentSoft: '#ede9fe', headingFont: 'sans', density: 'compact', description: 'Gęstszy skład dla dłuższego, nadal jednokolumnowego dokumentu.' },
  { id: 'cv-creative', name: 'Z akcentem', family: 'creative', layout: 'sidebar', fit: 'visual-balanced', accent: '#9f1239', accentSoft: '#ffe4e6', headingFont: 'sans', density: 'comfortable', description: 'Boczny pas i silniejsza hierarchia wizualna; wybór estetyczny.' },
];

export function findCvTemplate(id: string | undefined): CvTemplate {
  return CV_TEMPLATE_CATALOG.find((template) => template.id === id) ?? CV_TEMPLATE_CATALOG[0];
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
