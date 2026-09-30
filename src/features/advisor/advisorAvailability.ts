export type AdvisorAvailabilityState = 'checking' | 'available' | 'unavailable';

export interface AdvisorAvailabilityResult {
  state: AdvisorAvailabilityState;
  connected: boolean;
  models: Array<{ name: string }>;
  activeModel: string;
  error?: string;
}

export const OLLAMA_HEALTH_TIMEOUT_MS = 5000;

export async function checkAdvisorWithTimeout(
  healthFetcher: (signal?: AbortSignal) => Promise<any>,
  timeoutMs: number = OLLAMA_HEALTH_TIMEOUT_MS
): Promise<AdvisorAvailabilityResult> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeoutId: any;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      reject(new Error('Przekroczono limit czasu oczekiwania na status Doradcy Azure (5s).'));
    }, timeoutMs);
  });

  try {
    const res = await Promise.race([
      healthFetcher(controller?.signal),
      timeoutPromise,
    ]);

    if (res && res.success && (res.available === true || res.connected === true)) {
      return {
        state: 'available',
        connected: true,
        models: res.models || [],
        activeModel: res.activeModel || '',
        error: undefined,
      };
    }

    return {
      state: 'unavailable',
      connected: false,
      models: res?.models || [],
      activeModel: res?.activeModel || '',
      error: res?.error || 'Doradca Azure nie jest dostępny w tej instalacji.',
    };
  } catch (err: unknown) {
    const status = typeof err === 'object' && err !== null && 'status' in err
      ? (err as { status?: unknown }).status
      : undefined;
    const error = status === 501
      ? 'Tryb lokalny nie obsługuje Doradcy Azure. Wymagane są konto chmurowe i logowanie.'
      : status === 401
        ? 'Zaloguj się, aby korzystać z Doradcy Azure.'
        : err instanceof Error ? err.message : 'Brak odpowiedzi API';

    return {
      state: 'unavailable',
      connected: false,
      models: [],
      activeModel: '',
      error,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Otwiera rozmowę, gdy Azure jest skonfigurowane; w innym przypadku pokazuje brak konfiguracji.
 */
export function resolveDefaultAdvisorTab(healthState: AdvisorAvailabilityState): 'chat' | 'rewriter' {
  return healthState === 'available' ? 'chat' : 'rewriter';
}
