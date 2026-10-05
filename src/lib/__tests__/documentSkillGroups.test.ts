import { describe, expect, it } from 'vitest';
import { resolveDocumentSkillGroups } from '../documentSkillGroups';

describe('resolveDocumentSkillGroups', () => {
  it('pokazuje umiejętność dodaną sugestią do wersji CV', () => {
    const original = {
      hardSkills: ['Windows'],
      toolsAndTech: [],
      softSkills: [],
    };

    expect(resolveDocumentSkillGroups(original, original, {
      hardSkills: ['Windows'],
      toolsAndTech: ['Zendesk'],
      softSkills: [],
    })).toEqual({
      hardSkills: ['Windows'],
      toolsAndTech: ['Zendesk'],
      softSkills: [],
    });
  });

  it('zachowuje ręczne poprawki sekcji dokumentu bez cofania sugestii w innych sekcjach', () => {
    expect(resolveDocumentSkillGroups({
      hardSkills: ['Windows', 'Troubleshooting'],
      toolsAndTech: [],
      softSkills: [],
    }, {
      hardSkills: ['Windows'],
      toolsAndTech: [],
      softSkills: [],
    }, {
      hardSkills: ['Windows', 'Troubleshooting'],
      toolsAndTech: ['Zendesk'],
      softSkills: [],
    })).toEqual({
      hardSkills: ['Windows'],
      toolsAndTech: ['Zendesk'],
      softSkills: [],
    });
  });
});
