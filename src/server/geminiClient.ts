import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { AzureOpenAI } from 'openai';
import { loadConfig } from './config';
import { recordUsage } from './usageLedger';
import { callOllamaChat } from './ollamaClient';

let client: AzureOpenAI | null = null;

/** Dostawca jest jawny: chmura Azure albo lokalna Ollama. */
export function getActiveAiProvider(): 'azure_openai' | 'ollama' {
  return loadConfig().AI_PROVIDER;
}

/** Nazwa deploymentu Azure lub modelu lokalnego, bez ujawniania endpointu. */
export function getActiveAiModel(): string {
  const config = loadConfig();
  return config.AI_PROVIDER === 'ollama' ? config.OLLAMA_MODEL : config.AZURE_OPENAI_DEPLOYMENT || '';
}

/**
 * Klient Azure OpenAI nie przyjmuje klucza w obrazie ani zmiennych aplikacji.
 * DefaultAzureCredential używa Managed Identity w Container Apps, a lokalnie
 * świadomego logowania `az login`; oba tryby zostają pod tą samą granicą.
 */
export function getAzureOpenAiClient(): AzureOpenAI {
  if (client) return client;

  const config = loadConfig();
  if (!config.AZURE_OPENAI_ENDPOINT || !config.AZURE_OPENAI_DEPLOYMENT) {
    throw new Error('Azure OpenAI wymaga AZURE_OPENAI_ENDPOINT i AZURE_OPENAI_DEPLOYMENT.');
  }

  const tokenProvider = getBearerTokenProvider(
    new DefaultAzureCredential(),
    'https://cognitiveservices.azure.com/.default'
  );

  client = new AzureOpenAI({
    endpoint: config.AZURE_OPENAI_ENDPOINT,
    deployment: config.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: config.AZURE_OPENAI_API_VERSION,
    azureADTokenProvider: tokenProvider,
  });
  return client;
}

export const MAX_INPUT_CHARS = 60_000;
export const MAX_OUTPUT_TOKENS = 8_192;
const REQUEST_TIMEOUT_MS = 45_000;

export function truncateForModel(text: string, limit = MAX_INPUT_CHARS): string {
  if (typeof text !== 'string') return '';
  return text.length <= limit ? text : text.slice(0, limit);
}

export function parseModelJson<T>(raw: string | undefined, context: string): T {
  try {
    return JSON.parse(raw ?? '{}') as T;
  } catch {
    console.error(`[ai] Model zwrócił niepoprawny JSON (${context}), długość odpowiedzi: ${raw?.length ?? 0}`);
    throw Object.assign(new Error('Model zwrócił odpowiedź w nieprawidłowym formacie.'), { status: 502 });
  }
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === 'number') return status === 429 || status >= 500;
  return /429|deadline|unavailable|timeout|ECONNRESET/i.test(String((err as Error)?.message ?? ''));
}

export async function callWithRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => setTimeout(
          () => reject(Object.assign(new Error('Przekroczono czas oczekiwania na model.'), { status: 504 })),
          REQUEST_TIMEOUT_MS
        )),
      ]);
    } catch (err) {
      lastError = err;
      if (attempt === 2 || !isRetryable(err)) break;
      const delay = 500 * 2 ** attempt + Math.random() * 250;
      console.warn(`[ai] Ponowienie ${attempt + 1}/2 dla ${context} za ${Math.round(delay)}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

type ModelResponse = {
  text?: string;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
};

type GenerationConfig = {
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: unknown;
};

function contentToPrompt(contents: unknown): string {
  if (typeof contents === 'string') return contents;
  if (Array.isArray(contents)) return contents.map((entry) => typeof entry === 'string' ? entry : JSON.stringify(entry)).join('\n');
  return contents && typeof contents === 'object' ? JSON.stringify(contents) : '';
}

/** Wspólny punkt wywołań: zachowuje kontrakt dotychczasowych tras i pomiar tokenów. */
export async function generateWithUsage(params: Record<string, unknown>, context: string): Promise<ModelResponse> {
  const config = loadConfig();
  const generation = (params.config as GenerationConfig | undefined) ?? {};
  const prompt = contentToPrompt(params.contents);

  if (config.AI_PROVIDER === 'ollama') {
    const isJson = generation.responseMimeType === 'application/json';
    const ollamaRes = await callOllamaChat({
      messages: [
        { role: 'system', content: isJson
          ? 'Jesteś precyzyjnym asystentem przetwarzającym dane rekrutacyjne. Odpowiadaj wyłącznie poprawnym JSON bez markdown.'
          : 'Jesteś pomocnym asystentem rekrutacyjnym wspierającym kandydata.' },
        { role: 'user', content: prompt },
      ],
      format: isJson ? 'json' : undefined,
      context,
    });
    return { text: ollamaRes.content };
  }

  const model = (params.model as string | undefined) ?? getActiveAiModel();
  const isJson = generation.responseMimeType === 'application/json';
  const schemaInstruction = isJson && generation.responseSchema
    ? `\nZachowaj ten schemat JSON: ${JSON.stringify(generation.responseSchema)}`
    : '';
  const response = await callWithRetry(
    () => getAzureOpenAiClient().chat.completions.create({
      model,
      messages: [
        { role: 'system', content: isJson
          ? `Odpowiadaj wyłącznie poprawnym JSON, bez markdown.${schemaInstruction}`
          : 'Jesteś pomocnym asystentem rekrutacyjnym wspierającym kandydata.' },
        { role: 'user', content: prompt },
      ],
      ...(isJson ? { response_format: { type: 'json_object' as const } } : {}),
      max_completion_tokens: generation.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
    }),
    context
  );

  const usage = response.usage;
  if (usage) {
    recordUsage({
      context,
      model,
      promptTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
    });
  } else {
    console.warn(`[ai] Odpowiedź Azure OpenAI bez metadanych użycia (${context}).`);
  }

  return {
    text: response.choices[0]?.message?.content ?? undefined,
    usageMetadata: usage ? {
      promptTokenCount: usage.prompt_tokens,
      candidatesTokenCount: usage.completion_tokens,
      totalTokenCount: usage.total_tokens,
    } : undefined,
  };
}
