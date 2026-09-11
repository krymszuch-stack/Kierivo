import { loadConfig } from './config';
import { recordUsage } from './usageLedger';

export class OllamaError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'OllamaError';
  }
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatOptions {
  messages: OllamaChatMessage[];
  model?: string;
  format?: 'json';
  context?: string;
  timeoutMs?: number;
}

export interface OllamaModelInfo {
  name: string;
  size?: number;
  modifiedAt?: string;
  parameterSize?: string;
  family?: string;
}

export interface OllamaHealthResult {
  connected: boolean;
  models: OllamaModelInfo[];
  checkedAt: string;
}

/**
 * Sprawdza łączność z serwerem Ollama i zwraca listę dostępnych modeli.
 * Bezpieczne dla klienta: NIE ujawnia wewnętrznego adresu URL ani konfiguracji env.
 */
export async function checkOllamaHealth(timeoutMs = 5_000): Promise<OllamaHealthResult> {
  const { OLLAMA_BASE_URL } = loadConfig();
  const targetUrl = `${OLLAMA_BASE_URL.replace(/\/+$/, '')}/api/tags`;

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      throw new OllamaError(
        `Ollama zwróciła status HTTP ${res.status} przy zapytaniu o listę modeli.`,
        res.status >= 500 ? 502 : res.status
      );
    }

    const data = (await res.json()) as {
      models?: Array<{
        name: string;
        size?: number;
        modified_at?: string;
        details?: { parameter_size?: string; family?: string };
      }>;
    };

    const models: OllamaModelInfo[] = (data.models || []).map((m) => ({
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at,
      parameterSize: m.details?.parameter_size,
      family: m.details?.family,
    }));

    return {
      connected: true,
      models,
      checkedAt: new Date().toISOString(),
    };
  } catch (err: unknown) {
    if (err instanceof OllamaError) throw err;

    const error = err as { name?: string; code?: string; message?: string };
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new OllamaError(
        'Przekroczono czas oczekiwania na odpowiedź serwera Ollama (/api/tags).',
        504,
        'TIMEOUT'
      );
    }

    const isUnreachable =
      error.code === 'ECONNREFUSED' ||
      error.code === 'EHOSTUNREACH' ||
      error.code === 'ENOTFOUND' ||
      /fetch failed|failed to fetch/i.test(error.message ?? '');

    if (isUnreachable) {
      throw new OllamaError(
        'Host Ollamy jest nieosiągalny pod wskazanym adresem.',
        503,
        'HOST_UNREACHABLE'
      );
    }

    throw new OllamaError(`Błąd komunikacji z Ollamą: ${error.message ?? 'Nieznany błąd'}`, 502);
  }
}

/**
 * Wykonuje zapytanie czatu do serwera Ollama (POST /api/chat).
 * Obsługuje format JSON, timeout, ewidencję tokenów oraz specyficzne błędy.
 */
export async function callOllamaChat(
  options: OllamaChatOptions
): Promise<{ content: string; model: string }> {
  const { OLLAMA_BASE_URL, OLLAMA_MODEL } = loadConfig();
  const model = options.model || OLLAMA_MODEL;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const targetUrl = `${OLLAMA_BASE_URL.replace(/\/+$/, '')}/api/chat`;

  const payload: Record<string, unknown> = {
    model,
    messages: options.messages,
    stream: false,
  };

  if (options.format === 'json') {
    payload.format = 'json';
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    const error = err as { name?: string; code?: string; message?: string };
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new OllamaError('Przekroczono czas oczekiwania na model Ollama.', 504, 'TIMEOUT');
    }

    const isUnreachable =
      error.code === 'ECONNREFUSED' ||
      error.code === 'EHOSTUNREACH' ||
      error.code === 'ENOTFOUND' ||
      /fetch failed|failed to fetch/i.test(error.message ?? '');

    if (isUnreachable) {
      throw new OllamaError(
        'Host serwera Ollama jest nieosiągalny pod wskazanym adresem.',
        503,
        'HOST_UNREACHABLE'
      );
    }

    throw new OllamaError(`Błąd wywołania Ollamy: ${error.message ?? 'Nieznany błąd'}`, 502);
  }

  if (!response.ok) {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {
      // Ignorujemy niepowodzenie odczytu treści błędu
    }

    if (response.status === 404 || /model .* not found/i.test(errorBody)) {
      throw new OllamaError(
        `Wskazany model Ollamy "${model}" nie istnieje na serwerze. Pobierz go komendą "ollama pull ${model}".`,
        404,
        'MODEL_NOT_FOUND'
      );
    }

    throw new OllamaError(
      `Serwer Ollama zwrócił błąd HTTP ${response.status}: ${errorBody || response.statusText}`,
      response.status >= 500 ? 502 : response.status
    );
  }

  interface OllamaChatResponsePayload {
    model?: string;
    message?: { role?: string; content?: string };
    done?: boolean;
    prompt_eval_count?: number;
    eval_count?: number;
  }

  let data: OllamaChatResponsePayload | null = null;
  try {
    data = (await response.json()) as OllamaChatResponsePayload;
  } catch {
    throw new OllamaError(
      'Odpowiedź serwera Ollama nie jest poprawnym formatem JSON.',
      502,
      'INVALID_JSON'
    );
  }

  const content = data?.message?.content;
  if (typeof content !== 'string') {
    throw new OllamaError(
      'Serwer Ollama zwrócił odpowiedź bez wymaganego pola message.content.',
      502,
      'MISSING_CONTENT'
    );
  }

  // Rejestracja zużycia tokenów w telemetrii
  const promptTokens = Number(data.prompt_eval_count) || 0;
  const outputTokens = Number(data.eval_count) || 0;
  if (promptTokens > 0 || outputTokens > 0) {
    recordUsage({
      context: options.context || 'ollama-chat',
      model,
      promptTokens,
      outputTokens,
    });
  }

  return {
    content,
    model,
  };
}
