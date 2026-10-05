import { describe, expect, it } from 'vitest';
import { normalizeExternalHttpUrl } from '../externalHttpUrl';

describe('bezpieczny adres zewnętrzny', () => {
  it.each([
    ['https://example.com/jobs/1', 'https://example.com/jobs/1'],
    ['  http://example.com/path  ', 'http://example.com/path'],
  ])('normalizuje dozwolony adres %s', (input, expected) => {
    expect(normalizeExternalHttpUrl(input)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '//example.com/path',
    'https://user:password@example.com/path',
    'not a URL',
    `https://${'a'.repeat(2049)}.com`,
    null,
  ])('odrzuca wartość, której nie wolno wstawić do linku: %s', (input) => {
    expect(normalizeExternalHttpUrl(input)).toBeUndefined();
  });
});
