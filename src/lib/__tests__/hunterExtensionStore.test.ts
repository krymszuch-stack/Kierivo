import { describe, expect, it } from 'vitest';
import { getHunterExtensionStoreUrl } from '../hunterExtensionStore';

const listingUrl = 'https://chromewebstore.google.com/detail/kierivo-extension/abcdefghijklmnopabcdefghijklmnop';

describe('getHunterExtensionStoreUrl', () => {
  it('returns a valid Chrome Web Store listing URL', () => {
    expect(getHunterExtensionStoreUrl(listingUrl)).toBe(listingUrl);
  });

  it.each([
    undefined,
    '',
    'https://example.com/detail/kierivo/abcdefghijklmnopabcdefghijklmnop',
    'http://chromewebstore.google.com/detail/kierivo/abcdefghijklmnopabcdefghijklmnop',
    'https://chromewebstore.google.com/detail/kierivo/not-an-extension-id',
    'https://chromewebstore.google.com.evil.example/detail/kierivo/abcdefghijklmnopabcdefghijklmnop',
    `${listingUrl}?tracking=1`,
  ])('rejects an unavailable or non-canonical listing: %s', (value) => {
    expect(getHunterExtensionStoreUrl(value)).toBeNull();
  });
});
