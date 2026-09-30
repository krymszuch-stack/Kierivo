import { describe, expect, it } from 'vitest';
import { starTemplateForExample, starTemplateForVerb } from '../starTemplate';

describe('wstawianie wzorca STAR do CV', () => {
  it('nie przenosi fikcyjnych metryk ani uprawnień z przykładu', () => {
    const template = starTemplateForVerb('Zdiagnozowałem i usunąłem');
    expect(template).toContain('[opisz rzeczywistą czynność i kontekst]');
    expect(template).not.toMatch(/98%|120\+|SEP|UDT/);
    expect(starTemplateForExample()).not.toMatch(/250\+|NFZ|20%/);
  });
});
