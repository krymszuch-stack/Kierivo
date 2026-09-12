import { GoogleGenAI } from '@google/genai';
import { loadConfig } from './config';
import { recordUsage } from './usageLedger';
import { callOllamaChat } from './ollamaClient';

let client: GoogleGenAI | null = null;

/**
 * Zwraca aktualnie skonfigurowanego providera AI ('gemini' lub 'ollama').
 */
export function getActiveAiProvider(): 'gemini' | 'ollama' {
  return loadConfig().AI_PROVIDER;
}

/**
 * Shared Gemini client. Previously a new instance was constructed on every call,
 * discarding connection reuse.
 */
export function getGeminiClient(): GoogleGenAI {
  if (client) return client;

  const { GEMINI_API_KEY } = loadConfig();
  client = new GoogleGenAI({
    apiKey: GEMINI_API_KEY || '',
    httpOptions: { headers: { 'User-Agent': 'cvelocity-server' } },
  });
  return client;
}

/** Model id, overridable per environment. */
export function getGeminiModel(): string {
  const config = loadConfig();
  return config.AI_PROVIDER === 'ollama' ? config.OLLAMA_MODEL : config.GEMINI_MODEL;
}

/** Caps a single request so one oversized document cannot blow up the bill. */
export const MAX_INPUT_CHARS = 60_000;
export const MAX_OUTPUT_TOKENS = 8_192;
const REQUEST_TIMEOUT_MS = 45_000;

export function truncateForModel(text: string, limit = MAX_INPUT_CHARS): string {
  if (typeof text !== 'string') return '';
  return text.length <= limit ? text : text.slice(0, limit);
}

/**
 * Parses a model response as JSON.
 *
 * Only one of the five call sites guarded this; the rest threw a raw SyntaxError
 * that surfaced as a 500. The offending payload is never logged — it is the
 * user's CV, and server logs are not an appropriate place for it.
 */
export function parseModelJson<T>(raw: string | undefined, context: string): T {
  try {
    return JSON.parse(raw ?? '{}') as T;
  } catch {
    console.error(
      `[gemini] Model zwrócił niepoprawny JSON (${context}), długość odpowiedzi: ${raw?.length ?? 0}`
    );
    throw Object.assign(new Error('Model zwrócił odpowiedź w nieprawidłowym formacie.'), {
      status: 502,
    });
  }
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === 'number') return status === 429 || status >= 500;
  const message = String((err as Error)?.message ?? '');
  return /429|deadline|unavailable|timeout|ECONNRESET/i.test(message);
}

/**
 * Runs a model call with a timeout and two retries, backing off only on rate
 * limits and upstream faults. A bad request is never retried — it would fail
 * identically while costing another call.
 */
export async function callWithRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(Object.assign(new Error('Przekroczono czas oczekiwania na model.'), { status: 504 })),
            REQUEST_TIMEOUT_MS
          )
        ),
      ]);
    } catch (err) {
      lastError = err;
      if (attempt === 2 || !isRetryable(err)) break;
      // Exponential backoff with jitter, so parallel retries do not resynchronise.
      const delay = 500 * 2 ** attempt + Math.random() * 250;
      console.warn(`[gemini] Ponowienie ${attempt + 1}/2 dla ${context} za ${Math.round(delay)}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/** Fragment odpowiedzi SDK, na którym nam zależy. */
type ModelResponse = {
  text?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

/**
 * Jedno wejście do modelu dla całego serwera.
 *
 * Łączy trzy rzeczy, które wcześniej były powielone przy każdym z pięciu
 * wywołań albo nie istniały w ogóle: pobranie współdzielonego klienta,
 * ponowienia z timeoutem oraz **odczyt zużycia tokenów**. To ostatnie nie było
 * robione nigdzie, przez co koszt jednego użytkownika pozostawał nieznany.
 */
export async function generateWithUsage(
  params: Record<string, unknown>,
  context: string
): Promise<ModelResponse> {
  const config = loadConfig();

  // Ścieżka dla alternatywnego providera Ollama
  if (config.AI_PROVIDER === 'ollama') {
    let rawPrompt = '';
    if (typeof params.contents === 'string') {
      rawPrompt = params.contents;
    } else if (Array.isArray(params.contents)) {
      rawPrompt = params.contents
        .map((c) => (typeof c === 'string' ? c : JSON.stringify(c)))
        .join('\n');
    } else if (params.contents && typeof params.contents === 'object') {
      rawPrompt = JSON.stringify(params.contents);
    }

    const cfg = (params.config as { responseMimeType?: string }) || {};
    const isJson = cfg.responseMimeType === 'application/json';

    const systemInstruction = isJson
      ? 'Jesteś precyzyjnym asystentem przetwarzającym dane rekrutacyjne. Odpowiadaj wyłącznie w poprawnym formacie JSON bez znaczników markdown.'
      : 'Jesteś pomocnym asystentem rekrutacyjnym wspierającym kandydata.';

    const ollamaRes = await callOllamaChat({
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: rawPrompt },
      ],
      format: isJson ? 'json' : undefined,
      context,
    });

    return {
      text: ollamaRes.content,
    };
  }

  // Domyślna ścieżka dla providera Gemini (produkcyjna)
  const ai = getGeminiClient();
  const model = (params.model as string) ?? getGeminiModel();

  const response = (await callWithRetry(
    () => ai.models.generateContent({ model, ...params } as never),
    context
  )) as ModelResponse;

  // Brak `usageMetadata` nie może wywrócić żądania — użytkownik dostał wynik,
  // a niepełna telemetria to problem operatora, nie jego.
  const usage = response?.usageMetadata;
  if (usage) {
    recordUsage({
      context,
      model,
      promptTokens: usage.promptTokenCount ?? 0,
      outputTokens:
        usage.candidatesTokenCount ??
        Math.max(0, (usage.totalTokenCount ?? 0) - (usage.promptTokenCount ?? 0)),
    });
  } else {
    console.warn(`[gemini] Odpowiedź bez usageMetadata (${context}) — zużycie nieodnotowane.`);
  }

  return response;
}
