import { describe, expect, it } from 'vitest';
import { assessCvTemplate, CV_TEMPLATE_CATALOG } from '../cvTemplateEngine';

describe('katalog wariantów CV', () => {
  it('ma pięć celowo różnych wariantów z unikalnymi identyfikatorami', () => {
    expect(CV_TEMPLATE_CATALOG).toHaveLength(5);
    expect(new Set(CV_TEMPLATE_CATALOG.map((template) => template.id)).size).toBe(5);
  });

  it('nie nazywa wariantu bocznego maksymalnie przyjaznym ATS', () => {
    const visual = CV_TEMPLATE_CATALOG.find((template) => template.fit === 'visual-balanced');
    expect(visual).toBeDefined();
    expect(assessCvTemplate(visual!).label).toBe('Estetyczny kompromis');
  });
});
