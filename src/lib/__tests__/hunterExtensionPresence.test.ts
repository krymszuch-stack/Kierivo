import { describe, expect, it } from 'vitest';
import { HUNTER_PRESENCE_RESPONSE, parseHunterPresenceResponse } from '../hunterExtensionPresence';

const source = {};
const expected = { source, origin: 'https://kierivo.com', requestId: '8c7e78c1-0116-4a8b-86a6-ae8c86fe4765' };
const reply = {
  type: HUNTER_PRESENCE_RESPONSE,
  protocolVersion: 1,
  requestId: expected.requestId,
  extensionVersion: '1.2.0',
};

describe('handshake obecności Kierivo Hunter', () => {
  it('rozpoznaje odpowiedź z bieżącego okna, originu i nonce', () => {
    expect(parseHunterPresenceResponse({ source, origin: expected.origin, data: reply }, expected)).toBe('1.2.0');
  });

  it.each([
    { source: {}, origin: expected.origin, data: reply },
    { source, origin: 'https://example.test', data: reply },
    { source, origin: expected.origin, data: { ...reply, requestId: 'other' } },
    { source, origin: expected.origin, data: { ...reply, extensionVersion: 'unknown' } },
    { source, origin: expected.origin, data: { ...reply, profile: { email: 'private@example.test' } } },
  ])('ignoruje odpowiedź spoza kontraktu', (event) => {
    expect(parseHunterPresenceResponse(event, expected)).toBeNull();
  });
});
