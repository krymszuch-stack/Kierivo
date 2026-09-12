import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import { Server } from 'http';
import { checkOllamaHealth, callOllamaChat } from '../ollamaClient';
import { generateWithUsage, getActiveAiProvider } from '../geminiClient';
import { aiRouter } from '../routes/ai.routes';
import { errorHandler } from '../middleware/errorHandler';
import { resetConfigCacheForTesting } from '../config';

const originalFetch = globalThis.fetch;

describe('Provider AI: Ollama (Lokalny model językowy)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AI_PROVIDER = 'ollama';
    process.env.OLLAMA_BASE_URL = 'http://192.168.1.170:11434';
    process.env.OLLAMA_MODEL = 'qwen-chat:latest';
    process.env.NODE_ENV = 'test';
    delete process.env.GEMINI_API_KEY;
    resetConfigCacheForTesting();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    resetConfigCacheForTesting();
    vi.restoreAllMocks();
  });

  describe('checkOllamaHealth', () => {
    it('zwraca listę modeli i connected: true przy poprawnej odpowiedzi serwera', async () => {
      const mockTagsResponse = {
        models: [
          {
            name: 'qwen-chat:latest',
            size: 4683087075,
            modified_at: '2026-09-04T20:10:05.483238578Z',
            details: { parameter_size: '7.6B', family: 'qwen2' },
          },
          {
            name: 'oathcry-twin:latest',
            size: 6594475690,
            modified_at: '2026-09-09T00:59:44.583258998Z',
            details: { parameter_size: '9.7B', family: 'qwen35' },
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTagsResponse,
      } as unknown as Response);

      const health = await checkOllamaHealth();

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://192.168.1.170:11434/api/tags',
        expect.objectContaining({
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
      );

      expect(health.connected).toBe(true);
      expect(health.models).toHaveLength(2);
      expect(health.models[0].name).toBe('qwen-chat:latest');
      expect(health.models[0].parameterSize).toBe('7.6B');
      expect(health.models[1].name).toBe('oathcry-twin:latest');
    });

    it('rzuca błąd 503 HOST_UNREACHABLE, gdy serwer Ollama jest nieosiągalny', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        Object.assign(new Error('fetch failed'), {
          code: 'ECONNREFUSED',
        })
      );

      await expect(checkOllamaHealth()).rejects.toMatchObject({
        status: 503,
        code: 'HOST_UNREACHABLE',
      });
    });

    it('rzuca błąd 504 TIMEOUT, gdy serwer nie odpowiada w zadanym czasie', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        Object.assign(new Error('The operation was aborted due to timeout'), {
          name: 'TimeoutError',
        })
      );

      await expect(checkOllamaHealth()).rejects.toMatchObject({
        status: 504,
        code: 'TIMEOUT',
      });
    });
  });

  describe('callOllamaChat', () => {
    it('wysyła poprawny payload POST do /api/chat i czyta response.message.content', async () => {
      const mockChatResponse = {
        model: 'qwen-chat:latest',
        created_at: '2026-09-11T17:48:18Z',
        message: {
          role: 'assistant',
          content: 'Oto odpowiedź modelu z Ollamy.',
        },
        done: true,
        prompt_eval_count: 42,
        eval_count: 15,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockChatResponse,
      } as unknown as Response);

      const result = await callOllamaChat({
        messages: [
          { role: 'system', content: 'Instrukcja systemowa' },
          { role: 'user', content: 'Wiadomość użytkownika' },
        ],
        format: 'json',
        context: 'test-unit',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://192.168.1.170:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            model: 'qwen-chat:latest',
            messages: [
              { role: 'system', content: 'Instrukcja systemowa' },
              { role: 'user', content: 'Wiadomość użytkownika' },
            ],
            stream: false,
            format: 'json',
          }),
        })
      );

      expect(result.content).toBe('Oto odpowiedź modelu z Ollamy.');
      expect(result.model).toBe('qwen-chat:latest');
    });

    it('rzuca błąd 404 MODEL_NOT_FOUND, gdy model nie istnieje na serwerze', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'model "nieistniejacy-model" not found',
      } as unknown as Response);

      await expect(
        callOllamaChat({
          messages: [{ role: 'user', content: 'Test' }],
          model: 'nieistniejacy-model',
        })
      ).rejects.toMatchObject({
        status: 404,
        code: 'MODEL_NOT_FOUND',
      });
    });

    it('rzuca błąd 502 MISSING_CONTENT, gdy odpowiedź nie ma pola message.content', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'qwen-chat:latest',
          done: true,
        }),
      } as unknown as Response);

      await expect(
        callOllamaChat({
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toMatchObject({
        status: 502,
        code: 'MISSING_CONTENT',
      });
    });

    it('rzuca błąd 503 HOST_UNREACHABLE, gdy serwer Ollama jest wyłączony', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        Object.assign(new Error('fetch failed'), {
          code: 'ECONNREFUSED',
        })
      );

      await expect(
        callOllamaChat({
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toMatchObject({
        status: 503,
        code: 'HOST_UNREACHABLE',
      });
    });
  });

  describe('generateWithUsage delegacja do Ollamy', () => {
    it('kieruje zapytanie do Ollamy, gdy AI_PROVIDER=ollama', async () => {
      expect(getActiveAiProvider()).toBe('ollama');

      const mockChatResponse = {
        model: 'qwen-chat:latest',
        message: {
          role: 'assistant',
          content: JSON.stringify({ parsed: 'ok' }),
        },
        done: true,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockChatResponse,
      } as unknown as Response);

      const response = await generateWithUsage(
        {
          contents: 'Wyodrębnij dane z CV',
          config: { responseMimeType: 'application/json' },
        },
        'parse-cv'
      );

      expect(response.text).toBe(JSON.stringify({ parsed: 'ok' }));
    });
  });

  describe('Trasy Express dla Doradcy i Ollamy', () => {
    async function startTestServer() {
      const app: Express = express();
      app.use(express.json());
      app.use('/api', aiRouter);
      app.use(errorHandler);

      const server: Server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      return {
        url: `http://127.0.0.1:${port}/api`,
        close: () => new Promise<void>((resolve) => server.close(() => resolve())),
      };
    }

    it('GET /api/ai/ollama/health zwraca status i modele bez ujawniania sekretów', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        if (url.includes('/api/tags')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              models: [{ name: 'qwen-chat:latest', size: 4683087075 }],
            }),
          } as unknown as Response;
        }
        return originalFetch(input);
      });

      const { url, close } = await startTestServer();
      try {
        const res = await originalFetch(`${url}/ai/ollama/health`);
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;

        expect(data.success).toBe(true);
        expect(data.provider).toBe('ollama');
        expect(data.connected).toBe(true);
        expect(Array.isArray(data.models)).toBe(true);
        expect(data.activeModel).toBe('qwen-chat:latest');
        // Upewniamy się, że wewnętrzny URL nie wyciekł do odpowiedzi
        expect(JSON.stringify(data)).not.toContain('192.168.1.170');
      } finally {
        await close();
      }
    });

    it('GET /api/ai/ollama/health zwraca connected: false gdy Ollama nie odpowiada', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' })
      );

      const { url, close } = await startTestServer();
      try {
        const res = await originalFetch(`${url}/ai/ollama/health`);
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;

        expect(data.success).toBe(true);
        expect(data.connected).toBe(false);
        expect(data.models).toEqual([]);
      } finally {
        await close();
      }
    });

    it('POST /api/advisor/chat zwraca odpowiedź z asystą lokalnej Ollamy', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        if (url.includes('/api/chat')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              model: 'qwen-chat:latest',
              message: {
                role: 'assistant',
                content:
                  'W metodzie STAR skup się na mierzalnym rezultacie. Podawaj realne procenty i liczby z Twojego projektu.',
              },
            }),
          } as unknown as Response;
        }
        return originalFetch(input);
      });

      const { url, close } = await startTestServer();
      try {
        const res = await originalFetch(`${url}/advisor/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'Jak najlepiej opisać sukcesy w STAR?',
            history: [{ sender: 'user', text: 'Cześć' }],
          }),
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.success).toBe(true);
        expect(data.provider).toBe('ollama');
        expect(data.model).toBe('qwen-chat:latest');
        expect(data.reply).toContain('W metodzie STAR skup się na mierzalnym rezultacie');
      } finally {
        await close();
      }
    });

    it('POST /api/advisor/chat zwraca 400 przy pustym zapytaniu', async () => {
      const { url, close } = await startTestServer();
      try {
        const res = await originalFetch(`${url}/advisor/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '   ' }),
        });

        expect(res.status).toBe(400);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.success).toBe(false);
      } finally {
        await close();
      }
    });

  });
});
