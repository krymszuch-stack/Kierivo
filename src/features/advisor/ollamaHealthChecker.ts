export type OllamaHealthState = 'checking' | 'available' | 'unavailable';

export interface OllamaHealthResult {
  state: OllamaHealthState;
  connected: boolean;
  models: Array<{ name: string }>;
  activeModel: string;
  error?: string;
}

export const OLLAMA_HEALTH_TIMEOUT_MS = 5000;

export async function checkOllamaWithTimeout(
  healthFetcher: (signal?: AbortSignal) => Promise<any>,
  timeoutMs: number = OLLAMA_HEALTH_TIMEOUT_MS
): Promise<OllamaHealthResult> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeoutId: any;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      reject(new Error('Przekroczono limit czasu oczekiwania na odpowiedź Ollamy (5s).'));
    }, timeoutMs);
  });

  try {
    const res = await Promise.race([
      healthFetcher(controller?.signal),
      timeoutPromise,
    ]);

    if (res && res.success && res.connected) {
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
      error: res?.error || 'Lokalny model Ollama nie jest połączony.',
    };
  } catch (err: unknown) {
    return {
      state: 'unavailable',
      connected: false,
      models: [],
      activeModel: '',
      error: err instanceof Error ? err.message : 'Brak odpowiedzi API',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Ustala domyślną zakładkę Doradcy na podstawie stanu Ollamy.
 * W Public Pre-Beta Ollama jest opcjonalną funkcją lokalną — przy jej niedostępności
 * Asystent Rewritingu (regułowy, deterministyczny) staje się domyślnym i promowanym kanałem.
 */
export function resolveDefaultAdvisorTab(healthState: OllamaHealthState): 'chat' | 'rewriter' {
  return healthState === 'available' ? 'chat' : 'rewriter';
}
