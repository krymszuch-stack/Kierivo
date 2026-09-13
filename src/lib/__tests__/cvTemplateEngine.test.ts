import { describe, expect, it } from 'vitest';
import { assessCvTemplate, CV_TEMPLATE_CATALOG, CV_TEMPLATE_BETA_LIMIT, pickCvTemplate } from '../cvTemplateEngine';

describe('katalog wariantów CV', () => {
  it('ma 82 rzeczywiste warianty z unikalnymi identyfikatorami', () => {
    expect(CV_TEMPLATE_CATALOG).toHaveLength(82);
    expect(new Set(CV_TEMPLATE_CATALOG.map((template) => template.id)).size).toBe(82);
  });

  it('ten sam seed wybiera zawsze ten sam wariant', () => {
    expect(pickCvTemplate(20260913).id).toBe(pickCvTemplate(20260913).id);
  });

  it('nie nazywa wariantu bocznego maksymalnie przyjaznym ATS', () => {
    const visual = CV_TEMPLATE_CATALOG.find((template) => template.fit === 'visual-balanced');
    expect(visual).toBeDefined();
    expect(assessCvTemplate(visual!).label).toBe('Estetyczny kompromis');
  });

  it('limit bety jest jawny i nie jest ukrytym limitem modelu AI', () => {
    expect(CV_TEMPLATE_BETA_LIMIT).toBe(15);
  });
});
