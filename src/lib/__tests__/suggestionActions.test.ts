import { describe, expect, it } from 'vitest';
import { dismissUnappliedSuggestion } from '../suggestionActions';

describe('akcje sugestii CV', () => {
  it('nie ukrywa zastosowanej sugestii, żeby jej cofnięcie pozostało dostępne', () => {
    const dismissed = new Set<string>();
    const result = dismissUnappliedSuggestion(dismissed, new Set(['zendesk']), 'zendesk');

    expect(result).toBe(dismissed);
    expect(result.has('zendesk')).toBe(false);
  });

  it('pozwala pominąć niezastosowaną sugestię bez mutowania poprzedniego stanu', () => {
    const dismissed = new Set(['jira']);
    const result = dismissUnappliedSuggestion(dismissed, new Set(), 'zendesk');

    expect(result).not.toBe(dismissed);
    expect([...result]).toEqual(['jira', 'zendesk']);
    expect([...dismissed]).toEqual(['jira']);
  });
});
