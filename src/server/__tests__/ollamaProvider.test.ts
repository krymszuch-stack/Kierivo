import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { checkOllamaHealth, callOllamaChat } from '../ollamaClient';
import { generateWithUsage, getActiveAiProvider } from '../geminiClient';
import { resetConfigCacheForTesting } from '../config';
import { aiRouter } from '../routes/ai.routes';
import { errorHandler } from '../middleware/errorHandler';

vi.mock('../usageLedger', () => ({
  recordUsage: vi.fn(),
}));

describe('Provider Ollama (src/server/ollamaClient.ts)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.AI_PROVIDER = 'ollama';
    process.env.GEMINI_API_KEY = 'mock-key';
    process.env.OLLAMA_BASE_URL = 'http://192.168.1.170:11434';
    process.env.OLLAMA_MODEL = 'qwen-chat:latest';
    process.env.BACKEND_MODE = 'local';
    resetConfigCacheForTesting();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfigCacheForTesting();
  });

  describe('checkOllamaHealth', () => {
    it('zwraca status connected: true i listę modeli przy poprawnym GET /api/tags', async () => {
      const mockTagsResponse = {
        models: [
          {
            name: 'qwen-chat:latest',
            size: 4683087075,
            modified_at: '2026-09-04T20:10:05.483Z',
            details: { parameter_size: '7.6B', family: 'qwen2' },
          },
          {
            name: 'dolphin-chat:latest',
            size: 4920757394,
            modified_at: '2026-09-04T20:10:16.385Z',
            details: { parameter_size: '8.0B', family: 'llama' },
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
        expect.objectContaining({ method: 'GET' })
      );
      expect(health.connected).toBe(true);
      expect(health.models).toHaveLength(2);
      expect(health.models[0].name).toBe('qwen-chat:latest');
      expect(health.models[0].parameterSize).toBe('7.6B');
    });

    it('rzuca błąd 503 HOST_UNREACHABLE, gdy host Ollamy jest nieosiągalny', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        Object.assign(new Error('connect ECONNREFUSED 192.168.1.170:11434'), {
          code: 'ECONNREFUSED',
        })
      );

      await expect(checkOllamaHealth()).rejects.toMatchObject({
        status: 503,
        code: 'HOST_UNREACHABLE',
      });
    });

    it('rzuca błąd 504 TIMEOUT przy przekroczeniu czasu oczekiwania', async () => {
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

  describe('Trasy Express AI (/api/ai/ollama/health oraz /api/ai/test-prompt)', () => {
    async function startTestServer() {
      const app = express();
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
        close: () => new Promise((resolve) => server.close(resolve)),
      };
    }

    it('GET /api/ai/ollama/health zwraca modele i connected: true bez ujawniania sekretów', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
        if (url.includes('/api/tags')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              models: [{ name: 'qwen-chat:latest', size: 4683087075 }],
            }),
          } as unknown as Response;
        }
        return originalFetch(input, init);
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
        // Upewniamy się, że wewnętrzny URL nie wyciekł do odpowiedzi
        expect(JSON.stringify(data)).not.toContain('192.168.1.170');
      } finally {
        await close();
      }
    });

    it('POST /api/ai/test-prompt wykonuje prompt testowy przez Ollamę', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
        if (url.includes('/api/chat')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              model: 'qwen-chat:latest',
              message: { role: 'assistant', content: 'Testowy wynik modelu Ollama' },
            }),
          } as unknown as Response;
        }
        return originalFetch(input, init);
      });

      const { url, close } = await startTestServer();
      try {
        const res = await originalFetch(`${url}/ai/test-prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'Powiedz cześć' }),
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.success).toBe(true);
        expect(data.provider).toBe('ollama');
        expect(data.model).toBe('qwen-chat:latest');
        expect(data.reply).toBe('Testowy wynik modelu Ollama');
      } finally {
        await close();
      }
    });

    it('POST /api/ai/test-prompt zwraca 400 przy pustym prompcie', async () => {
      const { url, close } = await startTestServer();
      try {
        const res = await originalFetch(`${url}/ai/test-prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: '' }),
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
