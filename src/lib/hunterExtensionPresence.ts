export const HUNTER_PRESENCE_REQUEST = 'KIERIVO_HUNTER_PRESENCE_REQUEST_V1';
export const HUNTER_PRESENCE_RESPONSE = 'KIERIVO_HUNTER_PRESENCE_RESPONSE_V1';

export interface HunterExtensionPresence {
  detected: boolean;
  version?: string;
}

interface PresenceResponse {
  type: typeof HUNTER_PRESENCE_RESPONSE;
  protocolVersion: 1;
  requestId: string;
  extensionVersion: string;
}

/** Handshake informacyjny: odpowiedź nie autoryzuje konta i nie przenosi danych profilu. */
export function parseHunterPresenceResponse(
  event: { source: unknown; origin: string; data: unknown },
  expected: { source: unknown; origin: string; requestId: string },
): string | null {
  if (event.source !== expected.source || event.origin !== expected.origin ||
      !event.data || typeof event.data !== 'object' || Array.isArray(event.data)) return null;

  const response = event.data as Partial<PresenceResponse>;
  if (Object.keys(response).length !== 4 ||
      response.type !== HUNTER_PRESENCE_RESPONSE || response.protocolVersion !== 1 ||
      response.requestId !== expected.requestId || typeof response.extensionVersion !== 'string' ||
      !/^\d+(?:\.\d+){0,3}$/.test(response.extensionVersion)) return null;

  return response.extensionVersion;
}

/** Nie zapisuje odpowiedzi ani nie wysyła niczego poza jednorazowym nonce. */
export function probeHunterExtension(
  targetWindow: Window,
  timeoutMs = 500,
): Promise<HunterExtensionPresence> {
  return new Promise((resolve) => {
    const requestId = targetWindow.crypto.randomUUID();
    const expected = { source: targetWindow, origin: targetWindow.location.origin, requestId };
    const timeout = targetWindow.setTimeout(() => finish({ detected: false }), timeoutMs);

    const handleMessage = (event: MessageEvent<unknown>) => {
      const version = parseHunterPresenceResponse(event, expected);
      if (version) finish({ detected: true, version });
    };

    function finish(result: HunterExtensionPresence) {
      targetWindow.clearTimeout(timeout);
      targetWindow.removeEventListener('message', handleMessage);
      resolve(result);
    }

    targetWindow.addEventListener('message', handleMessage);
    targetWindow.postMessage({
      type: HUNTER_PRESENCE_REQUEST,
      protocolVersion: 1,
      requestId,
    }, expected.origin);
  });
}
